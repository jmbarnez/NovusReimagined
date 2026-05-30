import type { Player } from "../state.js";
import { MODULES, type ModuleDef } from "../data/modules.js";
import { getInstance } from "./items.js";
import { playerHardpointRack, type HardpointRack } from "./hardpoints.js";
import { isSlotOnline } from "./slot-power.js";

export type AssignableRack = HardpointRack;

export interface ModuleSlotRef {
  rack: AssignableRack;
  idx: number;
}

export function getFittedModuleDef(rack: AssignableRack, idx: number, p: Player): ModuleDef | null {
  const uid = p.fitting?.[rack]?.[idx];
  if (!uid) return null;
  const inst = getInstance(uid, p);
  return inst ? MODULES[inst.baseId] ?? null : null;
}

export function isModuleSlotPowered(rack: AssignableRack, idx: number, p: Player): boolean {
  return isSlotOnline(rack, idx, p);
}

export function getModuleSlotTargetId(rack: AssignableRack, idx: number, p: Player): string | null {
  return p.turretTargets?.[idx] ?? null;
}

export function forEachFittedModuleSlot(
  pred: (mod: ModuleDef) => boolean,
  fn: (ref: ModuleSlotRef, mod: ModuleDef) => void,
  p: Player,
): void {
  const rack = playerHardpointRack(p);
  const slots = p.fitting?.[rack] ?? [];
  for (let idx = 0; idx < slots.length; idx++) {
    if (!slots[idx]) continue;
    const mod = getFittedModuleDef(rack, idx, p);
    if (!mod || !pred(mod)) continue;
    fn({ rack, idx }, mod);
  }
}

export function findFirstPoweredModuleSlot(pred: (mod: ModuleDef) => boolean, p: Player): (ModuleSlotRef & { mod: ModuleDef }) | null {
  let found: (ModuleSlotRef & { mod: ModuleDef }) | null = null;
  forEachFittedModuleSlot(pred, (ref, mod) => {
    if (!isModuleSlotPowered(ref.rack, ref.idx, p)) return;
    if (!found) found = { ...ref, mod };
  }, p);
  return found;
}
