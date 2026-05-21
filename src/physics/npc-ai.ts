import { G, Client } from "../state.js";
import { SHIPS } from "../data/ships.js";
import { MODULES } from "../data/modules.js";
import { WEAPON_PROFILES } from "../data/weaponProfiles.js";
import { ENEMY_DEFS } from "../data/enemies.js";
import { C } from "../config/index.js";
import type { Enemy } from "../types/world.js";
import type { ModuleInstance } from "../types/moduleInstance.js";
import { angleDiff } from "../utils/math.js";
import { computeEnemyAimDeviation } from "../combat.js";
import { sfxHostileLocking, sfxHostileLock, sfxWeaponFire, sfxUnderAttackPulse } from "../audio/procedural.js";
import { damagePlayer } from "../combat/damage-display.js";
import { addEnemyBullet, addBeam } from "../utils/entities.js";

let _attackPulseTimer = 0;

export function computeLinearInterceptAngle(
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

export function processNpcBehavior(e: Enemy, dt: number, d: number, detectionRange: number) {
  if (d < detectionRange || (e._lastPlayerHitAt && (performance.now() - e._lastPlayerHitAt) < C.ENEMIES.PLAYER_HIT_WINDOW_MS)) {
    if (!e.targetingPlayer) {
      e.targetingPlayer = true;
      e.lockOnTimer = 0;
      e.hasLockOnPlayer = false;
      sfxHostileLocking(e.x, e.y);
    }
    const shipDef = SHIPS[e.type] ?? SHIPS["scout"];
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
    
    const prof = C.ENEMIES.AI.ENGAGEMENT[ENEMY_DEFS[e.type]?.engagement ?? "brawler"];
    if (prof.behavior === "orbit") {
      if (!e._orbitDir) e._orbitDir = Math.random() < 0.5 ? 1 : -1;
      const thrust = e.speed * prof.thrustMultiplier;
      if (d > prof.orbitDistance + prof.orbitHysteresis) {
        e.angle += angleDiff(e.angle, targetAngle) * prof.approachTurnRate;
        e.vx += Math.cos(e.angle) * thrust * dt;
        e.vy += Math.sin(e.angle) * thrust * dt;
      } else if (d < prof.orbitDistance - prof.orbitHysteresis) {
        e.angle += angleDiff(e.angle, targetAngle + Math.PI) * prof.approachTurnRate;
        e.vx += Math.cos(e.angle) * thrust * dt;
        e.vy += Math.sin(e.angle) * thrust * dt;
      } else {
        e.angle += angleDiff(e.angle, targetAngle + Math.PI / 2 * e._orbitDir) * prof.orbitTurnRate;
        e.vx += Math.cos(e.angle) * thrust * dt;
        e.vy += Math.sin(e.angle) * thrust * dt;
      }
      e.thrustFx = true;
    } else if (prof.behavior === "stationary") {
      e.angle += angleDiff(e.angle, targetAngle) * prof.turnRate;
    } else {
      e.angle += angleDiff(e.angle, targetAngle) * prof.turnRate;
      if (d > prof.stopDistance) {
        const thrust = (e.speed || 0) * prof.thrustMultiplier;
        e.vx += Math.cos(e.angle) * thrust * dt;
        e.vy += Math.sin(e.angle) * thrust * dt;
        e.thrustFx = true;
      }
    }

    // Procedural fitting weapons
    if (e.fitting?.turret && e.hasLockOnPlayer) {
      for (let i = 0; i < e.fitting.turret.length; i++) {
        const uid = e.fitting.turret[i];
        if (!uid) continue;
        const inst = ((e.fitting as any)._tempInstances as ModuleInstance[] | undefined)?.find((inst) => inst.uid === uid);
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
              if (perp < Math.min(hitR * 0.6 + C.ENEMIES.AI.HIT_CHECK_RADIUS, C.ENEMIES.AI.BEAM_HIT_RADIUS_CAP)) {
                damagePlayer(Math.max(1, Math.floor(wProf.dmg * (e.weaponMult ?? 1.0))), e.x, e.y);
              }
            } else {
              if (G.enemyBullets.length < 200) {
                const bSpd = wProf.spd || 800;
                const bLife = (wProf.range * 1.1) / bSpd;
                sfxWeaponFire("projectile", baseId, 0.8, e.x, e.y);
                addEnemyBullet({
                  x: e.x, y: e.y, px: e.x, py: e.y,
                  vx: Math.cos(shootAng) * bSpd, vy: Math.sin(shootAng) * bSpd,
                  life: bLife, dmg: wProf.dmg * (e.weaponMult ?? 1.0), color: wProf.color, sz: wProf.sz, trail: wProf.trail
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
    const prof = C.ENEMIES.AI.ENGAGEMENT[ENEMY_DEFS[e.type]?.engagement ?? "brawler"];
    if (prof.behavior !== "stationary") {
      const thrust = e.speed * prof.thrustMultiplier * prof.idleThrustMultiplier;
      e.vx += Math.cos(e.angle) * thrust * dt;
      e.vy += Math.sin(e.angle) * thrust * dt;
      if (Math.random() < C.ENEMIES.IDLE_ANGLE_JITTER_CHANCE) e.angle += (Math.random() - 0.5) * C.ENEMIES.IDLE_ANGLE_JITTER_AMOUNT;
      if (e.speed > C.ENEMIES.IDLE_THRUST_SPEED_THRESHOLD) e.thrustFx = true;
    }
  }
}

export function triggerAttackWarningPulse(allEnemies: Enemy[], dt: number) {
  let lockedCount = 0;
  let closestLocked: Enemy | null = null;
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
  if (lockedCount > 0 && closestLocked) {
    _attackPulseTimer -= dt;
    if (_attackPulseTimer <= 0) {
      sfxUnderAttackPulse(lockedCount, closestLocked.x, closestLocked.y);
      _attackPulseTimer = C.ENEMIES.ATTACK_PULSE_INTERVAL;
    }
  } else {
    _attackPulseTimer = 0;
  }
}
