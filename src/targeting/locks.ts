import { PlayerAccess, getState } from "../state-access.js";
import { SHIPS } from "../data/ships.js";
import { dst } from "../utils/math.js";
import { LOCK_TIME_BASE } from "../constants.js";
import { floatText } from "../utils/fx.js";
import { t } from "../utils/i18n.js";
import { isTargetDestroyed } from "../utils/entities.js";
import { sfxLockAcquired, sfxLockLost, sfxTurretAssign } from "../audio/procedural.js";
import { C } from "../config/index.js";
import { playerHardpointRack } from "../utils/hardpoints.js";
import type { Asteroid, Enemy, WreckPiece, AutoTarget } from "../types/world.js";
import type { ComputedStats } from "../player/player-stats.js";
import type { Player } from "../state.js";
import { getSensorContactRangePx } from "./ranges.js";
import { isAsteroidTarget, isWreckPieceTarget, targetByLockId } from "./lookup.js";
import { acceptsSpecialResourceTarget, getFittedHardpointModule, isWeaponHardpointModule } from "./modules.js";
import { isGateLockId } from "../utils/warp-gates.js";

/**
 * Distance scaling for sensor scans: close targets resolve quickly, far targets
 * take noticeably longer. Maps dist/sensorRange in [0,1] to multiplier in
 * roughly [0.65, 1.4]. Returns 1 if the target is missing/sensor range is 0.
 */
function distanceLockFactor(target: Enemy | Asteroid | WreckPiece | AutoTarget, p: Player = getState().player): number {
  if (!target) return 1;
  const ship = SHIPS[p.shipId];
  const sensorRange = getSensorContactRangePx(ship) || 1;
  const d = dst(p.x, p.y, target.x, target.y);
  const t = Math.max(0, Math.min(1.1, d / sensorRange));
  return 0.65 + 0.75 * t;
}

export function computeLockTimeSec(target: Enemy | Asteroid | WreckPiece | AutoTarget, st: ComputedStats, p: Player = getState().player): number {
  const distFactor = distanceLockFactor(target, p);
  if (isGateLockId(target.id)) {
    return Math.max(0.6, C.TARGETING.ASTEROID_LOCK_TIME * 0.9) * distFactor;
  }
  if (isAsteroidTarget(target.id)) {
    return Math.max(0.6, C.TARGETING.ASTEROID_LOCK_TIME) * distFactor;
  }
  if (isWreckPieceTarget(target.id)) {
    return C.TARGETING.WRECK_PIECE_LOCK_TIME * distFactor;
  }
  const sig = (target as Enemy).sigRadius || 30;
  const mult = st.lockScanMult || 1;
  const base = LOCK_TIME_BASE * Math.pow(sig / C.TARGETING.LOCK.sigReference, C.TARGETING.LOCK.sigExponent) / Math.max(C.TARGETING.LOCK.multFloor, mult);
  return base * distFactor;
}

export function ensureLockQueue(p: Player = getState().player): void {
  if (!Array.isArray(p.lockQueue)) {
    if (p === getState().player) {
      PlayerAccess.setLockQueue([]);
    } else {
      p.lockQueue = [];
    }
  }
}

export function maxTargetLocks(p: Player = getState().player): number {
  const s = SHIPS[p.shipId];
  return Math.min(C.TARGETING.MAX_TARGET_LOCKS_CAP, Math.max(1, C.TARGETING.MAX_TARGET_LOCKS_BASE + ((s.lockBonusTicks as number) | 0)));
}

export function transversalVs(e: Enemy, p: Player = getState().player): number {
  const rx = e.x - p.x, ry = e.y - p.y;
  const r2 = rx * rx + ry * ry;
  if (r2 < 4) return 0;
  const rvx = (e.vx || 0) - p.vx, rvy = (e.vy || 0) - p.vy;
  return Math.abs(rx * rvy - ry * rvx) / Math.sqrt(r2);
}

export function syncPrimaryTargetLock(p: Player = getState().player): void {
  ensureLockQueue(p);
  for (const slot of p.lockQueue) {
    if (slot.resolving) continue;
    const t = targetByLockId(slot.id, p);
    if (t) {
      if (p === getState().player) {
        PlayerAccess.setTargetLock(t);
      } else {
        p.targetLock = t;
      }
      return;
    }
  }
  if (p === getState().player) {
    PlayerAccess.setTargetLock(null);
  } else {
    p.targetLock = null;
  }
}

function isLocalPlayer(p: Player): boolean {
  return p === getState().player;
}

function setPlayerTargetLock(p: Player, target: Player["targetLock"]): void {
  if (isLocalPlayer(p)) PlayerAccess.setTargetLock(target, p);
  else p.targetLock = target;
}

