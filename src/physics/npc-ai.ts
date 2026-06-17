import { Client, type Player } from "../state.js";
import { getState, WorldAccess } from "../state-access.js";
import { SHIPS } from "../data/ships.js";
import { MODULES } from "../data/modules.js";
import { WEAPON_PROFILES } from "../data/weaponProfiles.js";
import { ENEMY_DEFS } from "../data/enemies.js";
import { C } from "../config/index.js";
import type { EngagementProfile } from "../config/enemies.js";
import type { Enemy } from "../types/world.js";
import type { ModuleInstance } from "../types/moduleInstance.js";
import { angleDiff } from "../utils/math.js";
import { computeEnemyAimDeviation } from "../combat/aim.js";
import { damageEnemy } from "../combat.js";
import { sfxHostileLocking, sfxHostileLock, sfxWeaponFire, sfxUnderAttackPulse } from "../audio/procedural.js";
import { damagePlayer } from "../combat/damage-display.js";
import { getEnemyTurretOrigin } from "../combat/turret-origin.js";
import { addEnemyBullet, addBeam } from "../utils/entities.js";
import { spawnMuzzleFlash } from "../utils/fx.js";
import { isHostile } from "../combat/factions.js";
import { processAmbientBehavior } from "./ambient-ships.js";
import { liveEnemies } from "../utils/game.js";

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
  predictionTimeCap = 2.0,
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
  t = Math.min(t, predictionTimeCap) * predictionScale;

  const aimX = targetX + relVx * t;
  const aimY = targetY + relVy * t;
  return Math.atan2(aimY - shooterY, aimX - shooterX);
}

export function pickHostileTarget(e: Enemy, range: number): Enemy | Player | null {
  let closestTarget: Enemy | Player | null = null;
  let closestDist = range;

  // Check player if eligible
  const provokedByPlayer = !!e._lastPlayerHitAt && performance.now() - e._lastPlayerHitAt < C.ENEMIES.PLAYER_HIT_WINDOW_MS;
  const playerAlive = getState().player.hp > 0 || (getState().player.structure ?? 0) > 0;
  if (playerAlive && (isHostile(e.faction, "player") || provokedByPlayer)) {
    const dist = Math.hypot(getState().player.x - e.x, getState().player.y - e.y);
    if (dist < closestDist) {
      closestDist = dist;
      closestTarget = getState().player;
    }
  }

  // Check other live enemies in the current system
  const enemies = liveEnemies();
  for (const oe of enemies) {
    if (oe === e || !oe.alive) continue;
    if (isHostile(e.faction, oe.faction)) {
      const dist = Math.hypot(oe.x - e.x, oe.y - e.y);
      if (dist < closestDist) {
        closestDist = dist;
        closestTarget = oe;
      }
    }
  }

  return closestTarget;
}

