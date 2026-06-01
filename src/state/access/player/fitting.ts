import { _G, type Player } from "../../../state.js";
import type { ModuleInstance } from "../../../types/moduleInstance.js";
import type { LockSlot } from "../../../types/world.js";

export const playerFittingAccess = {
  setFittingSlot(rack: string, idx: number, uid: string | null, p: Player = _G.P) {
    if (!p.fitting[rack]) p.fitting[rack] = [];
    p.fitting[rack][idx] = uid;
  },

  setFittingAll(fitting: Player["fitting"], p: Player = _G.P) {
    p.fitting = fitting;
  },

  setModuleHp(rack: string, idx: number, hp: number | null, p: Player = _G.P) {
    if (!p.moduleHp[rack]) p.moduleHp[rack] = [];
    p.moduleHp[rack][idx] = hp;
  },

  setSlotActive(rack: string, idx: number, active: boolean, p: Player = _G.P) {
    if (!p.slotActive[rack]) p.slotActive[rack] = [];
    p.slotActive[rack][idx] = active;
  },

  setSlotPowerCd(rack: string, idx: number, cd: number, p: Player = _G.P) {
    if (!p.slotPowerCd) p.slotPowerCd = {};
    if (!p.slotPowerCd[rack]) p.slotPowerCd[rack] = [];
    p.slotPowerCd[rack][idx] = cd;
  },

  setSlotPowerCdAll(record: Record<string, number[]>, p: Player = _G.P) {
    p.slotPowerCd = record;
  },

  setTurretPower(idx: number, powered: boolean, p: Player = _G.P) {
    if (!p.turretPower) p.turretPower = [];
    p.turretPower[idx] = powered;
  },

  setTurretPowerCd(idx: number, cd: number, p: Player = _G.P) {
    if (!p.turretPowerCd) p.turretPowerCd = [];
    p.turretPowerCd[idx] = cd;
  },

  setTurretCd(idx: number, cd: number, p: Player = _G.P) {
    if (!p.turretCds) p.turretCds = [];
    p.turretCds[idx] = cd;
  },

  setSlotHeat(rack: string, idx: number, heat: number, p: Player = _G.P) {
    if (!p.slotHeat) p.slotHeat = {};
    if (!p.slotHeat[rack]) p.slotHeat[rack] = [];
    p.slotHeat[rack][idx] = heat;
  },

  setTargetLock(target: Player["targetLock"], p: Player = _G.P) {
    p.targetLock = target;
  },

  setLockQueue(queue: Player["lockQueue"], p: Player = _G.P) {
    p.lockQueue = queue;
  },

  setFireControlSlot(slot: number, p: Player = _G.P) {
    p.fireControlSlot = slot;
  },

  setTurretTarget(idx: number, targetId: string | null, p: Player = _G.P) {
    if (!p.turretTargets) p.turretTargets = [];
    p.turretTargets[idx] = targetId;
  },

  setShootCd(value: number, p: Player = _G.P) {
    p.shootCd = value;
  },

  setMineCd(value: number, p: Player = _G.P) {
    p.mineCd = value;
  },

  setRecoilFrames(value: number, p: Player = _G.P) {
    p.recoilFrames = value;
  },

  setAssignTargetId(id: string | null, p: Player = _G.P) {
    p._assignTargetId = id;
  },

  setHighTarget(idx: number, targetId: string | null, p: Player = _G.P) {
    if (!p.highTargets) p.highTargets = [];
    p.highTargets[idx] = targetId;
  },

  addModuleCargo(inst: ModuleInstance, p: Player = _G.P) {
    p.moduleCargo.push(inst);
  },

  setModuleCargo(cargo: Player["moduleCargo"], p: Player = _G.P) {
    p.moduleCargo = cargo;
  },

  setSlotActiveAll(record: Record<string, boolean[]>, p: Player = _G.P) {
    p.slotActive = record;
  },

  setModuleHpAll(record: Record<string, (number | null)[]>, p: Player = _G.P) {
    p.moduleHp = record;
  },

  setTurretTargetsAll(targets: (string | null)[], p: Player = _G.P) {
    p.turretTargets = targets;
  },

  setTurretCdsAll(cds: number[], p: Player = _G.P) {
    p.turretCds = cds;
  },

  setTurretPowerAll(powers: boolean[], p: Player = _G.P) {
    p.turretPower = powers;
  },

  setTurretPowerCdAll(cds: number[], p: Player = _G.P) {
    p.turretPowerCd = cds;
  },

  setSlotHeatAll(heat: Record<string, number[]>, p: Player = _G.P) {
    p.slotHeat = heat;
  },

  setModuleDurability(uid: string, value: number, p: Player = _G.P) {
    const inst = p.moduleCargo.find(i => i.uid === uid);
    if (inst) inst.durability = Math.max(0, value);
  },

  removeModuleCargo(index: number, p: Player = _G.P) {
    p.moduleCargo.splice(index, 1);
  },

  spliceLockQueue(index: number, deleteCount: number, p: Player = _G.P) {
    return p.lockQueue.splice(index, deleteCount);
  },

  unshiftLockQueue(item: LockSlot, p: Player = _G.P) {
    p.lockQueue.unshift(item);
  },

  popLockQueue(p: Player = _G.P) {
    return p.lockQueue.pop();
  },

  updateLockQueueSlot(id: string, data: Partial<LockSlot>, p: Player = _G.P) {
    const slot = p.lockQueue?.find(s => s.id === id);
    if (slot) {
      Object.assign(slot, data);
    }
  },
};
