import { MODULES, MODULE_FLAGS, type ModuleDef, type Rack } from "../data/modules.js";
import { playerHardpointRack } from "../utils/hardpoints.js";
import type { Player } from "../state.js";
import { getInstance } from "../utils/items.js";

type FittingLayout = Partial<Record<Rack, (string | null)[]>>;

export function getFittedHardpointModule(
  p: Player,
  slotIdx: number,
  fitting: FittingLayout = p.fitting,
): ModuleDef | null {
  const uid = fitting[playerHardpointRack(p)]?.[slotIdx];
  if (!uid) return null;
  const inst = p.moduleCargo.find((candidate) => candidate.uid === uid);
  return inst ? MODULES[inst.baseId] ?? null : null;
}

export function findFirstWeaponHardpointModule(
  p: Player,
  fitting: FittingLayout = p.fitting,
): ModuleDef | null {
  const hardpointSlots = fitting[playerHardpointRack(p)] ?? [];
  for (let i = 0; i < hardpointSlots.length; i++) {
    const moduleDef = getFittedHardpointModule(p, i, fitting);
    if (moduleDef && isWeaponHardpointModule(moduleDef)) return moduleDef;
  }
  return null;
}

export function isWeaponHardpointModule(moduleDef: ModuleDef): boolean {
  return !!moduleDef.weaponDelivery && !MODULE_FLAGS.isMiningTurret(moduleDef) && !MODULE_FLAGS.isSalvager(moduleDef);
}

export function resolveWeaponTurret(fitting: FittingLayout, p: Player): ModuleDef | null {
  const hardpointSlots = fitting[playerHardpointRack(p)] ?? [];
  for (let i = 0; i < hardpointSlots.length; i++) {
    const uid = hardpointSlots[i];
    if (!uid) continue;
    const inst = getInstance(uid, p);
    if (!inst) continue;
    const m = MODULES[inst.baseId];
    if (m && isWeaponHardpointModule(m)) return m;
  }
  return null;
}

export function getWeaponTurretAtSlot(idx: number, p: Player): ModuleDef | null {
  return getFittedHardpointModule(p, idx);
}

export function acceptsSpecialResourceTarget(moduleDef: ModuleDef, isAsteroid: boolean, isWreckPiece: boolean): boolean {
  if (isAsteroid) return MODULE_FLAGS.isMiningTurret(moduleDef) || MODULE_FLAGS.isTractor(moduleDef);
  if (isWreckPiece) return MODULE_FLAGS.isSalvager(moduleDef) || MODULE_FLAGS.isTractor(moduleDef);
  return false;
}
