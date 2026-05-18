import { G, Client } from "../state.js";
import { getStats } from "../player/player-stats.js";
import { floatText, spawnImpactFlash } from "../utils/fx.js";
import { addEnemyBullet, addTrailSegment, removeEnemyBullet, addParticle, addBeam } from "../utils/entities.js";
import { liveEnemies, liveAsteroids } from "../utils/game.js";
import { MODULES, MODULE_FLAGS } from "../data/modules.js";
import { SHIPS } from "../data/ships.js";
import { ENEMY_DEFS } from "../data/enemies.js";
import { AST_SPIN_RANGE, RESPAWN_S, ASTEROID_VEL_DECAY, ASTEROID_DENSITY, ENEMY_MASS, COLLISION_RESTITUTION, TAU, ENEMY_AMBIENT_DRAG, ENEMY_MIN_DIST_HOME_STATION, ENEMY_MIN_DIST_NONHOME_STATION } from "../constants.js";
import { damagePlayer } from "../combat/damage-display.js";
import { computeEnemyAimDeviation } from "../combat.js";
import { angleDiff, rf } from "../utils/math.js";
import { harvestAsteroid } from "../utils/mining.js";
import { sfxHostileLocking, sfxHostileLock, sfxUnderAttackPulse, sfxWeaponFire, sfxBeamImpact, sfxIndustrialBeam } from "../audio/procedural.js";
import { WEAPON_PROFILES } from "../data/weaponProfiles.js";
import { C } from "../config/index.js";

const _qOut: any[] = [];
let _attackPulseTimer = 0;

function computeLinearInterceptAngle(
  shooterX: number,
  shooterY: number,
  targetX: number,
  targetY: number,
  targetVx: number,
  targetVy: number,
  projectileSpeed: number,
  predictionScale: number = 1.0,
): number {
  const relX = targetX - shooterX;
  const relY = targetY - shooterY;
  const relVx = targetVx;
  const relVy = targetVy;
  const speedSq = projectileSpeed * projectileSpeed;
  const vv = relVx * relVx + relVy * relVy;
  const rv = relX * relVx + relY * relVy;
  const rr = relX * relX + relY * relY;

  const a = vv - speedSq;
  const b = 2 * rv;
  const c = rr;

  let t = 0;
  if (Math.abs(a) < 1e-6) {
    if (Math.abs(b) > 1e-6) t = -c / b;
  } else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const root = Math.sqrt(disc);
      const t1 = (-b - root) / (2 * a);
      const t2 = (-b + root) / (2 * a);
      const best = Math.min(t1 > 0 ? t1 : Infinity, t2 > 0 ? t2 : Infinity);
      if (Number.isFinite(best)) t = best;
    }
  }

  if (!Number.isFinite(t) || t < 0) t = 0;
  t = Math.min(t, 2.0) * predictionScale;

  const aimX = targetX + relVx * t;
  const aimY = targetY + relVy * t;
  return Math.atan2(aimY - shooterY, aimX - shooterX);
}

