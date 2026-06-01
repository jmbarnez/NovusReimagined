import { PlayerAccess, getState } from "./state-access.js";
import { SHIPS, ShipDef } from "./data/ships.js";
import { MODULES, MODULE_FLAGS, ModuleDef } from "./data/modules.js";
import { dst } from "./utils/math.js";
import { curSys } from "./utils/game.js";
import { LOCK_TIME_BASE } from "./constants.js";
import { floatText } from "./utils/fx.js";
import { isTargetDestroyed } from "./utils/entities.js";
import { invalidate } from "./player/player-stats.js";
import { sfxLockAcquired, sfxLockLost, sfxTurretAssign } from "./audio/procedural.js";
import { WEAPON_PROFILES } from "./data/weaponProfiles.js";
import { C } from "./config/index.js";
import { playerHardpointRack } from "./utils/hardpoints.js";
import type { Enemy, Asteroid, WreckPiece, LockSlot } from "./types/world.js";
import type { ComputedStats } from "./player/player-stats.js";
import type { ModuleInstance } from "./types/moduleInstance.js";
import type { Player } from "./state.js";

export function isWreckPieceTarget(id: string): boolean {
  return typeof id === "string" && id.startsWith("piece-");
}

export function getWeaponTurretAtSlot(idx: number, p: Player | null = getState().player): ModuleDef | null {
  if (!p) return null;
  const uid = p.fitting?.[playerHardpointRack(p)]?.[idx];
  if (!uid) return null;
  const inst = p.moduleCargo.find(inst => inst.uid === uid);
  const m = inst ? MODULES[inst.baseId] : null;
  return m?.weaponDelivery && !MODULE_FLAGS.isMiningTurret(m) ? m : null;
}

export function resolveWeaponTurret(
  fitting?: Partial<Record<"turret" | "high" | "med" | "low", (string | null)[]>>,
  p: Player | null = getState().player,
): ModuleDef | null {
  if (!p) return null;
  const f = fitting || p.fitting;
  const hardpointSlots = f?.[playerHardpointRack(p)] ?? [];
  if (!hardpointSlots.length) return null;
  for (const uid of hardpointSlots) {
    if (!uid) continue;
    const inst = p.moduleCargo.find(inst => inst.uid === uid);
    const m = inst ? MODULES[inst.baseId] : null;
    if (m?.weaponDelivery && !MODULE_FLAGS.isMiningTurret(m)) return m;
  }
  return null;
}

export function getLockAcquireRangePx(ship: ShipDef): number {
  return C.TARGETING.LOCK.baseRangePx * ((ship.lockRangeKm || C.TARGETING.LOCK.referenceKm) / C.TARGETING.LOCK.referenceKm);
}

export function getSensorContactRangePx(ship: ShipDef): number {
  return C.TARGETING.SENSOR.baseRangePx * ((ship.sensorContactRangeKm || C.TARGETING.LOCK.referenceKm) / C.TARGETING.LOCK.referenceKm);
}

export function getPassiveScanRangePx(ship: ShipDef): number {
  return 2900 * ((ship.passiveScanRangeKm ?? 54) / 72);
}

export function isAsteroidTarget(id: string): boolean {
  return typeof id === "string" && id.startsWith("ast-");
}

export function targetByLockId(id: string, p: Player = getState().player): Enemy | Asteroid | WreckPiece | null {
  const sys = curSys(p);
  if (!sys) return null;
  let en = sys._enemyMap?.get(id);
  if (!en) {
    en = sys.enemies.find((e) => e.id === id);
    if (en) {
      if (!sys._enemyMap) sys._enemyMap = new Map();
      sys._enemyMap.set(id, en);
    }
  }
  if (en && en.alive) return en;
  let ast = sys._asteroidMap?.get(id);
  if (!ast && isAsteroidTarget(id)) {
    ast = sys.asteroids.find((a) => a.id === id);
    if (ast) {
      if (!sys._asteroidMap) sys._asteroidMap = new Map();
      sys._asteroidMap.set(id, ast);
    }
  }
  if (ast && !ast.depleted && ast.hp > 0) {
    if (!ast.name) {
      const ores = ["Iron", "Crystal", "Exotic"];
      let maxWeightIdx = 0;
      if (Array.isArray(ast.oreWeights)) {
        for (let w = 1; w < 3; w++) {
          if ((ast.oreWeights[w] || 0) > (ast.oreWeights[maxWeightIdx] || 0)) {
            maxWeightIdx = w;
          }
        }
      }
      ast.name = `${ores[maxWeightIdx]} Asteroid`;
    }
    return ast;
  }
  if (isWreckPieceTarget(id)) {
    const wreck = getState().wreckPieces.find((w) => w.id === id);
    return wreck && wreck.hp > 0 ? wreck : null;
  }
  return null;
}

