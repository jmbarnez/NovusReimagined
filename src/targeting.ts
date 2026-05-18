import { G } from "./state.js";
import { SHIPS } from "./data/ships.js";
import { MODULES, MODULE_FLAGS } from "./data/modules.js";
import { dst } from "./utils/math.js";
import { curSys } from "./utils/game.js";
import { LOCK_TIME_BASE } from "./constants.js";
import { floatText } from "./utils/fx.js";
import { invalidate } from "./player/player-stats.js";
import { sfxLockAcquired, sfxLockLost, sfxTurretAssign } from "./audio/procedural.js";
import { WEAPON_PROFILES } from "./data/weaponProfiles.js";
import { C } from "./config/index.js";

export function isWreckPieceTarget(id: string): boolean {
  return typeof id === "string" && id.startsWith("piece-");
}

export function getWeaponTurretAtSlot(idx: number): any | null {
  const uid = G.P.fitting?.turret?.[idx];
  if (!uid) return null;
  const inst = G.P.moduleCargo.find(inst => inst.uid === uid);
  const m = inst ? MODULES[inst.baseId] : null;
  return m?.weaponDelivery && !MODULE_FLAGS.isMiningTurret(m) ? m : null;
}

export function resolveWeaponTurret(fitting?: any): any | null {
  const f = fitting || G.P.fitting;
  if (!f?.turret) return null;
  for (const uid of f.turret) {
    if (!uid) continue;
    const inst = G.P.moduleCargo.find(inst => inst.uid === uid);
    const m = inst ? MODULES[inst.baseId] : null;
    if (m?.weaponDelivery && !MODULE_FLAGS.isMiningTurret(m)) return m;
  }
  return null;
}

export function getLockAcquireRangePx(ship: any): number {
  return C.TARGETING.LOCK.baseRangePx * ((ship.lockRangeKm || C.TARGETING.LOCK.referenceKm) / C.TARGETING.LOCK.referenceKm);
}

export function getSensorContactRangePx(ship: any): number {
  return C.TARGETING.SENSOR.baseRangePx * ((ship.sensorContactRangeKm || C.TARGETING.LOCK.referenceKm) / C.TARGETING.LOCK.referenceKm);
}

export function isAsteroidTarget(id: string): boolean {
  return typeof id === "string" && id.startsWith("ast-");
}

export function targetByLockId(id: string): any | null {
  const sys = curSys();
  if (!sys) return null;
  const en = sys._enemyMap?.get(id);
  if (en && en.alive) return en;
  const ast = sys._asteroidMap?.get(id);
  if (ast && !ast.depleted && ast.hp > 0) return ast;
  if (isWreckPieceTarget(id)) {
    const p = G.wreckPieces.find((p) => p.id === id);
    return p && p.hp > 0 ? p : null;
  }
  return null;
}

