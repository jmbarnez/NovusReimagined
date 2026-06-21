/**
 * Wreck piece and salvage pickup lifecycle helpers.
 *
 * These are not pooled — they are lower-churn than bullets/particles and have
 * irregular lifetimes (wrecks persist until salvaged or culled).
 */
import { _G } from "../../state.js";
import type { WreckPiece, SalvagePickup } from "../../types/system.js";
import type { ModuleInstance } from "../../types/moduleInstance.js";
import { generateId } from "./id.js";

export type WreckPieceConfig = Partial<WreckPiece> & { x: number; y: number };

export function addWreckPiece(piece: WreckPieceConfig) {
  if (!piece.id) piece.id = `piece-${generateId()}`;
  _G.wreckPieces.push(piece as WreckPiece);
}

export function removeWreckPiece(index: number) {
  _G.wreckPieces.splice(index, 1);
}

export type SalvagePickupConfig = Partial<SalvagePickup> & {
  x: number;
  y: number;
  kind: SalvagePickup["kind"];
  payload: string;
  instance?: ModuleInstance;
};

export function addSalvagePickup(pickup: SalvagePickupConfig) {
  if (!pickup.id) pickup.id = `salv-${generateId()}`;
  _G.salvagePickups.push(pickup as SalvagePickup);
}

export function removeSalvagePickup(index: number) {
  _G.salvagePickups.splice(index, 1);
}

/** Clear all wreck pieces and salvage pickups (not pooled — just truncate). */
export function clearWreckAndSalvage(): void {
  _G.wreckPieces.length = 0;
  _G.salvagePickups.length = 0;
}
