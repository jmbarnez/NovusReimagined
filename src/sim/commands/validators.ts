import { RACK_TYPES, type RackId } from "../../constants.js";
import { playerHardpointRack } from "../../utils/hardpoints.js";
import type { Player } from "../../state.js";

const RACK_SET = new Set<string>(RACK_TYPES);
const SCANNER_CONE_DEGREES = new Set<number>([180, 90, 45, 15]);

export type ScannerConeDeg = 180 | 90 | 45 | 15;

export function isRackId(value: string): value is RackId {
  return RACK_SET.has(value);
}

export function isValidSlotIndex(idx: number, rack: string, p: Player): boolean {
  return Number.isInteger(idx) && idx >= 0 && idx < (p.fitting?.[rack]?.length ?? 0);
}

export function isValidHardpointIndex(idx: number, p: Player): boolean {
  const rack = playerHardpointRack(p);
  return isValidSlotIndex(idx, rack, p);
}

export function isFiniteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

export function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

export function isScannerConeDeg(value: number): value is ScannerConeDeg {
  return SCANNER_CONE_DEGREES.has(value);
}
