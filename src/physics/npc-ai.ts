import { Client, type Player } from "../state.js";
import { getState, WorldAccess } from "../state-access.js";
import { ENEMY_DEFS } from "../data/enemies.js";
import { C } from "../config/index.js";
import type { EngagementProfile } from "../config/enemies.js";
import type { Enemy } from "../types/enemy.js";
import { angleDiff } from "../utils/math.js";
import { isHostile } from "../combat/factions.js";
import { processAmbientBehavior } from "./ambient-ships.js";
import { liveEnemies } from "../utils/game.js";
import { fireTurretsAt } from "../combat/enemy-turrets.js";
import { getAiState, type EnemyAIState } from "./npcs/ai-state.js";

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
  const provokedByPlayer = !!e.lastPlayerHitAt && performance.now() - e.lastPlayerHitAt < C.ENEMIES.PLAYER_HIT_WINDOW_MS;
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

// ─── Pure AI helpers (no side effects, no mutation) ────────────────────────

interface NpcTargetResult {
  target: Enemy | Player | null;
  isNew: boolean;
  isPlayer: boolean;
}

/** Validate current target and pick a new one if needed.  Pure. */
function resolveNpcTargetState(
  e: Enemy,
  currentTarget: Enemy | Player | null,
  detectionRange: number,
): NpcTargetResult {
  const player = getState().player;
  let target = currentTarget;
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
  currentOrbitDir: 1 | -1 | undefined,
): NpcMovementDeltas {
  const targetAngle = Math.atan2(target.y - e.y, target.x - e.x);
  let angleDelta = 0;
  let vxDelta = 0;
  let vyDelta = 0;
  let thrustFx = false;
  let orbitDir: 1 | -1 | undefined = currentOrbitDir;

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
  const ai = getAiState(e.id);

  // If neutral faction, defer entirely to ambient director behavior loop
  const provokedByPlayer = !!e.lastPlayerHitAt && performance.now() - e.lastPlayerHitAt < C.ENEMIES.PLAYER_HIT_WINDOW_MS;
  if (e.faction === "neutral" && !provokedByPlayer) {
    processAmbientBehavior(e, dt);
    return;
  }

  // ── 1. Target acquisition (pure decision, effects applied here) ──────────
  const targetState = resolveNpcTargetState(e, ai.npcTarget, detectionRange);
  let target = targetState.target;

  if (!target) {
    ai.npcTarget = null;
  } else if (targetState.isNew) {
    ai.npcTarget = target;
  }

  // ── 2. Range check ───────────────────────────────────────────────────────
  if (target) {
    const dist = Math.hypot(target.x - e.x, target.y - e.y);
    if (dist > detectionRange) {
      ai.npcTarget = null;
      target = null;
    }
  }

  const prof = C.ENEMIES.AI.ENGAGEMENT[ENEMY_DEFS[e.type]?.engagement ?? "brawler"];

  if (target) {
    const dist = Math.hypot(target.x - e.x, target.y - e.y);

    // ── 3. Engagement movement (pure computation, mutation applied here) ───
    const mv = computeNpcEngagementMovement(e, target, dist, dt, prof, ai.orbitDir);
    if (mv.orbitDir !== undefined && mv.orbitDir !== ai.orbitDir) ai.orbitDir = mv.orbitDir;
    e.angle += mv.angleDelta;
    e.vx += mv.vxDelta;
    e.vy += mv.vyDelta;

    // ── 4. Combat ────────────────────────────────────────────────────────────
    fireTurretsAt(e, target, dt, detectionRange);
  } else {
    // ── 5. Idle movement (pure computation, mutation applied here) ───────────
    const mv = computeNpcIdleMovement(e, dt, prof);
    e.vx += mv.vxDelta;
    e.vy += mv.vyDelta;
    e.angle += mv.angleDelta;
  }
}

export function triggerAttackWarningPulse(_allEnemies: Enemy[], dt: number, _p?: Player) {
  let threatCount = 0;
  let closestThreat: Enemy | null = null;
  let closestDist = Infinity;

  const player = getState().player;
  const sys = getState().GALAXY[player?.sysIdx ?? 0];
  if (sys?.liveEnemies) {
    for (const e of sys.liveEnemies) {
      const ai = getAiState(e.id);
      if (ai.npcTarget !== player) continue;
      threatCount++;
      const ed = Math.hypot(player.x - e.x, player.y - e.y);
      if (ed < closestDist) {
        closestDist = ed;
        closestThreat = e;
      }
    }
  }

  if (closestThreat) {
    _attackPulseTimer -= dt;
    if (_attackPulseTimer <= 0) {
      WorldAccess.queueEffect({
        type: "underAttackPulse",
        payload: { count: threatCount, x: closestThreat.x, y: closestThreat.y },
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