function setPlayerTurretTarget(p: Player, idx: number, targetId: string | null, playAssignSfx = false): void {
  if (isLocalPlayer(p)) {
    PlayerAccess.setTurretTarget(idx, targetId, p);
    if (playAssignSfx) sfxTurretAssign();
    return;
  }
  if (!p.turretTargets) p.turretTargets = [];
  p.turretTargets[idx] = targetId;
}

function setPlayerHighTarget(p: Player, idx: number, targetId: string | null): void {
  if (isLocalPlayer(p)) PlayerAccess.setHighTarget(idx, targetId, p);
  else {
    if (!p.highTargets) p.highTargets = [];
    p.highTargets[idx] = targetId;
  }
}

function removeLockAt(p: Player, index: number): void {
  if (isLocalPlayer(p)) PlayerAccess.spliceLockQueue(index, 1, p);
  else p.lockQueue.splice(index, 1);
}

function clearTargetAssignments(targetId: string, p: Player): void {
  if (p.turretTargets) {
    for (let i = 0; i < p.turretTargets.length; i++) {
      if (p.turretTargets[i] === targetId) setPlayerTurretTarget(p, i, null);
    }
  }
  if (p.highTargets) {
    for (let i = 0; i < p.highTargets.length; i++) {
      if (p.highTargets[i] === targetId) setPlayerHighTarget(p, i, null);
    }
  }
}

function removeLockAndAssignments(p: Player, index: number, targetId: string): void {
  removeLockAt(p, index);
  if (p.targetLock?.id === targetId) syncPrimaryTargetLock(p);
  clearTargetAssignments(targetId, p);
}

export function clearSensorLocks(p: Player = getState().player, _opts?: { suppressFrameAction?: boolean }): void {
  if (isLocalPlayer(p)) {
    PlayerAccess.setLockQueue([]);
    setPlayerTargetLock(p, null);
    if (p.turretTargets) {
      PlayerAccess.setTurretTargetsAll(Array(p.turretTargets.length).fill(null));
    }
    if (p.highTargets) {
      for (let i = 0; i < p.highTargets.length; i++) PlayerAccess.setHighTarget(i, null);
    }
  } else {
    p.lockQueue = [];
    p.targetLock = null;
    if (p.turretTargets) {
      p.turretTargets.fill(null);
    }
    if (p.highTargets) {
      p.highTargets.fill(null);
    }
  }
}

export function removeSensorLock(id: string, p: Player = getState().player, _opts?: { suppressFrameAction?: boolean }): void {
  ensureLockQueue(p);
  const nextQueue = p.lockQueue.filter((s) => s.id !== id);
  if (isLocalPlayer(p)) {
    PlayerAccess.setLockQueue(nextQueue);
  } else {
    p.lockQueue = nextQueue;
  }
  clearTargetAssignments(id, p);
  syncPrimaryTargetLock(p);
}

function tryAutoAssignSpecialTurret(id: string, isAst: boolean, isPiece: boolean, p: Player = getState().player): void {
  if (!isAst && !isPiece) return;
  const turretSlots = p.fitting?.[playerHardpointRack(p)] || [];
  const candidates: number[] = [];
  for (let i = 0; i < turretSlots.length; i++) {
    const uid = turretSlots[i];
    if (!uid) continue;
    const m = getFittedHardpointModule(p, i);
    if (!m || !acceptsSpecialResourceTarget(m, isAst, isPiece)) continue;
    if (!(p.turretPower?.[i])) continue;
    if (p.turretTargets?.[i]) continue;
    candidates.push(i);
  }
  if (candidates.length !== 1) return;
  setPlayerTurretTarget(p, candidates[0], id, true);
}

function autoFillUnboundWeaponTurrets(p: Player = getState().player): void {
  const turretSlots = p.fitting?.[playerHardpointRack(p)];
  if (!turretSlots) return;
  let firstEnemyLock: string | null = null;
  for (const slot of p.lockQueue) {
    if (slot.resolving) continue;
    if (isAsteroidTarget(slot.id) || isWreckPieceTarget(slot.id)) continue;
    firstEnemyLock = slot.id;
    break;
  }
  if (!firstEnemyLock) return;
  for (let i = 0; i < turretSlots.length; i++) {
    const uid = turretSlots[i];
    if (!uid) continue;
    const m = getFittedHardpointModule(p, i);
    if (!m || !isWeaponHardpointModule(m)) continue;
    if (!p.turretPower?.[i]) continue;
    if (p.turretTargets?.[i]) continue;
    setPlayerTurretTarget(p, i, firstEnemyLock, true);
  }
}

