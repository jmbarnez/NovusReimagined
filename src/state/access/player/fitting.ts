import { _G, type Player } from "../../../state.js";
import type { ModuleInstance } from "../../../types/moduleInstance.js";

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

  setTurretCd(idx: number, cd: number, p: Player = _G.P) {
    if (!p.turretCds) p.turretCds = [];
    p.turretCds[idx] = cd;
  },

  setSlotHeat(rack: string, idx: number, heat: number, p: Player = _G.P) {
    if (!p.slotHeat) p.slotHeat = {};
    if (!p.slotHeat[rack]) p.slotHeat[rack] = [];
    p.slotHeat[rack][idx] = heat;
  },

  setFireControlSlot(slot: number, p: Player = _G.P) {
    p.fireControlSlot = slot;
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

  addModuleCargo(inst: ModuleInstance, p: Player = _G.P) {
    p.moduleCargo.push(inst);
  },

  setModuleCargo(cargo: Player["moduleCargo"], p: Player = _G.P) {
    p.moduleCargo = cargo;
  },

  setModuleHpAll(record: Record<string, (number | null)[]>, p: Player = _G.P) {
    p.moduleHp = record;
  },

  setTurretCdsAll(cds: number[], p: Player = _G.P) {
    p.turretCds = cds;
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

};
