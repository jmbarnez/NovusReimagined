import { G, Client } from "../state.js";
import { getStats } from "../player/player-stats.js";
import { spawnImpactFlash } from "../utils/fx.js";
import { addTrailSegment, removeEnemyBullet, addParticle } from "../utils/entities.js";
import { liveEnemies, liveAsteroids } from "../utils/game.js";
import { MODULES, MODULE_FLAGS } from "../data/modules.js";
import { SHIPS } from "../data/ships.js";
import { ENEMY_DEFS } from "../data/enemies.js";
import { ORE } from "../data/resources.js";
import { AST_SPIN_RANGE, ASTEROID_VEL_DECAY, ASTEROID_DENSITY, ENEMY_MASS, COLLISION_RESTITUTION, ENEMY_AMBIENT_DRAG, ENEMY_MIN_DIST_HOME_STATION, ENEMY_MIN_DIST_NONHOME_STATION } from "../constants.js";
import { damagePlayer } from "../combat/damage-display.js";
import { resolveElasticCollision } from "../utils/math.js";
import { harvestAsteroid } from "../utils/mining.js";
import { sfxUnderAttackPulse, sfxBeamImpact, sfxIndustrialBeam } from "../audio/procedural.js";
import { C } from "../config/index.js";
import type { Enemy, Asteroid } from "../types/world.js";
import type { SpatialGrid, SpatialQueryResult } from "../utils/spatial.js";
import { processNpcBehavior, triggerAttackWarningPulse } from "./npc-ai.js";
import { isPointInAsteroid } from "./combat-physics.js";

const _qOut: SpatialQueryResult<Enemy>[] = [];
const _astOut: SpatialQueryResult<Asteroid>[] = [];

function updateNpcMovementAndSeparation(e: Enemy, dt: number, enemyDecay: number, grid: SpatialGrid | null) {
  e.px = e.x; e.py = e.y; e.prevAngle = e.angle;
  e.thrustFx = false;

  if ((e.shieldHitGlow ?? 0) > 0) {
    e.shieldHitGlow = Math.max(0, (e.shieldHitGlow ?? 0) - dt * 2.5);
  }

  if (e.vx || e.vy) {
    e.x  += e.vx * dt;
    e.y  += e.vy * dt;
    e.vx *= enemyDecay;
    e.vy *= enemyDecay;
    if (Math.abs(e.vx) < 0.5 && Math.abs(e.vy) < 0.5) { e.vx = 0; e.vy = 0; }
  }

  if (grid) {
    _qOut.length = 0;
    grid.query<Enemy>(e.x, e.y, C.ENEMIES.AI.GRID_QUERY_RADIUS, "enemy", _qOut);
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

    // Asteroid avoidance: steer around rocks using a velocity look-ahead probe
    // so the enemy curves clear before the physical collision resolver kicks in.
    const AV = C.ENEMIES.AI.AVOIDANCE;
    const eR = ENEMY_DEFS[e.type]?.colRadius ?? e.sigRadius ?? 18;
    const probeX = e.x + e.vx * AV.LOOKAHEAD_TIME;
    const probeY = e.y + e.vy * AV.LOOKAHEAD_TIME;
    _astOut.length = 0;
    grid.query<Asteroid>(probeX, probeY, eR + AV.QUERY_PADDING, "asteroid", _astOut);
    let avX = 0, avY = 0;
    for (let i = 0; i < _astOut.length; i++) {
      const a = _astOut[i];
      if (a.dist < 1) continue;
      const avoidRadius = eR + a.radius + AV.AVOID_PADDING;
      const force = (avoidRadius - a.dist) / avoidRadius;
      if (force > 0) {
        avX -= (a.dx / a.dist) * force;
        avY -= (a.dy / a.dist) * force;
      }
    }
    const avMag = Math.hypot(avX, avY);
    if (avMag > 0) {
      const mag = Math.min(avMag, AV.MAG_CAP);
      e.vx += (avX / avMag) * mag * AV.FORCE_SCALE * dt;
      e.vy += (avY / avMag) * mag * AV.FORCE_SCALE * dt;
    }
  }
}

function applyNpcStationEvasion(e: Enemy, dt: number) {
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
}

function spawnNpcTrail(e: Enemy) {
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
      angle: e.angle,
    });
  }
}

export function updateNpcs(dt: number) {
  const grid = G.spatialGrid;
  const allEnemies = liveEnemies();
  const enemyDecay = Math.pow(ENEMY_AMBIENT_DRAG, dt);

  for (const e of allEnemies) {
    updateNpcMovementAndSeparation(e, dt, enemyDecay, grid);
    applyNpcStationEvasion(e, dt);

    const d = Math.hypot(G.P.x - e.x, G.P.y - e.y);
    let detectionRange = e.aggroRange || C.ENEMIES.AI.DETECTION.baseAggroRange;
    if (e.hasLockOnPlayer) detectionRange *= C.ENEMIES.AI.DETECTION.lockOnMultiplier;
    else if (e.targetingPlayer) detectionRange *= C.ENEMIES.AI.DETECTION.lockingMultiplier;

    processNpcBehavior(e, dt, d, detectionRange);
    spawnNpcTrail(e);
  }

  triggerAttackWarningPulse(allEnemies, dt);
}

const _ebHits: SpatialQueryResult<Asteroid>[] = [];