export function updateNpcs(dt: number) {
  const grid = G.spatialGrid;
  const allEnemies = liveEnemies();
  const playerR = 20;

  const enemyDecay = Math.pow(ENEMY_AMBIENT_DRAG, dt);

  for (const e of allEnemies) {
    e.px = e.x; e.py = e.y; e.prevAngle = e.angle;
    e.thrustFx = false;

    if (e.vx || e.vy) {
      e.x  += e.vx * dt;
      e.y  += e.vy * dt;
      e.vx *= enemyDecay;
      e.vy *= enemyDecay;
      if (Math.abs(e.vx) < 0.5 && Math.abs(e.vy) < 0.5) { e.vx = 0; e.vy = 0; }
    }

    if (grid) {
      _qOut.length = 0;
      grid.query(e.x, e.y, C.ENEMIES.AI.GRID_QUERY_RADIUS, "enemy", _qOut);
      let sepX = 0, sepY = 0;
      for (let i = 0; i < _qOut.length; i++) {
        const n = _qOut[i];
        if (n.id === e.id) continue;
        if (n.dist < 1) continue;
        const force = (C.ENEMIES.AI.SEPARATION_DISTANCE - n.dist) / C.ENEMIES.AI.SEPARATION_DISTANCE;
        if (force > 0) {
          sepX -= (n.dx / n.dist) * force;
          sepY -= (n.dy / n.dist) * force;
        }
      }
      const sepMag = Math.hypot(sepX, sepY);
      if (sepMag > 0) {
        const mag = Math.min(sepMag, C.ENEMIES.AI.SEPARATION_MAG_CAP);
        e.vx += (sepX / sepMag) * mag * C.ENEMIES.AI.SEPARATION_FORCE_SCALE * dt;
        e.vy += (sepY / sepMag) * mag * C.ENEMIES.AI.SEPARATION_FORCE_SCALE * dt;
      }
    }

    const d = Math.hypot(G.P.x - e.x, G.P.y - e.y);
    let detectionRange = e.aggroRange || C.ENEMIES.AI.DETECTION.baseAggroRange;
    if (e.hasLockOnPlayer) detectionRange *= C.ENEMIES.AI.DETECTION.lockOnMultiplier;
    else if (e.targetingPlayer) detectionRange *= C.ENEMIES.AI.DETECTION.lockingMultiplier;

    const sys = G.GALAXY[G.P.sysIdx];
    if (e.type !== "drone" && sys?.stations) {
      for (const st of sys.stations) {
        const sdx = e.x - st.x;
        const sdy = e.y - st.y;
        const sd = Math.hypot(sdx, sdy);
        const safe = st.safeRadius ?? (st.isHome ? ENEMY_MIN_DIST_HOME_STATION : ENEMY_MIN_DIST_NONHOME_STATION);
        if (sd < safe && sd > 1) {
          const push = (safe - sd) / safe;
          e.vx += (sdx / sd) * push * 400 * dt;
          e.vy += (sdy / sd) * push * 400 * dt;
        }
      }
    }

    if (d < detectionRange || (e._lastPlayerHitAt && (performance.now() - e._lastPlayerHitAt) < C.ENEMIES.PLAYER_HIT_WINDOW_MS)) {
      if (!e.targetingPlayer) {
        e.targetingPlayer = true;
        e.lockOnTimer = 0;
        e.hasLockOnPlayer = false;
        sfxHostileLocking(e.x, e.y);
      }
      const shipDef = SHIPS[e.type] ?? SHIPS["scout"]; // Fallback if type not found
      const lockTimeRequired = Math.max(C.ENEMIES.AI.LOCK_ON.minTime, C.ENEMIES.AI.LOCK_ON.baseTime - (shipDef.lockBonusTicks || 0) * C.ENEMIES.AI.LOCK_ON.perBonusTickReduction);
      
      e.lockOnTimer = (e.lockOnTimer || 0) + dt;
      if (e.lockOnTimer >= lockTimeRequired) {
        if (!e.hasLockOnPlayer) {
          e.hasLockOnPlayer = true;
          sfxHostileLock(e.x, e.y);
        }
      }

      const targetAngle = Math.atan2(G.P.y - e.y, G.P.x - e.x);
      const predictedTargetAngle = computeLinearInterceptAngle(
        e.x,
        e.y,
        G.P.x,
        G.P.y,
        G.P.vx || 0,
        G.P.vy || 0,
        C.ENEMIES.PROJECTILE_SPEED,
        e.accuracy ?? 1.0,
      );
      
      if (e.type === "rat_drone") {
        if (!e._orbitDir) e._orbitDir = Math.random() < 0.5 ? 1 : -1;
        const orbitDist = C.ENEMIES.AI.ENGAGEMENT.ratDrone.orbitDistance;
        const thrust = e.speed * C.ENEMIES.AI.ENGAGEMENT.ratDrone.thrustMultiplier;
        if (d > orbitDist + C.ENEMIES.AI.ENGAGEMENT.ratDrone.orbitHysteresis) {
          e.angle += angleDiff(e.angle, targetAngle) * C.ENEMIES.AI.ENGAGEMENT.ratDrone.approachTurnRate;
          e.vx += Math.cos(e.angle) * thrust * dt;
          e.vy += Math.sin(e.angle) * thrust * dt;
        } else if (d < orbitDist - C.ENEMIES.AI.ENGAGEMENT.ratDrone.orbitHysteresis) {
          e.angle += angleDiff(e.angle, targetAngle + Math.PI) * C.ENEMIES.AI.ENGAGEMENT.ratDrone.approachTurnRate;
          e.vx += Math.cos(e.angle) * thrust * dt;
          e.vy += Math.sin(e.angle) * thrust * dt;
        } else {
          e.angle += angleDiff(e.angle, targetAngle + Math.PI / 2 * e._orbitDir) * C.ENEMIES.AI.ENGAGEMENT.ratDrone.orbitTurnRate;
          e.vx += Math.cos(e.angle) * thrust * dt;
          e.vy += Math.sin(e.angle) * thrust * dt;
        }
        e.thrustFx = true;
      } else {
        e.angle += angleDiff(e.angle, targetAngle) * C.ENEMIES.AI.ENGAGEMENT.other.turnRate;
        if (e.type !== "drone") {
          const distToStop = e.type === "rat" ? C.ENEMIES.AI.ENGAGEMENT.rat.stopDistance : C.ENEMIES.AI.ENGAGEMENT.other.stopDistance;
          if (d > distToStop) {
        const thrust = (e.speed || 0) * C.ENEMIES.AI.ENGAGEMENT.rat.thrustMultiplier;
            e.vx += Math.cos(e.angle) * thrust * dt;
            e.vy += Math.sin(e.angle) * thrust * dt;
            e.thrustFx = true;
          }
        }
      }

      // Procedural fitting weapons
      if (e.fitting?.turret && e.hasLockOnPlayer) {
        for (let i = 0; i < e.fitting.turret.length; i++) {
          const uid = e.fitting.turret[i];
          if (!uid) continue;
          const inst = (e.fitting as any)._tempInstances?.find((inst: any) => inst.uid === uid);
          const baseId = inst ? inst.baseId : uid;
          if (e.turretCds[i] > 0) e.turretCds[i] -= dt;

          if (e.turretCds[i] <= 0) {
            const wProf = WEAPON_PROFILES[baseId] || WEAPON_PROFILES.default;
            if (d < Math.min(wProf.range, detectionRange)) {
              const shootAng = predictedTargetAngle + computeEnemyAimDeviation(e, d);
              if (wProf.type === "beam") {
                const beamDist = d;
                const bX2 = e.x + Math.cos(shootAng) * beamDist;
                const bY2 = e.y + Math.sin(shootAng) * beamDist;
                sfxWeaponFire("beam", baseId, 0.7, e.x, e.y);
                addBeam({ x1: e.x, y1: e.y, x2: bX2, y2: bY2, color: wProf.color, width: wProf.sz, life: C.ENEMIES.AI.BEAM_IMPACT_LIFE });
                const hitR = SHIPS[G.P.shipId]?.signatureRadius ?? 20;
                const perp = Math.abs((G.P.x - e.x)*Math.sin(shootAng) - (G.P.y - e.y)*Math.cos(shootAng));
                if (perp < Math.min(hitR * 0.6 + C.ENEMIES.AI.HIT_CHECK_RADIUS, C.ENEMIES.AI.BEAM_HIT_RADIUS_CAP)) damagePlayer(wProf.dmg, e.x, e.y);
              } else {
                if (G.enemyBullets.length < 200) {
                  const bSpd = wProf.spd || 800;
                  const bLife = (wProf.range * 1.1) / bSpd;
                  sfxWeaponFire("projectile", baseId, 0.8, e.x, e.y);
                  addEnemyBullet({
                    x: e.x, y: e.y, px: e.x, py: e.y,
                    vx: Math.cos(shootAng) * bSpd, vy: Math.sin(shootAng) * bSpd,
                    life: bLife, dmg: wProf.dmg, color: wProf.color, sz: wProf.sz, trail: wProf.trail
                  });
                }
              }
              e.turretCds[i] = wProf.rate + (Math.random() * C.ENEMIES.AI.TURRET_RELOAD_JITTER);
            }
          }
        }
      }
    } else {
      e.targetingPlayer = false;
      e.hasLockOnPlayer = false;
      e.lockOnTimer = 0;
      if (e.type !== "drone") {
        const thrust = e.speed * C.ENEMIES.AI.ENGAGEMENT.other.thrustMultiplier * C.ENEMIES.AI.ENGAGEMENT.other.idleThrustMultiplier;
        e.vx += Math.cos(e.angle) * thrust * dt;
        e.vy += Math.sin(e.angle) * thrust * dt;
        if (Math.random() < C.ENEMIES.IDLE_ANGLE_JITTER_CHANCE) e.angle += (Math.random() - 0.5) * C.ENEMIES.IDLE_ANGLE_JITTER_AMOUNT;
        if (e.speed > C.ENEMIES.IDLE_THRUST_SPEED_THRESHOLD) e.thrustFx = true;
      }
    }

    if (e.thrustFx) {
      const backDist = C.ENEMIES.TRAIL.backDistanceOffset + (e.radius || 16) * C.ENEMIES.TRAIL.backDistanceMultiplier;
      const wx = e.x - Math.cos(e.angle) * backDist;
      const wy = e.y - Math.sin(e.angle) * backDist;
      addTrailSegment({
        x: wx,
        y: wy,
        color: C.ENEMIES.TRAIL.color,
        width: C.ENEMIES.TRAIL.width,
        life: C.ENEMIES.TRAIL.life,
      });
    }
  }

  let lockedCount = 0;
  let closestLocked: any = null;
  let closestDist = Infinity;
  for (const e of allEnemies) {
    if (e.hasLockOnPlayer) {
      lockedCount++;
      const ed = Math.hypot(G.P.x - e.x, G.P.y - e.y);
      if (ed < closestDist) {
        closestDist = ed;
        closestLocked = e;
      }
    }
  }
  if (lockedCount > 0) {
    _attackPulseTimer -= dt;
    if (_attackPulseTimer <= 0) {
      sfxUnderAttackPulse(lockedCount, closestLocked.x, closestLocked.y);
      _attackPulseTimer = C.ENEMIES.ATTACK_PULSE_INTERVAL;
    }
  } else {
    _attackPulseTimer = 0;
  }
}