export function enemyByLockId(id: string): Enemy | null {
  const sys = curSys();
  if (!sys) return null;
  const en = sys._enemyMap?.get(id);
  return en && en.alive ? en : null;
}

/**
 * Distance scaling for sensor scans: close targets resolve quickly, far targets
 * take noticeably longer. Maps dist/sensorRange ∈ [0,1] → multiplier in
 * roughly [0.65, 1.4]. Returns 1 if the target is missing/sensor range is 0.
 */
function distanceLockFactor(target: Enemy | Asteroid | WreckPiece, p: Player = getState().player): number {
  if (!target) return 1;
  const ship = SHIPS[p.shipId];
  const sensorRange = getSensorContactRangePx(ship) || 1;
  const d = dst(p.x, p.y, target.x, target.y);
  const t = Math.max(0, Math.min(1.1, d / sensorRange));
  return 0.65 + 0.75 * t;
}

export function computeLockTimeSec(target: Enemy | Asteroid | WreckPiece, st: ComputedStats, p: Player = getState().player): number {
  const distFactor = distanceLockFactor(target, p);
  if (isAsteroidTarget(target.id)) {
    // Asteroid surface scan — meaningful baseline so it isn't instant, with
    // distance scaling for big-rock surveying at long range.
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

export function enemyClassLabel(type: string): string {
  return ({ rat: "MITE", rat_drone: "MITE", drone: "DSENT", pirate: "HAC", raider: "BLITZ" } as Record<string, string>)[type] || "UNK";
}

export function computeEnemyLevel(enemy: Enemy): number {
  const hpScore = Math.min(1, (enemy.maxHp - C.TARGETING.ENEMY_LEVEL.hpScoreMin) / C.TARGETING.ENEMY_LEVEL.hpScoreRange);

  let maxDmg = 0;
  if (enemy.fitting?.turret) {
    for (const uid of enemy.fitting.turret) {
      if (!uid) continue;
      const inst = enemy.fitting._tempInstances?.find(inst => inst.uid === uid);
      const baseId = inst ? inst.baseId : uid;
      const wProf = WEAPON_PROFILES[baseId];
      if (wProf && wProf.dmg > maxDmg) maxDmg = wProf.dmg;
    }
  }
  const dmgScore = Math.min(1, (maxDmg - C.TARGETING.ENEMY_LEVEL.dmgScoreMin) / C.TARGETING.ENEMY_LEVEL.dmgScoreRange);

  const accScore   = Math.min(1, ((enemy.accuracy ?? 1.0) - C.TARGETING.ENEMY_LEVEL.accScoreMin) / C.TARGETING.ENEMY_LEVEL.accScoreRange);
  const aggroScore = Math.min(1, (enemy.aggroRange - C.TARGETING.ENEMY_LEVEL.aggroScoreMin) / C.TARGETING.ENEMY_LEVEL.aggroScoreRange);
  const spdScore   = Math.min(1, (enemy.speed ?? 0) / C.TARGETING.ENEMY_LEVEL.spdScoreMax);
  const raw = hpScore * C.TARGETING.ENEMY_LEVEL.hpWeight + dmgScore * C.TARGETING.ENEMY_LEVEL.dmgWeight + accScore * C.TARGETING.ENEMY_LEVEL.accWeight + aggroScore * C.TARGETING.ENEMY_LEVEL.aggroWeight + spdScore * C.TARGETING.ENEMY_LEVEL.spdWeight;
  return Math.max(C.TARGETING.ENEMY_LEVEL.levelMin, Math.min(C.TARGETING.ENEMY_LEVEL.levelMax, Math.round(raw * C.TARGETING.ENEMY_LEVEL.levelScale) + C.TARGETING.ENEMY_LEVEL.levelOffset));
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

export function clearSensorLocks(p: Player = getState().player, _opts?: { suppressFrameAction?: boolean }): void {
  if (p === getState().player) {
    PlayerAccess.setLockQueue([]);
    PlayerAccess.setTargetLock(null);
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
  if (p === getState().player) {
    PlayerAccess.setLockQueue(nextQueue);
    if (p.turretTargets) {
      for (let i = 0; i < p.turretTargets.length; i++) {
        if (p.turretTargets[i] === id) PlayerAccess.setTurretTarget(i, null);
      }
    }
    if (p.highTargets) {
      for (let i = 0; i < p.highTargets.length; i++) {
        if (p.highTargets[i] === id) PlayerAccess.setHighTarget(i, null);
      }
    }
  } else {
    p.lockQueue = nextQueue;
    if (p.turretTargets) {
      for (let i = 0; i < p.turretTargets.length; i++) {
        if (p.turretTargets[i] === id) p.turretTargets[i] = null;
      }
    }
    if (p.highTargets) {
      for (let i = 0; i < p.highTargets.length; i++) {
        if (p.highTargets[i] === id) p.highTargets[i] = null;
      }
    }
  }
  syncPrimaryTargetLock(p);
}

// When a lock resolves, if there is exactly one powered mining/salvager turret
// with no target assigned, auto-assign it and play a soft chime.
function tryAutoAssignSpecialTurret(id: string, isAst: boolean, isPiece: boolean, p: Player = getState().player): void {
  if (!isAst && !isPiece) return;
  const turretSlots = p.fitting?.[playerHardpointRack(p)] || [];
  const candidates: number[] = [];
  for (let i = 0; i < turretSlots.length; i++) {
    const uid = turretSlots[i];
    if (!uid) continue;
    const inst = p.moduleCargo.find(inst => inst.uid === uid);
    const m = inst ? MODULES[inst.baseId] : null;
    if (!m) continue;
    const isMiner = MODULE_FLAGS.isMiningTurret(m);
    const isSalv = MODULE_FLAGS.isSalvager(m);
    const isTractor = MODULE_FLAGS.isTractor(m);
    if (isAst && !isMiner && !isTractor) continue;
    if (isPiece && !isSalv && !isTractor) continue;
    if (!(p.turretPower?.[i])) continue;
    if (p.turretTargets?.[i]) continue;
    candidates.push(i);
  }
  if (candidates.length !== 1) return; // only auto-assign when unambiguous
  if (p === getState().player) {
    PlayerAccess.setTurretTarget(candidates[0], id);
    sfxTurretAssign();
  } else {
    if (!p.turretTargets) p.turretTargets = [];
    p.turretTargets[candidates[0]] = id;
  }
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
    const inst = p.moduleCargo.find(inst => inst.uid === uid);
    const m = inst ? MODULES[inst.baseId] : null;
    if (!m?.weaponDelivery || MODULE_FLAGS.isMiningTurret(m) || MODULE_FLAGS.isSalvager(m)) continue;
    if (!p.turretPower?.[i]) continue;
    if (p.turretTargets?.[i]) continue;
    if (p === getState().player) {
      PlayerAccess.setTurretTarget(i, firstEnemyLock);
      sfxTurretAssign();
    } else {
      if (!p.turretTargets) p.turretTargets = [];
      p.turretTargets[i] = firstEnemyLock;
    }
  }
}

export function updateSensorLocks(dt: number, st: ComputedStats, p: Player = getState().player): void {
  ensureLockQueue(p);
  const ship = SHIPS[p.shipId];
  const sensorRange = getSensorContactRangePx(ship);
  const dropRange = sensorRange * C.TARGETING.SENSOR.dropRangeMultiplier;
  for (let i = p.lockQueue.length - 1; i >= 0; i--) {
    const slot = p.lockQueue[i];
    const t = targetByLockId(slot.id, p);
    if (!t || isTargetDestroyed(t)) {
      if (p === getState().player) PlayerAccess.spliceLockQueue(i, 1);
      else p.lockQueue.splice(i, 1);
      if (p.targetLock?.id === slot.id) syncPrimaryTargetLock(p);
      if (p.turretTargets) {
        for (let j = 0; j < p.turretTargets.length; j++) {
          if (p.turretTargets[j] === slot.id) {
            if (p === getState().player) PlayerAccess.setTurretTarget(j, null);
            else p.turretTargets[j] = null;
          }
        }
      }
      if (p.highTargets) {
        for (let j = 0; j < p.highTargets.length; j++) {
          if (p.highTargets[j] === slot.id) {
            if (p === getState().player) PlayerAccess.setHighTarget(j, null);
            else p.highTargets[j] = null;
          }
        }
      }
      continue;
    }
    if (dst(p.x, p.y, t.x, t.y) > dropRange) {
      if (p === getState().player) PlayerAccess.spliceLockQueue(i, 1);
      else p.lockQueue.splice(i, 1);
      if (p === getState().player) {
        sfxLockLost();
        floatText(t.x, t.y - 25, "LOCK LOST", "#cc8844");
      }
      if (p.targetLock?.id === slot.id) syncPrimaryTargetLock(p);
      if (p.turretTargets) {
        for (let j = 0; j < p.turretTargets.length; j++) {
          if (p.turretTargets[j] === slot.id) {
            if (p === getState().player) PlayerAccess.setTurretTarget(j, null);
            else p.turretTargets[j] = null;
          }
        }
      }
      if (p.highTargets) {
        for (let j = 0; j < p.highTargets.length; j++) {
          if (p.highTargets[j] === slot.id) {
            if (p === getState().player) PlayerAccess.setHighTarget(j, null);
            else p.highTargets[j] = null;
          }
        }
      }
      continue;
    }
    if (slot.resolving) {
      const nextAcc = (slot.acc || 0) + dt;
      if (p === getState().player) PlayerAccess.updateLockQueueSlot(slot.id, { acc: nextAcc });
      else slot.acc = nextAcc;
      if (nextAcc >= computeLockTimeSec(t, st, p)) {
        if (p === getState().player) PlayerAccess.updateLockQueueSlot(slot.id, { resolving: false });
        else slot.resolving = false;
        syncPrimaryTargetLock(p);
        const isAst = isAsteroidTarget(t.id);
        const isPiece = isWreckPieceTarget(t.id);
        if (p === getState().player) {
          if (!isAst) sfxLockAcquired();
        }
        tryAutoAssignSpecialTurret(t.id, isAst, isPiece, p);
        if (!isAst && !isPiece) {
          // Auto-assign selected turret for enemies
          const turretSlot = p.fireControlSlot ?? 0;
          const slotUid = p.fitting?.[playerHardpointRack(p)]?.[turretSlot];
          const slotInst = slotUid ? p.moduleCargo.find(inst => inst.uid === slotUid) : null;
          const m = slotInst ? MODULES[slotInst.baseId] : null;
          if (m?.weaponDelivery && !MODULE_FLAGS.isMiningTurret(m) && !MODULE_FLAGS.isSalvager(m)) {
            if ((p.turretPower?.[turretSlot]) && !(p.turretTargets?.[turretSlot])) {
              if (p === getState().player) {
                PlayerAccess.setTurretTarget(turretSlot, t.id);
                sfxTurretAssign();
              } else {
                if (!p.turretTargets) p.turretTargets = [];
                p.turretTargets[turretSlot] = t.id;
              }
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

  // Guard against instant drop: ignore requests beyond sensor drop range so the
  // lock card doesn't flash and disappear.
  const target = targetByLockId(id, p);
  if (target) {
    const ship = SHIPS[p.shipId];
    const sensorRange = getSensorContactRangePx(ship);
    const dropRange = sensorRange * C.TARGETING.SENSOR.dropRangeMultiplier;
    if (dst(p.x, p.y, target.x, target.y) > dropRange) {
      if (!opts?.suppressFrameAction && typeof window !== "undefined" && p === getState().player) {
        floatText(p.x, p.y - 38, "LOCK FAIL — OUT OF RANGE", "#cc8844");
      }
      return;
    }
  }

  while (p.lockQueue.length >= maxTargetLocks(p)) {
    if (p === getState().player) PlayerAccess.popLockQueue();
    else p.lockQueue.pop();
    if (p === getState().player) {
      floatText(p.x, p.y - 38, "LOCK CAP — DROPPED TAIL", "#cc8844");
    }
  }
  if (p === getState().player) PlayerAccess.unshiftLockQueue({ id, resolving: true, acc: 0 });
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
    if (p === getState().player) {
      PlayerAccess.setAssignTargetId(null);
    } else {
      p._assignTargetId = null;
    }
    return;
  }

  if (i > 0) {
    if (p === getState().player) {
      const [slot] = PlayerAccess.spliceLockQueue(i, 1);
      if (slot) PlayerAccess.unshiftLockQueue(slot);
    } else {
      const [slot] = p.lockQueue.splice(i, 1);
      if (slot) p.lockQueue.unshift(slot);
    }
  }

  if (p === getState().player) {
    PlayerAccess.setAssignTargetId(id);
  } else {
    p._assignTargetId = id;
  }
  syncPrimaryTargetLock(p);
}

function isPlayerObj(obj: unknown): obj is Player {
  return obj !== null && typeof obj === "object" && "shipId" in obj;
}

export function turretModuleAcceptsTarget(m: ModuleDef, targetId: string): boolean {
  if (isAsteroidTarget(targetId)) {
    return !!MODULE_FLAGS.isMiningTurret(m);
  }
  if (isWreckPieceTarget(targetId)) {
    return !!MODULE_FLAGS.isSalvager(m);
  }
  return !!(m.weaponDelivery && !MODULE_FLAGS.isMiningTurret(m) && !MODULE_FLAGS.isSalvager(m));
}

export function assignModuleSlotToTarget(
  slotIdx: number,
  targetId: string | null,
  arg3?: unknown,
  arg4?: unknown
): boolean {
  let p: Player = getState().player;
  let opts: { silent?: boolean; suppressFrameAction?: boolean; clearAssign?: boolean } = {};

  if (isPlayerObj(arg3)) {
    p = arg3;
    if (arg4 && !isPlayerObj(arg4)) {
      opts = arg4 as { silent?: boolean; suppressFrameAction?: boolean; clearAssign?: boolean };
    }
  } else if (arg3) {
    opts = arg3 as { silent?: boolean; suppressFrameAction?: boolean; clearAssign?: boolean };
    if (isPlayerObj(arg4)) {
      p = arg4;
    }
  } else if (isPlayerObj(arg4)) {
    p = arg4;
  }

  if (targetId === null) {
    if (p === getState().player) {
      PlayerAccess.setTurretTarget(slotIdx, null);
    } else {
      if (!p.turretTargets) p.turretTargets = [];
      p.turretTargets[slotIdx] = null;
    }
    return true;
  }

  ensureLockQueue(p);

  const lockSlot = p.lockQueue.find((s) => s.id === targetId);
  if (!lockSlot) {
    if (!opts?.silent && typeof window !== "undefined" && p === getState().player) {
      floatText(p.x, p.y - 30, "TARGET NOT LOCKED", "#ff8844");
    }
    return false;
  }

  const target = targetByLockId(targetId, p);
  if (!target) return false;

  const uid = p.fitting?.[playerHardpointRack(p)]?.[slotIdx];
  if (!uid) return false;
  const inst = p.moduleCargo.find(inst => inst.uid === uid);
  const m = inst ? MODULES[inst.baseId] : null;
  if (!m) return false;

  if (!turretModuleAcceptsTarget(m, targetId)) {
    if (!opts?.silent && typeof window !== "undefined" && p === getState().player) {
      floatText(p.x, p.y - 30, "INVALID TARGET TYPE", "#ff8844");
    }
    return false;
  }

  if (p === getState().player) {
    PlayerAccess.setTurretTarget(slotIdx, targetId);
  } else {
    if (!p.turretTargets) p.turretTargets = [];
    p.turretTargets[slotIdx] = targetId;
  }
  return true;
}
