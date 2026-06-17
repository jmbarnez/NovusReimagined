import { type Player } from "../../state.js";
import { getState } from "../../state-access.js";
import { addTrailSegment } from "../../utils/entities.js";
import { liveEnemiesInSys, activePlayersInSys, nearestPlayerInSys } from "../../utils/game.js";
import { ENEMY_DEFS } from "../../data/enemies.js";
import {
  ENEMY_AMBIENT_DRAG,
  ENEMY_MIN_DIST_HOME_STATION,
  ENEMY_MIN_DIST_NONHOME_STATION,
} from "../../constants.js";
import { C } from "../../config/index.js";
import type { Enemy } from "../../types/enemy.js";
import type { Asteroid } from "../../types/asteroid.js";
import { type SpatialGrid, type SpatialQueryResult } from "../../utils/spatial.js";
import { processNpcBehavior, triggerAttackWarningPulse } from "../npc-ai.js";
import { getAiState } from "./ai-state.js";

const _qOut: SpatialQueryResult<Enemy>[] = [];
const _astOut: SpatialQueryResult<Asteroid>[] = [];

function updateNpcMovementAndSeparation(
  e: Enemy,
  dt: number,
  enemyDecay: number,
  grid: SpatialGrid | null,
) {
  e.px = e.x;
  e.py = e.y;
  e.prevAngle = e.angle;

  if (e.vx || e.vy) {
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.vx *= enemyDecay;
    e.vy *= enemyDecay;
    if (Math.abs(e.vx) < 0.5 && Math.abs(e.vy) < 0.5) {
      e.vx = 0;
      e.vy = 0;
    }
  }

  if (!grid) return;

  _qOut.length = 0;
  grid.query<Enemy>(e.x, e.y, C.ENEMIES.AI.GRID_QUERY_RADIUS, "enemy", _qOut);
  let sepX = 0;
  let sepY = 0;
  for (let i = 0; i < _qOut.length; i++) {
    const n = _qOut[i];
    if (n.id === e.id || n.dist < 1) continue;
    const force = (C.ENEMIES.AI.SEPARATION_DISTANCE - n.dist) / C.ENEMIES.AI.SEPARATION_DISTANCE;
    if (force <= 0) continue;
    sepX -= (n.dx / n.dist) * force;
    sepY -= (n.dy / n.dist) * force;
  }

  const sepMag = Math.hypot(sepX, sepY);
  if (sepMag > 0) {
    const mag = Math.min(sepMag, C.ENEMIES.AI.SEPARATION_MAG_CAP);
    e.vx += (sepX / sepMag) * mag * C.ENEMIES.AI.SEPARATION_FORCE_SCALE * dt;
    e.vy += (sepY / sepMag) * mag * C.ENEMIES.AI.SEPARATION_FORCE_SCALE * dt;
  }

  // Asteroid avoidance: steer around rocks using a velocity look-ahead probe
  // so the enemy curves clear before the physical collision resolver kicks in.
  const avoidance = C.ENEMIES.AI.AVOIDANCE;
  const enemyRadius = ENEMY_DEFS[e.type]?.colRadius ?? e.sigRadius ?? 18;
  const probeX = e.x + e.vx * avoidance.LOOKAHEAD_TIME;
  const probeY = e.y + e.vy * avoidance.LOOKAHEAD_TIME;
  _astOut.length = 0;
  grid.query<Asteroid>(probeX, probeY, enemyRadius + avoidance.QUERY_PADDING, "asteroid", _astOut);
  let avX = 0;
  let avY = 0;
  for (let i = 0; i < _astOut.length; i++) {
    const a = _astOut[i];
    if (a.dist < 1) continue;
    const avoidRadius = enemyRadius + a.radius + avoidance.AVOID_PADDING;
    const force = (avoidRadius - a.dist) / avoidRadius;
    if (force <= 0) continue;
    avX -= (a.dx / a.dist) * force;
    avY -= (a.dy / a.dist) * force;
  }

  const avMag = Math.hypot(avX, avY);
  if (avMag > 0) {
    const mag = Math.min(avMag, avoidance.MAG_CAP);
    e.vx += (avX / avMag) * mag * avoidance.FORCE_SCALE * dt;
    e.vy += (avY / avMag) * mag * avoidance.FORCE_SCALE * dt;
  }
}

function applyNpcStationEvasion(e: Enemy, dt: number, sysIdx: number) {
  if (e.faction === "neutral" || e.type === "drone") return;
  const sys = getState().GALAXY[sysIdx];
  if (!sys?.stations) return;
  for (const st of sys.stations) {
    const sdx = e.x - st.x;
    const sdy = e.y - st.y;
    const sd = Math.hypot(sdx, sdy);
    const safe = st.safeRadius ?? (st.isHome ? ENEMY_MIN_DIST_HOME_STATION : ENEMY_MIN_DIST_NONHOME_STATION);
    if (sd >= safe || sd <= 1) continue;
    const push = (safe - sd) / safe;
    e.vx += (sdx / sd) * push * 400 * dt;
    e.vy += (sdy / sd) * push * 400 * dt;
  }
}

function spawnNpcTrail(e: Enemy) {
  const speed = Math.hypot(e.vx || 0, e.vy || 0);
  if (speed <= 12) return;
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

export function updateNpcs(dt: number, sysIdx: number, localPlayer: Player | null) {
  const grid = getState().spatialGrid;
  const allEnemies = liveEnemiesInSys(sysIdx);
  const playersInSys = activePlayersInSys(sysIdx);
  const enemyDecay = Math.pow(ENEMY_AMBIENT_DRAG, dt);

  for (const e of allEnemies) {
    updateNpcMovementAndSeparation(e, dt, enemyDecay, grid);
    applyNpcStationEvasion(e, dt, sysIdx);

    const nearest = nearestPlayerInSys(sysIdx, e.x, e.y);
    const distanceToPlayer = nearest
      ? Math.hypot(nearest.x - e.x, nearest.y - e.y)
      : localPlayer && localPlayer.sysIdx === sysIdx
        ? Math.hypot(localPlayer.x - e.x, localPlayer.y - e.y)
        : Infinity;
    let detectionRange = e.aggroRange || C.ENEMIES.AI.DETECTION.baseAggroRange;
    const ai = getAiState(e.id);
    if (ai.hasLockOnPlayer) detectionRange *= C.ENEMIES.AI.DETECTION.lockOnMultiplier;
    else if (ai.targetingPlayer) detectionRange *= C.ENEMIES.AI.DETECTION.lockingMultiplier;

    processNpcBehavior(e, dt, distanceToPlayer, detectionRange);
    spawnNpcTrail(e);
  }

  const pulsePlayer = localPlayer && localPlayer.sysIdx === sysIdx ? localPlayer : playersInSys[0] ?? null;
  if (pulsePlayer) {
    triggerAttackWarningPulse(allEnemies, dt, pulsePlayer);
  }
}