export function updateEnemyBullets(dt: number) {
  const grid = G.spatialGrid;
  for (let i = G.enemyBullets.length - 1; i >= 0; i--) {
    const b = G.enemyBullets[i];
    b.px = b.x; b.py = b.y;

    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;

    const moveDist = Math.max(0, Math.hypot(b.x - b.px, b.y - b.py));

    // Player hit: closest-approach parameter along this step's path segment.
    const playerColRadius = SHIPS[G.P.shipId]?.colRadius ?? 20;
    const hitDist = playerColRadius + C.ENEMIES.AI.HIT_CHECK_RADIUS;
    let playerHit = false;
    let playerHitT = 1; // fraction along path of the hit (for nearest-hit ordering)
    if (Math.hypot(G.P.x - b.x, G.P.y - b.y) < hitDist) {
      playerHit = true;
    } else {
      const pdx = b.x - b.px, pdy = b.y - b.py;
      const segLenSq = pdx * pdx + pdy * pdy;
      if (segLenSq > 0) {
        const t = Math.max(0, Math.min(1, ((G.P.x - b.px) * pdx + (G.P.y - b.py) * pdy) / segLenSq));
        const closestX = b.px + t * pdx;
        const closestY = b.py + t * pdy;
        if (Math.hypot(G.P.x - closestX, G.P.y - closestY) < hitDist) {
          playerHit = true;
          playerHitT = t;
        }
      }
    }

    // Asteroid hit: CCD raycast along the path, earliest sample wins.
    let astHit = false;
    let astHitT = Infinity;
    let astHitX = b.x, astHitY = b.y;
    if (grid) {
      const bRad = b.sz || 2;
      _ebHits.length = 0;
      grid.query<Asteroid>(b.x, b.y, bRad + moveDist, "asteroid", _ebHits);
      if (_ebHits.length) {
        const steps = Math.ceil(moveDist / 5);
        for (let idx = 0; idx < _ebHits.length; idx++) {
          const ast = _ebHits[idx].data;
          if (!ast || ast.depleted || ast.hp <= 0) continue;
          for (let s = 0; s <= steps; s++) {
            const t = steps === 0 ? 1 : s / steps;
            const tx = b.px + (b.x - b.px) * t;
            const ty = b.py + (b.y - b.py) * t;
            if (isPointInAsteroid(tx, ty, ast, bRad)) {
              if (t < astHitT) { astHitT = t; astHitX = tx; astHitY = ty; astHit = true; }
              break;
            }
          }
        }
      }
    }

    // Asteroid blocks the shot when it intercepts before reaching the player.
    if (astHit && astHitT <= playerHitT) {
      spawnImpactFlash(astHitX, astHitY, b.color || "#ff6644");
      removeEnemyBullet(i);
      continue;
    }

    if (playerHit) {
      const variance = 0.5 + Math.random() * 0.7;
      const finalDmg = Math.max(1, Math.floor((b.dmg || (2 + Math.random() * 2)) * variance));
      damagePlayer(finalDmg, b.x, b.y);
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
    const lockSlot = G.P.lockQueue?.find((s) => s.id === assignedId);
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
      if (result.oreKey) {
        G.miningLaser.oreKey = result.oreKey;
        G.miningLaser.oreColor = (ORE[result.oreKey] ?? ORE.iron).color;
      }
      const oreColor = G.miningLaser.oreColor || "#a0a5aa";
      const sparkColors = [oreColor, "#ffffff", oreColor];
      const backAngle = Math.atan2(G.P.y - ast.y, G.P.x - ast.x);
      for (let p = 0; p < 2; p++) {
        const sa = backAngle + (Math.random() - 0.5) * 1.4;
        const spd = 30 + Math.random() * 60;
        addParticle({
          x: ast.x + (Math.random() - 0.5) * 6,
          y: ast.y + (Math.random() - 0.5) * 6,
          color: sparkColors[p % sparkColors.length],
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
    G.miningLaser.oreKey = "";
    G.miningLaser.oreColor = "";
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
        e.structure = e.maxStructure;
        e.shield = e.maxShield;
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
    const e = enemies[i];
    const r = ENEMY_DEFS[e.type]?.colRadius ?? e.sigRadius ?? 18;
    if (r > maxEnemyR) maxEnemyR = r;
  }

  for (let pass = 0; pass < 3; pass++) {
    // Enemy ↔ asteroid: use spatial grid broad-phase on pass 0,
    // fall back to brute force on subsequent passes (positions shifted)
    if (pass === 0 && grid) {
      for (const e of enemies) {
        const eR = ENEMY_DEFS[e.type]?.colRadius ?? e.sigRadius ?? 18;
        const nearby = grid.query<Asteroid>(e.x, e.y, eR + maxAstR, "asteroid");
        for (const hit of nearby) {
          const a = hit.data;
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

        const m1 = a1.radius * a1.radius * ASTEROID_DENSITY;
        const m2 = a2.radius * a2.radius * ASTEROID_DENSITY;
        resolveElasticCollision(a1, a2, m1, m2, dx, dy, dist, minDist, COLLISION_RESTITUTION);
      }
    }
  }
}

function resolveEnemyAsteroid(e: Enemy, a: Asteroid, dx: number, dy: number, dist: number, minDist: number) {
  const mA = a.radius * a.radius * ASTEROID_DENSITY;
  resolveElasticCollision(e, a, ENEMY_MASS, mA, dx, dy, dist, minDist, COLLISION_RESTITUTION);
}