export function updateEnemyBullets(dt: number) {
  for (let i = G.enemyBullets.length - 1; i >= 0; i--) {
    const b = G.enemyBullets[i];
    b.px = b.x; b.py = b.y;

    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;

    const playerColRadius = SHIPS[G.P.shipId]?.colRadius ?? 20;
    const hitDist = playerColRadius + C.ENEMIES.AI.HIT_CHECK_RADIUS;
    let collided = Math.hypot(G.P.x - b.x, G.P.y - b.y) < hitDist;
    if (!collided) {
      const pdx = b.x - b.px, pdy = b.y - b.py;
      const segLenSq = pdx * pdx + pdy * pdy;
      if (segLenSq > 0) {
        const t = Math.max(0, Math.min(1, ((G.P.x - b.px) * pdx + (G.P.y - b.py) * pdy) / segLenSq));
        const closestX = b.px + t * pdx;
        const closestY = b.py + t * pdy;
        collided = Math.hypot(G.P.x - closestX, G.P.y - closestY) < hitDist;
      }
    }

    if (collided) {
      damagePlayer(b.dmg || (8 + Math.random() * 5), b.x, b.y);
      spawnImpactFlash(b.x, b.y, b.color || "#ff6644");
      removeEnemyBullet(i);
      continue;
    }
    if (b.life <= 0) removeEnemyBullet(i);
  }
}

