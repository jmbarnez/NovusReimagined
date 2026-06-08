import { Client, type Player } from "../state.js";
import { PlayerAccess, getState } from "../state-access.js";
import { getStats } from "../player/player-stats.js";
import { getSensorContactRangePx } from "../targeting.js";
import { C } from "../config/index.js";
import { SHIPS } from "../data/ships.js";
import { MODULES } from "../data/modules.js";
import { isSlotOnline } from "../utils/slot-power.js";
import { getInstance } from "../utils/items.js";
import { isHeadlessServer } from "../physics/net-input.js";

const SCAN_PULSE_MS = 3500;

export function getScanPulseRemainingMs(now: number = Date.now(), p: Player): number {
  const active = p.activeScan;
  if (!active) return 0;
  return Math.max(0, active.startedAt + SCAN_PULSE_MS - now);
}

export function getActiveScannerIndex(p: Player): number {
  const fitting = p.fitting;
  for (const rack of ["low", "med"] as const) {
    const slots = fitting[rack] || [];
    for (let i = 0; i < slots.length; i++) {
      const uid = slots[i];
      if (!uid) continue;
      const inst = getInstance(uid, p);
      if (!inst || inst.durability <= 0) continue;
      const m = MODULES[inst.baseId];
      if (m?.isScanner && isSlotOnline(rack, i, p)) return i;
    }
  }
  return -1;
}

/** Tighter scan cone = longer reach (replaces legacy focus mode). */
export function getConeRangeMult(coneDeg: number): number {
  if (coneDeg <= 15) return 1.4;
  if (coneDeg <= 45) return 1.25;
  if (coneDeg <= 90) return 1.0;
  return 0.75;
}

/** Cap cost for an active scan burst, scaled by cone tightness. */
export function getScanEnergyCost(coneDeg: number): number {
  if (coneDeg <= 15) return 14;
  if (coneDeg <= 45) return 12;
  if (coneDeg <= 90) return 10;
  return 8;
}

export function getScanRangePx(p: Player): number {
  const ship = SHIPS[p.shipId];
  const stats = getStats(p);
  const baseRange = getSensorContactRangePx(ship) * stats.scanRange;
  const scaled = baseRange * getConeRangeMult(p.scannerConeDeg);
  if (p.sysIdx >= 1) {
    return Math.min(scaled, C.WORLD.MAP.surveyRangeCapPx);
  }
  return scaled;
}

export function getMapScannerStrength01(p: Player): number {
  return Math.max(0, Math.min(1, p.mapScannerStrength ?? 0.5));
}

/** Interpolated multiplier for cap drain from strength dial (0–1). */
export function getMapScannerDrainMult(p: Player): number {
  const t = getMapScannerStrength01(p);
  const { drainMin, drainMax } = C.SCANNING.MAP_STRENGTH;
  return drainMin + t * (drainMax - drainMin);
}

export function getMapScannerDrainPerSec(p: Player): number {
  return C.SCANNING.MAP_DRAIN.basePerSec * getMapScannerDrainMult(p);
}

/** Signature multiplier while map scanner is emitting. */
export function getMapScannerSignatureMult(p: Player): number {
  const t = getMapScannerStrength01(p);
  const { signatureMin, signatureMax } = C.SCANNING.MAP_STRENGTH;
  return signatureMin + t * (signatureMax - signatureMin);
}

export function isMapScannerEmitting(p: Player): boolean {
  if (!p.mapScannerActive) return false;
  if (isHeadlessServer()) return true;
  if (p !== getState().player) return true;
  return !!(Client.showMap && Client.showSystemMap);
}

export function getEffectiveSignatureRadius(p: Player): number {
  const ship = SHIPS[p.shipId];
  const base = ship?.signatureRadius ?? 45;
  if (!isMapScannerEmitting(p)) return base;
  return Math.round(base * getMapScannerSignatureMult(p));
}

/** Strength dial step index 0 … MAP_STRENGTH_STEPS - 1. */
export function mapScannerStrengthStepIndex(p: Player): number {
  const steps = C.SCANNING.MAP_STRENGTH_STEPS;
  return Math.round(getMapScannerStrength01(p) * (steps - 1));
}

export function setMapScannerStrengthFromStep(step: number, p: Player): void {
  const steps = C.SCANNING.MAP_STRENGTH_STEPS;
  const clamped = Math.max(0, Math.min(steps - 1, step));
  PlayerAccess.setMapScannerStrength(clamped / Math.max(1, steps - 1), p);
}

export function updateMapScanner(dt: number, p: Player): void {
  if (!isHeadlessServer() && p === getState().player && (!Client.showMap || !Client.showSystemMap)) {
    if (p.mapScannerActive) PlayerAccess.setMapScannerActive(false, p);
    return;
  }
  if (!p.mapScannerActive) return;

  if (getActiveScannerIndex(p) === -1) {
    PlayerAccess.setMapScannerActive(false, p);
    return;
  }

  const drain = getMapScannerDrainPerSec(p) * dt;
  if (p.energy < drain) {
    PlayerAccess.setMapScannerActive(false, p);
    return;
  }
  PlayerAccess.setEnergy(p.energy - drain, p);
}