export function updateSensorLocks(dt: number, st: ComputedStats, p: Player = getState().player): void {
  ensureLockQueue(p);
  const ship = SHIPS[p.shipId];
  const sensorRange = getSensorContactRangePx(ship);
  const dropRange = sensorRange * C.TARGETING.SENSOR.dropRangeMultiplier;
  for (let i = p.lockQueue.length - 1; i >= 0; i--) {
    const slot = p.lockQueue[i];
    const target = targetByLockId(slot.id, p);
    if (!target || isTargetDestroyed(target)) {
      removeLockAndAssignments(p, i, slot.id);
      continue;
    }
    if (dst(p.x, p.y, target.x, target.y) > dropRange) {
      removeLockAndAssignments(p, i, slot.id);
      if (isLocalPlayer(p)) {
        sfxLockLost();
        floatText(target.x, target.y - 25, t("system.lockLost"), "#cc8844");
      }
      continue;
    }
    if (slot.resolving) {
      const nextAcc = (slot.acc || 0) + dt;
      if (isLocalPlayer(p)) PlayerAccess.updateLockQueueSlot(slot.id, { acc: nextAcc }, p);
      else slot.acc = nextAcc;
      if (nextAcc >= computeLockTimeSec(target, st, p)) {
        if (isLocalPlayer(p)) PlayerAccess.updateLockQueueSlot(slot.id, { resolving: false }, p);
        else slot.resolving = false;
        syncPrimaryTargetLock(p);
        const isAst = isAsteroidTarget(target.id);
        const isPiece = isWreckPieceTarget(target.id);
        if (isLocalPlayer(p)) {
          if (!isAst) sfxLockAcquired();
        }
        tryAutoAssignSpecialTurret(target.id, isAst, isPiece, p);
        if (!isAst && !isPiece) {
          const turretSlot = p.fireControlSlot ?? 0;
          const m = getFittedHardpointModule(p, turretSlot);
          if (m && isWeaponHardpointModule(m)) {
            if ((p.turretPower?.[turretSlot]) && !(p.turretTargets?.[turretSlot])) {
              setPlayerTurretTarget(p, turretSlot, target.id, true);
            }
          }
        }
      }
    }
  }
  autoFillUnboundWeaponTurrets(p);
}

export function requestSensorLock(id: string, p: Player = getState().player, opts?: { suppressFrameAction?: boolean }): void {
  ensureLockQueue(p);
  const i = p.lockQueue.findIndex((s) => s.id === id);
  if (i >= 0) {
    if (p.lockQueue[i]?.resolving) return;
    selectLockTarget(id, p, opts);
    return;
  }

  const target = targetByLockId(id, p);
  if (target) {
    const ship = SHIPS[p.shipId];
    const sensorRange = getSensorContactRangePx(ship);
    const dropRange = sensorRange * C.TARGETING.SENSOR.dropRangeMultiplier;
    if (dst(p.x, p.y, target.x, target.y) > dropRange) {
      if (!opts?.suppressFrameAction && typeof window !== "undefined" && isLocalPlayer(p)) {
        floatText(p.x, p.y - 38, t("system.lockFailRange"), "#cc8844");
      }
      return;
    }
  }

  while (p.lockQueue.length >= maxTargetLocks(p)) {
    if (isLocalPlayer(p)) PlayerAccess.popLockQueue(p);
    else p.lockQueue.pop();
    if (isLocalPlayer(p)) {
      floatText(p.x, p.y - 38, t("system.lockCapDropped"), "#cc8844");
    }
  }
  if (isLocalPlayer(p)) PlayerAccess.unshiftLockQueue({ id, resolving: true, acc: 0 }, p);
  else p.lockQueue.unshift({ id, resolving: true, acc: 0 });
  syncPrimaryTargetLock(p);
}

export function selectLockTarget(
  id: string,
  p: Player = getState().player,
  opts?: { suppressFrameAction?: boolean }
): void {
  ensureLockQueue(p);
  const i = p.lockQueue.findIndex((s) => s.id === id);
  if (i < 0) return;

  if (p._assignTargetId === id) {
    if (isLocalPlayer(p)) {
      PlayerAccess.setAssignTargetId(null);
    } else {
      p._assignTargetId = null;
    }
    return;
  }

  if (i > 0) {
    if (isLocalPlayer(p)) {
      const [slot] = PlayerAccess.spliceLockQueue(i, 1, p);
      if (slot) PlayerAccess.unshiftLockQueue(slot, p);
    } else {
      const [slot] = p.lockQueue.splice(i, 1);
      if (slot) p.lockQueue.unshift(slot);
    }
  }

  if (isLocalPlayer(p)) {
    PlayerAccess.setAssignTargetId(id, p);
  } else {
    p._assignTargetId = id;
  }
  syncPrimaryTargetLock(p);
}