export function updateAsteroids(dt: number) {
  const decay = Math.pow(ASTEROID_VEL_DECAY, dt);
  for (const a of liveAsteroids()) {
    a.prevSpin = a.spinAngle;
    a.spinAngle += a.spinVel * dt;
    if (Math.random() < 0.0005) a.spinVel = (Math.random() - 0.5) * AST_SPIN_RANGE;

    if (a.vx || a.vy) {
      a.x  += a.vx * dt;
      a.y  += a.vy * dt;
      a.vx *= decay;
      a.vy *= decay;
      if (Math.abs(a.vx) < 0.5 && Math.abs(a.vy) < 0.5) { a.vx = 0; a.vy = 0; }
    }
  }
}

let _miningHumTimer = 0;

export function updateMining(dt: number) {
  const st = getStats();
  if (!st.hasMiner) { G.miningLaser.active = false; return; }
  if (Client.stationOpen || Client.showMap || Client.bridgeOpen || Client.settingsOpen) {
    G.miningLaser.active = false; return;
  }

  const sys = G.GALAXY[G.P.sysIdx];
  const slots = G.P.fitting.turret || [];
  let beamSet = false;

  for (let i = 0; i < slots.length; i++) {
    const uid = slots[i];
    if (!uid) continue;
    const inst = G.P.moduleCargo.find(inst => inst.uid === uid);
    const m = inst ? MODULES[inst.baseId] : null;
    if (!m || !MODULE_FLAGS.isMiningTurret(m)) continue;
    if (!(G.P.turretPower?.[i] ?? false) || (G.P.turretPowerCd?.[i] || 0) > 0) continue;

    // Require an assigned locked asteroid in turretTargets[i].
    const assignedId = G.P.turretTargets?.[i];
    if (!assignedId) continue;
    const lockSlot = G.P.lockQueue?.find((s: any) => s.id === assignedId);
    if (!lockSlot || lockSlot.resolving) continue;
    const ast = sys?._asteroidMap?.get(assignedId);
    if (!ast || ast.depleted || ast.hp <= 0) continue;

    const dx = ast.x - G.P.x, dy = ast.y - G.P.y;
    const dist = Math.hypot(dx, dy);
    if (dist > st.mineRange) continue;

    const energyCost = 10 * dt;  // 1/3 of old 30/sec
    if (G.P.energy < energyCost) continue;
    G.P.energy -= energyCost;

    if (!beamSet) {
      G.miningLaser.active = true;
      G.miningLaser.x1 = G.P.x; G.miningLaser.y1 = G.P.y;
      G.miningLaser.x2 = ast.x; G.miningLaser.y2 = ast.y;
      G.miningLaser.hitR = ast.radius;
      G.miningLaser.hitNx = dx / dist; G.miningLaser.hitNy = dy / dist;
      G.miningLaser.phase = (G.miningLaser.phase || 0) + dt * 18;
      beamSet = true;
      _miningHumTimer -= dt;
      if (_miningHumTimer <= 0) {
        sfxIndustrialBeam("mining", ast.x, ast.y);
        _miningHumTimer = 0.5;
      }
    }

    if (G.P.mineCd > 0) {
      G.P.mineCd -= dt;
    } else {
      const result = harvestAsteroid(ast, st.miningMult);
      sfxBeamImpact("mining", ast.x, ast.y);
      G.P.mineCd = 0.45;
      const backAngle = Math.atan2(G.P.y - ast.y, G.P.x - ast.x);
      for (let p = 0; p < 2; p++) {
        const sa = backAngle + (Math.random() - 0.5) * 1.4;
        const spd = 30 + Math.random() * 60;
        addParticle({
          x: ast.x + (Math.random() - 0.5) * 6,
          y: ast.y + (Math.random() - 0.5) * 6,
          color: Math.random() < 0.5 ? "#ffcc44" : "#ff8822",
          vx: Math.cos(sa) * spd,
          vy: Math.sin(sa) * spd,
          r: 1.0 + Math.random() * 1.8,
          life: 0.35 + Math.random() * 0.25,
          drag: 0.90 + Math.random() * 0.06,
          decay: 2.0 + Math.random() * 1.0,
        });
      }
      if (result.depleted) G.miningLaser.hitR = 0;
    }
  }

  if (!beamSet) {
    G.miningLaser.active = false;
    G.miningLaser.phase = 0;
  }
}