export function fireTurretsAt(e: Enemy, target: Enemy | Player, dt: number, detectionRange: number) {
  if (!e.fitting?.turret) return;
  const isTargetPlayer = target === getState().player;
  const targetX = target.x;
  const targetY = target.y;
  const targetVx = target.vx || 0;
  const targetVy = target.vy || 0;
  const d = Math.hypot(targetX - e.x, targetY - e.y);
  const origin = getEnemyTurretOrigin(e);
  const fireDist = Math.hypot(targetX - origin.x, targetY - origin.y);

  for (let i = 0; i < e.fitting.turret.length; i++) {
    const uid = e.fitting.turret[i];
    if (!uid) continue;
    const inst = e.fitting._tempInstances?.find((inst) => inst.uid === uid);
    const baseId = inst ? inst.baseId : uid;
    if (e.turretCds[i] > 0) e.turretCds[i] -= dt;

    if (e.turretCds[i] <= 0) {
      const wProf = WEAPON_PROFILES[baseId] || WEAPON_PROFILES.default;
      if (fireDist < Math.min(wProf.range, detectionRange)) {
        const predictedTargetAngle = wProf.type === "beam"
          ? Math.atan2(targetY - origin.y, targetX - origin.x)
          : computeLinearInterceptAngle(
            origin.x,
            origin.y,
            targetX,
            targetY,
            targetVx,
            targetVy,
            wProf.spd || C.ENEMIES.PROJECTILE_SPEED,
            e.accuracy ?? 1.0,
          );
        const shootAng = predictedTargetAngle + computeEnemyAimDeviation(e, fireDist);
        spawnMuzzleFlash(origin.x, origin.y, shootAng, wProf.color, wProf.type === "beam" ? 3 : 4);
        if (wProf.type === "beam") {
          const beamDist = fireDist;
          const bX2 = origin.x + Math.cos(shootAng) * beamDist;
          const bY2 = origin.y + Math.sin(shootAng) * beamDist;
          WorldAccess.queueEffect({
            type: "weaponFire",
            payload: { delivery: "beam", typeId: baseId, vol: 0.7, x: origin.x, y: origin.y },
          });
          addBeam({ x1: origin.x, y1: origin.y, x2: bX2, y2: bY2, color: wProf.color, width: wProf.sz, life: C.ENEMIES.AI.BEAM_IMPACT_LIFE });
          
          if (isTargetPlayer) {
            const hitR = SHIPS[getState().player.shipId]?.signatureRadius ?? 20;
            const perp = Math.abs((getState().player.x - origin.x) * Math.sin(shootAng) - (getState().player.y - origin.y) * Math.cos(shootAng));
            if (perp < Math.min(hitR * 0.6 + C.ENEMIES.AI.HIT_CHECK_RADIUS, C.ENEMIES.AI.BEAM_HIT_RADIUS_CAP)) {
              damagePlayer(Math.max(1, Math.floor(wProf.dmg * (e.weaponMult ?? 1.0))), origin.x, origin.y);
              WorldAccess.queueEffect({
                type: "impact",
                payload: { x: bX2, y: bY2, color: wProf.color, delivery: "beam" },
              });
            }
          } else {
            const hitR = (target as Enemy).sigRadius ?? 20;
            const perp = Math.abs((target.x - origin.x) * Math.sin(shootAng) - (target.y - origin.y) * Math.cos(shootAng));
            if (perp < Math.min(hitR * 0.6 + C.ENEMIES.AI.HIT_CHECK_RADIUS, C.ENEMIES.AI.BEAM_HIT_RADIUS_CAP)) {
              damageEnemy(target as Enemy, Math.max(1, Math.floor(wProf.dmg * (e.weaponMult ?? 1.0))), bX2, bY2, undefined, "beam");
              WorldAccess.queueEffect({
                type: "impact",
                payload: { x: bX2, y: bY2, color: wProf.color, delivery: "beam" },
              });
            }
          }
        } else {
          if (getState().enemyBullets.length < 200) {
            const bSpd = wProf.spd || 800;
            const bLife = (wProf.range * 1.1) / bSpd;
            WorldAccess.queueEffect({
              type: "weaponFire",
              payload: { delivery: "projectile", typeId: baseId, vol: 0.8, x: origin.x, y: origin.y },
            });
            addEnemyBullet({
              x: origin.x, y: origin.y, px: origin.x, py: origin.y,
              vx: Math.cos(shootAng) * bSpd, vy: Math.sin(shootAng) * bSpd,
              life: bLife, dmg: wProf.dmg * (e.weaponMult ?? 1.0), color: wProf.color, sz: wProf.sz, trail: wProf.trail,
              ownerFaction: e.faction, ownerId: e.id
            });
          }
        }
        e.turretCds[i] = wProf.rate + (Math.random() * C.ENEMIES.AI.TURRET_RELOAD_JITTER);
      }
    }
  }
}

// ─── Pure AI helpers (no side effects, no mutation) ────────────────────────

interface NpcTargetResult {
  target: Enemy | Player | null;
  isNew: boolean;
  isPlayer: boolean;
}

/** Validate current target and pick a new one if needed.  Pure. */
function resolveNpcTargetState(e: Enemy, detectionRange: number): NpcTargetResult {
  const player = getState().player;
  let target = e._npcTarget ?? null;
  let isPlayer = false;

  if (target) {
    if ((target as unknown) === player) {
      if (player.hp <= 0 && (player.structure ?? 0) <= 0) target = null;
      else isPlayer = true;
    } else {
      if (!(target as Enemy).alive) target = null;
    }
  }

  const hadTarget = target !== null;
  if (!target) {
    target = pickHostileTarget(e, detectionRange);
    isPlayer = (target as unknown) === player;
  }

  return { target, isNew: !hadTarget && target !== null, isPlayer };
}

interface NpcLockResult {
  lockTimer: number;
  hasLock: boolean;
  acquiredLock: boolean;
}

/** Advance lock timer and determine if lock resolves.  Pure. */
function computeNpcLockResult(
  currentTimer: number,
  currentHasLock: boolean,
  dt: number,
  lockTimeRequired: number,
): NpcLockResult {
  const lockTimer = currentTimer + dt;
  if (lockTimer >= lockTimeRequired && !currentHasLock) {
    return { lockTimer, hasLock: true, acquiredLock: true };
  }
  return { lockTimer, hasLock: lockTimer >= lockTimeRequired, acquiredLock: false };
}

interface NpcMovementDeltas {
  angleDelta: number;
  vxDelta: number;
  vyDelta: number;
  thrustFx: boolean;
  orbitDir?: 1 | -1;
}

