import type { Player } from "../state.js";
import { MODULES } from "../data/modules.js";
import { C } from "../config/index.js";
import type { ModuleInstance } from "../types/moduleInstance.js";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function moduleInstanceForUid(
  p: Player,
  uid: string,
  cargoMap?: ReadonlyMap<string, ModuleInstance>,
): ModuleInstance | null {
  const mapped = cargoMap?.get(uid);
  if (mapped) return mapped;
  return p.moduleCargo?.find((inst) => inst.uid === uid) ?? null;
}

export function thermalReserveRatio(heat: number): number {
  const min = C.PHYSICS.SHIP.boostAssistHeatMin;
  const max = C.PHYSICS.SHIP.boostAssistHeatMax;
  return clamp01((clamp01(heat) - min) / Math.max(0.001, max - min));
}

export function hasOnlineAfterburnerCoupler(
  p: Player,
  cargoMap?: ReadonlyMap<string, ModuleInstance>,
): boolean {
  const medSlots = p.fitting?.med ?? [];
  for (let i = 0; i < medSlots.length; i++) {
    const uid = medSlots[i];
    if (!uid) continue;
    const inst = moduleInstanceForUid(p, uid, cargoMap);
    if (inst?.baseId !== "me-ab1") continue;
    if (!MODULES[inst.baseId]) continue;
    if (inst.durability <= 0) return false;
    return p.slotActive?.med?.[i] ?? true;
  }
  return false;
}

export function thermalAfterburnerBoostBonus(heat: number, afterburnerOnline: boolean): {
  ratio: number;
  thrustBonus: number;
  speedBonus: number;
} {
  const ratio = afterburnerOnline ? thermalReserveRatio(heat) : 0;
  return {
    ratio,
    thrustBonus: ratio * C.PHYSICS.SHIP.boostThermalThrustBonus,
    speedBonus: ratio * C.PHYSICS.SHIP.boostThermalSpeedBonus,
  };
}