export function enemyByLockId(id: string): any | null {
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
function distanceLockFactor(target: any): number {
  if (!target) return 1;
  const ship = SHIPS[G.P.shipId];
  const sensorRange = getSensorContactRangePx(ship) || 1;
  const d = dst(G.P.x, G.P.y, target.x, target.y);
  const t = Math.max(0, Math.min(1.1, d / sensorRange));
  return 0.65 + 0.75 * t;
}

export function computeLockTimeSec(target: any, st: any): number {
  const distFactor = distanceLockFactor(target);
  if (isAsteroidTarget(target.id)) {
    // Asteroid surface scan — meaningful baseline so it isn't instant, with
    // distance scaling for big-rock surveying at long range.
    return Math.max(0.6, C.TARGETING.ASTEROID_LOCK_TIME) * distFactor;
  }
  if (isWreckPieceTarget(target.id)) {
    return C.TARGETING.WRECK_PIECE_LOCK_TIME * distFactor;
  }
  const sig = target.sigRadius || 30;
  const mult = st.lockScanMult || 1;
  const base = LOCK_TIME_BASE * Math.pow(sig / C.TARGETING.LOCK.sigReference, C.TARGETING.LOCK.sigExponent) / Math.max(C.TARGETING.LOCK.multFloor, mult);
  return base * distFactor;
}

export function ensureLockQueue() {
  if (!Array.isArray(G.P.lockQueue)) G.P.lockQueue = [];
}

export function maxTargetLocks(): number {
  const s = SHIPS[G.P.shipId];
  return Math.min(C.TARGETING.MAX_TARGET_LOCKS_CAP, Math.max(1, C.TARGETING.MAX_TARGET_LOCKS_BASE + ((s.lockBonusTicks as number) | 0)));
}

export function enemyClassLabel(type: string): string {
  return ({ rat: "MITE", rat_drone: "MITE", drone: "DSENT", pirate: "HAC", raider: "BLITZ" } as Record<string, string>)[type] || "UNK";
}

export function computeEnemyLevel(enemy: any): number {
  const hpScore = Math.min(1, (enemy.maxHp - C.TARGETING.ENEMY_LEVEL.hpScoreMin) / C.TARGETING.ENEMY_LEVEL.hpScoreRange);

  let maxDmg = 0;
  if (enemy.fitting?.turret) {
    for (const uid of enemy.fitting.turret) {
      if (!uid) continue;
      const inst = (enemy.fitting as any)._tempInstances?.find((inst: any) => inst.uid === uid);
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

export function transversalVs(e: any): number {
  const rx = e.x - G.P.x, ry = e.y - G.P.y;
  const r2 = rx * rx + ry * ry;
  if (r2 < 4) return 0;
  const rvx = (e.vx || 0) - G.P.vx, rvy = (e.vy || 0) - G.P.vy;
  return Math.abs(rx * rvy - ry * rvx) / Math.sqrt(r2);
}

export function syncPrimaryTargetLock() {
  ensureLockQueue();
  for (const slot of G.P.lockQueue) {
    if (slot.resolving) continue;
    const t = targetByLockId(slot.id);
    if (t) {
      G.P.targetLock = t;
      return;
    }
  }
  G.P.targetLock = null;
}

export function clearSensorLocks() {
  G.P.lockQueue = [];
  G.P.targetLock = null;
  if (G.P.turretTargets) G.P.turretTargets.fill(null);
}

export function removeSensorLock(id: string) {
  ensureLockQueue();
  G.P.lockQueue = G.P.lockQueue.filter((s: any) => s.id !== id);
  if (G.P.turretTargets) {
    for (let i = 0; i < G.P.turretTargets.length; i++) {
      if (G.P.turretTargets[i] === id) G.P.turretTargets[i] = null;
    }
  }
  syncPrimaryTargetLock();
}

// When a lock resolves, if there is exactly one powered mining/salvager turret
// with no target assigned, auto-assign it and play a soft chime.
function tryAutoAssignSpecialTurret(id: string, isAst: boolean, isPiece: boolean) {
  if (!isAst && !isPiece) return;
  const turretSlots = G.P.fitting?.turret || [];
  const candidates: number[] = [];
  for (let i = 0; i < turretSlots.length; i++) {
    const uid = turretSlots[i];
    if (!uid) continue;
    const inst = G.P.moduleCargo.find(inst => inst.uid === uid);
    const m = inst ? MODULES[inst.baseId] : null;
    if (!m) continue;
    const isMiner = MODULE_FLAGS.isMiningTurret(m);
    const isSalv = MODULE_FLAGS.isSalvager(m);
    if (isAst && !isMiner) continue;
    if (isPiece && !isSalv) continue;
    if (!(G.P.turretPower?.[i])) continue;
    if (G.P.turretTargets?.[i]) continue;
    candidates.push(i);
  }
  if (candidates.length !== 1) return; // only auto-assign when unambiguous
  if (!G.P.turretTargets) G.P.turretTargets = [];
  G.P.turretTargets[candidates[0]] = id;
  sfxTurretAssign();
}

function autoFillUnboundWeaponTurrets() {
  const turretSlots = G.P.fitting?.turret;
  if (!turretSlots) return;
  let firstEnemyLock: string | null = null;
  for (const slot of G.P.lockQueue) {
    if (slot.resolving) continue;
    if (isAsteroidTarget(slot.id) || isWreckPieceTarget(slot.id)) continue;
    firstEnemyLock = slot.id;
    break;
  }
  if (!firstEnemyLock) return;
  for (let i = 0; i < turretSlots.length; i++) {
    const uid = turretSlots[i];
    if (!uid) continue;
    const inst = G.P.moduleCargo.find(inst => inst.uid === uid);
    const m = inst ? MODULES[inst.baseId] : null;
    if (!m?.weaponDelivery || MODULE_FLAGS.isMiningTurret(m) || MODULE_FLAGS.isSalvager(m)) continue;
    if (!G.P.turretPower?.[i]) continue;
    if (G.P.turretTargets?.[i]) continue;
    if (!G.P.turretTargets) G.P.turretTargets = [];
    G.P.turretTargets[i] = firstEnemyLock;
    sfxTurretAssign();
  }
}

export function updateSensorLocks(dt: number, st: any) {
  ensureLockQueue();
  const ship = SHIPS[G.P.shipId];
  const sensorRange = getSensorContactRangePx(ship);
  const dropRange = sensorRange * C.TARGETING.SENSOR.dropRangeMultiplier;
  for (let i = G.P.lockQueue.length - 1; i >= 0; i--) {
    const slot = G.P.lockQueue[i];
    const t = targetByLockId(slot.id);
    if (!t || (t.alive === false) || (t.depleted === true) || t.hp <= 0) {
      G.P.lockQueue.splice(i, 1);
      if (G.P.targetLock?.id === slot.id) syncPrimaryTargetLock();
      continue;
    }
    if (dst(G.P.x, G.P.y, t.x, t.y) > dropRange) {
      G.P.lockQueue.splice(i, 1);
      sfxLockLost();
      floatText(t.x, t.y - 25, "LOCK LOST", "#cc8844");
      if (G.P.targetLock?.id === slot.id) syncPrimaryTargetLock();
      if (G.P.turretTargets) {
        for (let j = 0; j < G.P.turretTargets.length; j++) {
          if (G.P.turretTargets[j] === slot.id) G.P.turretTargets[j] = null;
        }
      }
      if (G.P.highTargets) {
        for (let j = 0; j < G.P.highTargets.length; j++) {
          if (G.P.highTargets[j] === slot.id) G.P.highTargets[j] = null;
        }
      }
      continue;
    }
    if (slot.resolving) {
      slot.acc = (slot.acc || 0) + dt;
      if (slot.acc >= computeLockTimeSec(t, st)) {
        slot.resolving = false;
        syncPrimaryTargetLock();
        const isAst = isAsteroidTarget(t.id);
        const isPiece = isWreckPieceTarget(t.id);
        if (!isAst) sfxLockAcquired();
        tryAutoAssignSpecialTurret(t.id, isAst, isPiece);
        if (!isAst && !isPiece) {
          // Auto-assign selected turret for enemies
          const turretSlot = G.P.fireControlSlot ?? 0;
          const slotUid = G.P.fitting?.turret?.[turretSlot];
          const slotInst = slotUid ? G.P.moduleCargo.find(inst => inst.uid === slotUid) : null;
          const m = slotInst ? MODULES[slotInst.baseId] : null;
          if (m?.weaponDelivery && !MODULE_FLAGS.isMiningTurret(m) && !MODULE_FLAGS.isSalvager(m)) {
            if ((G.P.turretPower?.[turretSlot]) && !(G.P.turretTargets?.[turretSlot])) {
              if (!G.P.turretTargets) G.P.turretTargets = [];
              G.P.turretTargets[turretSlot] = t.id;
              sfxTurretAssign();
            }
          }
        }
      }
    }
  }
  autoFillUnboundWeaponTurrets();
}

export function requestSensorLock(id: string) {
  ensureLockQueue();
  const i = G.P.lockQueue.findIndex((s: any) => s.id === id);
  if (i >= 0) {
    const [slot] = G.P.lockQueue.splice(i, 1);
    G.P.lockQueue.unshift(slot);
    syncPrimaryTargetLock();
    return;
  }
  while (G.P.lockQueue.length >= maxTargetLocks()) {
    G.P.lockQueue.pop();
    floatText(G.P.x, G.P.y - 38, "LOCK CAP — DROPPED TAIL", "#cc8844");
  }
  G.P.lockQueue.unshift({ id, resolving: true, acc: 0 });
  syncPrimaryTargetLock();
}