/** Compute movement deltas when engaged with a target.
 *  Contract: apply `angleDelta` to `e.angle` FIRST, then `vxDelta`/`vyDelta`.
 *  Pure. */
function computeNpcEngagementMovement(
  e: Enemy,
  target: Enemy | Player,
  dist: number,
  dt: number,
  prof: EngagementProfile,
): NpcMovementDeltas {
  const targetAngle = Math.atan2(target.y - e.y, target.x - e.x);
  let angleDelta = 0;
  let vxDelta = 0;
  let vyDelta = 0;
  let thrustFx = false;
  let orbitDir: 1 | -1 | undefined = e._orbitDir;

  if (prof.behavior === "orbit") {
    if (!orbitDir) orbitDir = Math.random() < 0.5 ? 1 : -1;
    const thrust = e.speed * prof.thrustMultiplier;
    if (dist > prof.orbitDistance + prof.orbitHysteresis) {
      angleDelta = angleDiff(e.angle, targetAngle) * prof.approachTurnRate;
      const newAngle = e.angle + angleDelta;
      vxDelta = Math.cos(newAngle) * thrust * dt;
      vyDelta = Math.sin(newAngle) * thrust * dt;
    } else if (dist < prof.orbitDistance - prof.orbitHysteresis) {
      angleDelta = angleDiff(e.angle, targetAngle + Math.PI) * prof.approachTurnRate;
      const newAngle = e.angle + angleDelta;
      vxDelta = Math.cos(newAngle) * thrust * dt;
      vyDelta = Math.sin(newAngle) * thrust * dt;
    } else {
      angleDelta = angleDiff(e.angle, targetAngle + Math.PI / 2 * orbitDir) * prof.orbitTurnRate;
      const newAngle = e.angle + angleDelta;
      vxDelta = Math.cos(newAngle) * thrust * dt;
      vyDelta = Math.sin(newAngle) * thrust * dt;
    }
    thrustFx = true;
  } else if (prof.behavior === "stationary") {
    angleDelta = angleDiff(e.angle, targetAngle) * prof.turnRate;
  } else {
    angleDelta = angleDiff(e.angle, targetAngle) * prof.turnRate;
    if (dist > prof.stopDistance) {
      const thrust = (e.speed || 0) * prof.thrustMultiplier;
      const newAngle = e.angle + angleDelta;
      vxDelta = Math.cos(newAngle) * thrust * dt;
      vyDelta = Math.sin(newAngle) * thrust * dt;
      thrustFx = true;
    }
  }

  return { angleDelta, vxDelta, vyDelta, thrustFx, orbitDir };
}

/** Compute movement deltas when no target (idle patrol).
 *  Contract: apply `vxDelta`/`vyDelta` to `e.vx`/`e.vy` FIRST, then `angleDelta`.
 *  Pure. */
function computeNpcIdleMovement(
  e: Enemy,
  dt: number,
  prof: EngagementProfile,
): NpcMovementDeltas {
  if (prof.behavior === "stationary") {
    return { angleDelta: 0, vxDelta: 0, vyDelta: 0, thrustFx: false };
  }

  const thrust = e.speed * prof.thrustMultiplier * prof.idleThrustMultiplier;
  const vxDelta = Math.cos(e.angle) * thrust * dt;
  const vyDelta = Math.sin(e.angle) * thrust * dt;
  let angleDelta = 0;
  if (Math.random() < C.ENEMIES.IDLE_ANGLE_JITTER_CHANCE) {
    angleDelta = (Math.random() - 0.5) * C.ENEMIES.IDLE_ANGLE_JITTER_AMOUNT;
  }
  const thrustFx = e.speed > C.ENEMIES.IDLE_THRUST_SPEED_THRESHOLD;

  return { angleDelta, vxDelta, vyDelta, thrustFx };
}

// ─── Main behavior orchestrator ──────────────────────────────────────────────

