import type { Player } from "../state.js";
import type { ModuleInstance } from "../types/moduleInstance.js";

export const ION_BOOST_MODULE_ID = "me-ab1";

function moduleInstanceForUid(
  p: Player,
  uid: string,
  cargoMap?: ReadonlyMap<string, ModuleInstance>,
): ModuleInstance | null {
  const mapped = cargoMap?.get(uid);
  if (mapped) return mapped;
  return p.moduleCargo?.find((inst) => inst.uid === uid) ?? null;
}

export function getIonBoostModuleState(
  p: Player,
  cargoMap?: ReadonlyMap<string, ModuleInstance>,
): { fitted: boolean; online: boolean; slotIdx: number; uid: string | null } {
  const medSlots = p.fitting?.med ?? [];
  for (let i = 0; i < medSlots.length; i++) {
    const uid = medSlots[i];
    if (!uid) continue;
    const inst = moduleInstanceForUid(p, uid, cargoMap);
    if (inst?.baseId !== ION_BOOST_MODULE_ID) continue;
    const online = inst.durability > 0;
    return { fitted: true, online, slotIdx: i, uid };
  }
  return { fitted: false, online: false, slotIdx: -1, uid: null };
}