export function updateEnemyRespawns(dt: number) {
  const sys = G.GALAXY[G.P.sysIdx];
  if (!sys || !sys.enemies) return;
  for (const e of sys.enemies) {
    if (!e.alive) {
      e.respawnTimer -= dt;
      if (e.respawnTimer <= 0) {
        e.alive = true;
        e.hp = e.maxHp;
        e.x = e.spawnX;
        e.y = e.spawnY;
        e.vx = 0;
        e.vy = 0;
        e.angle = Math.random() * Math.PI * 2;
        e.targetingPlayer = false;
        e.hasLockOnPlayer = false;
        e.lockOnTimer = 0;
      }
    }
  }
}

export function resolveNpcAsteroidCollisions() {
  const sys = G.GALAXY[G.P.sysIdx];
  if (!sys) return;
  const enemies = sys._liveEnemies;
  const asteroids = sys._liveAsteroids;
  if (!enemies || !asteroids || !asteroids.length) return;

  const grid = G.spatialGrid;
  // Max asteroid radius for query range — cache to avoid recalculating
  let maxAstR = 0;
  for (let i = 0; i < asteroids.length; i++) {
    if (asteroids[i].radius > maxAstR) maxAstR = asteroids[i].radius;
  }
  let maxEnemyR = 18;
  for (let i = 0; i < enemies.length; i++) {
    const e: any = enemies[i];
    const r = ENEMY_DEFS[e.type]?.colRadius ?? e.sigRadius ?? 18;
    if (r > maxEnemyR) maxEnemyR = r;
  }

  for (let pass = 0; pass < 3; pass++) {
    // Enemy ↔ asteroid: use spatial grid broad-phase on pass 0,
    // fall back to brute force on subsequent passes (positions shifted)
    if (pass === 0 && grid) {
      for (const e of enemies) {
        const eR = ENEMY_DEFS[e.type]?.colRadius ?? e.sigRadius ?? 18;
        const nearby = grid.query(e.x, e.y, eR + maxAstR, "asteroid");
        for (const hit of nearby) {
          const a = hit.data as any;
          const dx = a.x - e.x;
          const dy = a.y - e.y;
          const dist = Math.hypot(dx, dy);
          const minDist = eR + a.radius;
          if (dist >= minDist || dist < 0.001) continue;
          resolveEnemyAsteroid(e, a, dx, dy, dist, minDist);
        }
      }
    } else {
      for (const e of enemies) {
        const eR = ENEMY_DEFS[e.type]?.colRadius ?? e.sigRadius ?? 18;
        for (const a of asteroids) {
          const dx = a.x - e.x;
          const dy = a.y - e.y;
          const dist = Math.hypot(dx, dy);
          const minDist = eR + a.radius;
          if (dist >= minDist || dist < 0.001) continue;
          resolveEnemyAsteroid(e, a, dx, dy, dist, minDist);
        }
      }
    }

    // Asteroid ↔ asteroid (brute force — typically small N)
    for (let i = 0; i < asteroids.length; i++) {
      const a1 = asteroids[i];
      for (let j = i + 1; j < asteroids.length; j++) {
        const a2 = asteroids[j];
        const dx = a2.x - a1.x;
        const dy = a2.y - a1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = a1.radius + a2.radius;
        if (dist >= minDist || dist < 0.001) continue;

        const overlap = minDist - dist;
        const nx = dx / dist;
        const ny = dy / dist;

        const m1 = a1.radius * a1.radius * ASTEROID_DENSITY;
        const m2 = a2.radius * a2.radius * ASTEROID_DENSITY;
        const invSum = 1 / m1 + 1 / m2;

        a1.x -= nx * overlap * ((1 / m1) / invSum);
        a1.y -= ny * overlap * ((1 / m1) / invSum);
        a2.x += nx * overlap * ((1 / m2) / invSum);
        a2.y += ny * overlap * ((1 / m2) / invSum);

        const closing = (a1.vx - a2.vx) * nx + (a1.vy - a2.vy) * ny;
        if (closing > 0) {
          const jImpulse = (1 + COLLISION_RESTITUTION) * closing / invSum;
          a1.vx -= (jImpulse / m1) * nx;
          a1.vy -= (jImpulse / m1) * ny;
          a2.vx += (jImpulse / m2) * nx;
          a2.vy += (jImpulse / m2) * ny;
        }
      }
    }
  }
}

function resolveEnemyAsteroid(e: any, a: any, dx: number, dy: number, dist: number, minDist: number) {
  const overlap = minDist - dist;
  const nx = dx / dist;
  const ny = dy / dist;

  const mE = ENEMY_MASS;
  const mA = a.radius * a.radius * ASTEROID_DENSITY;
  const invSum = 1 / mE + 1 / mA;

  e.x -= nx * overlap * ((1 / mE) / invSum);
  e.y -= ny * overlap * ((1 / mE) / invSum);
  a.x += nx * overlap * ((1 / mA) / invSum);
  a.y += ny * overlap * ((1 / mA) / invSum);

  const closing = (e.vx - a.vx) * nx + (e.vy - a.vy) * ny;
  if (closing > 0) {
    const j = (1 + COLLISION_RESTITUTION) * closing / invSum;
    e.vx -= (j / mE) * nx;
    e.vy -= (j / mE) * ny;
    a.vx += (j / mA) * nx;
    a.vy += (j / mA) * ny;
  }
}