export function processNpcBehavior(e: Enemy, dt: number, _d: number, detectionRange: number) {
  // If neutral faction, defer entirely to ambient director behavior loop
  const provokedByPlayer = !!e._lastPlayerHitAt && performance.now() - e._lastPlayerHitAt < C.ENEMIES.PLAYER_HIT_WINDOW_MS;
  if (e.faction === "neutral" && !provokedByPlayer) {
    processAmbientBehavior(e, dt);
    return;
  }

  // ── 1. Target acquisition (pure decision, effects applied here) ──────────
  const targetState = resolveNpcTargetState(e, detectionRange);
  let target = targetState.target;

  if (!target) {
    e._npcTarget = null;
    e._npcLockTimer = 0;
    e._npcHasLock = false;
    e.targetingPlayer = false;
    e.hasLockOnPlayer = false;
    e.lockOnTimer = 0;
  } else if (targetState.isNew) {
    e._npcTarget = target;
    e._npcLockTimer = 0;
    e._npcHasLock = false;
    e.targetingPlayer = false;
    e.hasLockOnPlayer = false;
    e.lockOnTimer = 0;
    if (targetState.isPlayer) {
      e.targetingPlayer = true;
      WorldAccess.queueEffect({
        type: "hostileLocking",
        payload: { x: e.x, y: e.y },
      });
    }
  }

  // ── 2. Range check (uses PREVIOUS tick lock state) ───────────────────────
  if (target) {
    const dist = Math.hypot(target.x - e.x, target.y - e.y);
    let limit = detectionRange;
    if (e._npcHasLock) limit *= C.ENEMIES.AI.DETECTION.lockOnMultiplier;
    else if (e._npcLockTimer) limit *= C.ENEMIES.AI.DETECTION.lockingMultiplier;

    if (dist > limit) {
      e._npcTarget = null;
      e.targetingPlayer = false;
      e.hasLockOnPlayer = false;
      e.lockOnTimer = 0;
      target = null;
    }
  }

  const prof = C.ENEMIES.AI.ENGAGEMENT[ENEMY_DEFS[e.type]?.engagement ?? "brawler"];

  if (target) {
    const dist = Math.hypot(target.x - e.x, target.y - e.y);
    const isPlayer = targetState.isPlayer;

    // ── 3. Lock resolution (pure computation, effects applied here) ───────
    const shipDef = SHIPS[e.type] ?? SHIPS["scout"];
    const lockTimeRequired = Math.max(
      C.ENEMIES.AI.LOCK_ON.minTime,
      C.ENEMIES.AI.LOCK_ON.baseTime - (shipDef.lockBonusTicks || 0) * C.ENEMIES.AI.LOCK_ON.perBonusTickReduction,
    );

    const lockResult = computeNpcLockResult(e._npcLockTimer || 0, e._npcHasLock || false, dt, lockTimeRequired);
    e._npcLockTimer = lockResult.lockTimer;
    e._npcHasLock = lockResult.hasLock;

    if (lockResult.acquiredLock && isPlayer) {
      e.hasLockOnPlayer = true;
      WorldAccess.queueEffect({
        type: "hostileLock",
        payload: { x: e.x, y: e.y },
      });
    }

    if (isPlayer) {
      e.targetingPlayer = true;
      e.lockOnTimer = e._npcLockTimer;
    } else {
      e.targetingPlayer = false;
      e.hasLockOnPlayer = false;
      e.lockOnTimer = 0;
    }

    // ── 4. Engagement movement (pure computation, mutation applied here) ───
    const mv = computeNpcEngagementMovement(e, target, dist, dt, prof);
    if (mv.orbitDir !== undefined && mv.orbitDir !== e._orbitDir) e._orbitDir = mv.orbitDir;
    e.angle += mv.angleDelta;
    e.vx += mv.vxDelta;
    e.vy += mv.vyDelta;
    if (mv.thrustFx) e.thrustFx = true;

    // ── 5. Combat ────────────────────────────────────────────────────────────
    if (e._npcHasLock) {
      fireTurretsAt(e, target, dt, detectionRange);
    }
  } else {
    // ── 6. Idle movement (pure computation, mutation applied here) ───────────
    e.targetingPlayer = false;
    e.hasLockOnPlayer = false;
    e.lockOnTimer = 0;
    const mv = computeNpcIdleMovement(e, dt, prof);
    e.vx += mv.vxDelta;
    e.vy += mv.vyDelta;
    e.angle += mv.angleDelta;
    if (mv.thrustFx) e.thrustFx = true;
  }
}

export function triggerAttackWarningPulse(allEnemies: Enemy[], dt: number, _p?: Player) {
  let lockedCount = 0;
  let closestLocked: Enemy | null = null;
  let closestDist = Infinity;
  for (const e of allEnemies) {
    if (e.hasLockOnPlayer) {
      lockedCount++;
      const ed = Math.hypot(getState().player.x - e.x, getState().player.y - e.y);
      if (ed < closestDist) {
        closestDist = ed;
        closestLocked = e;
      }
    }
  }
  if (lockedCount > 0 && closestLocked) {
    _attackPulseTimer -= dt;
    if (_attackPulseTimer <= 0) {
      WorldAccess.queueEffect({
        type: "underAttackPulse",
        payload: { count: lockedCount, x: closestLocked.x, y: closestLocked.y },
      });
      _attackPulseTimer = C.ENEMIES.ATTACK_PULSE_INTERVAL;
    }
  } else {
    _attackPulseTimer = 0;
  }
}

export function isPlayerRef(val: unknown): val is Player {
  if (!val || typeof val !== "object") return false;
  return "shipId" in val && "pilotName" in val;
}
