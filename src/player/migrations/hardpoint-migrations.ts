import type { Player } from "../../state.js";
import { SHIPS } from "../../data/ships.js";
import { RACK_TYPES } from "../../constants.js";
import { mergeLegacyTurretSlotsIntoHigh, playerHardpointRack } from "../../utils/hardpoints.js";

function defaultFitting(shipId: string): Record<string, (string | null)[]> {
  const s = SHIPS[shipId];
  const out: Record<string, (string | null)[]> = {};
  for (const r of RACK_TYPES) out[r] = Array(s.fitting[r] || 0).fill(null);
  return out;
}

function copyPaddedArray<T>(prev: T[] | undefined, length: number, fallback: (idx: number) => T): T[] {
  return Array.from({ length }, (_, idx) => prev?.[idx] ?? fallback(idx));
}

export function normalizeHardpointArrays(p: Player): void {
  const hardpointCount = p.fitting?.[playerHardpointRack(p)]?.length ?? 0;
  const highCount = p.fitting?.high?.length ?? 0;
  p.turretTargets = copyPaddedArray(p.turretTargets, hardpointCount, () => null);
  p.highTargets = copyPaddedArray(p.highTargets, highCount, () => null);
  p.turretCds = copyPaddedArray(p.turretCds, hardpointCount, () => 0);
  p.turretPower = copyPaddedArray(p.turretPower, hardpointCount, () => false);
  p.turretPowerCd = copyPaddedArray(p.turretPowerCd, hardpointCount, () => 0);
}

export function migrateLegacyHardpointFit(p: Player): void {
  if (playerHardpointRack(p) !== "high") return;
  const legacyTurretSlots = Array.isArray(p.fitting?.turret) ? p.fitting.turret : [];
  if (legacyTurretSlots.length === 0) return;
  const highCount = SHIPS[p.shipId]?.fitting.high ?? 0;
  p.fitting.high = mergeLegacyTurretSlotsIntoHigh(p.fitting?.high, legacyTurretSlots, highCount, () => null);
  p.fitting.turret = [];
  if (p.moduleHp && typeof p.moduleHp === "object") {
    p.moduleHp.high = mergeLegacyTurretSlotsIntoHigh(p.moduleHp.high, p.moduleHp.turret, highCount, () => null);
    p.moduleHp.turret = [];
  }
  if (p.slotActive && typeof p.slotActive === "object") {
    p.slotActive.high = mergeLegacyTurretSlotsIntoHigh(p.slotActive.high, p.slotActive.turret, highCount, () => true);
    p.slotActive.turret = [];
  }
}

export function applyStarterTrainingFit(p: Player): void {
  const hasRegressedStarterFit =
    p.fitting?.turret?.includes("start-tu-civ-cannon") ||
    p.fitting?.high?.includes("start-tu-civ-cannon") ||
    p.fitting?.med?.includes("start-me-ab1") ||
    p.fitting?.low?.includes("start-tu-civ-scanner");
  if (!p.tutorial?.active || p.tutorial.completed || !hasRegressedStarterFit) return;
  const fit = defaultFitting(p.shipId);
  fit.high[0] = "start-tu-civ-miner";
  fit.high[1] = "start-tu-tractor";
  p.fitting = fit;
  const hardpointCount = fit[playerHardpointRack(p)]?.length ?? 0;
  p.turretTargets = Array(hardpointCount).fill(null);
  p.highTargets = Array(fit.high?.length ?? 0).fill(null);
  p.turretCds = Array(hardpointCount).fill(0);
  p.turretPower = Array(hardpointCount).fill(false);
  p.turretPowerCd = Array(hardpointCount).fill(0);
  p.moduleHp = {
    turret: Array(fit.turret.length).fill(null),
    high: Array(fit.high?.length ?? 0).fill(null),
    med: Array(fit.med?.length ?? 0).fill(null),
    low: Array(fit.low?.length ?? 0).fill(null),
  };
  p.slotActive = {
    turret: Array(fit.turret.length).fill(true),
    high: Array(fit.high?.length ?? 0).fill(true),
    med: Array(fit.med?.length ?? 0).fill(true),
    low: Array(fit.low?.length ?? 0).fill(true),
  };
}
