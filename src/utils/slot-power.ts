import type { Player } from "../state.js";
import { PlayerAccess } from "../state-access.js";
import { isHardpointRack } from "./hardpoints.js";

/** Whether the player intends this slot to be powered (may still be cycling). */
export function isSlotPoweredOn(rack: string, idx: number, p: Player): boolean {
  if (isHardpointRack(rack)) return p.turretPower?.[idx] ?? false;
  return p.slotActive?.[rack]?.[idx] ?? false;
}

/** Seconds remaining on the power-up / power-down cycle. */
export function getSlotPowerCd(rack: string, idx: number, p: Player): number {
  if (isHardpointRack(rack)) return p.turretPowerCd?.[idx] ?? 0;
  return p.slotPowerCd?.[rack]?.[idx] ?? 0;
}

export function setSlotPowerCd(rack: string, idx: number, cd: number, p: Player): void {
  if (isHardpointRack(rack)) PlayerAccess.setTurretPowerCd(idx, cd, p);
  else PlayerAccess.setSlotPowerCd(rack, idx, cd, p);
}

/** True when powered and the cycle has finished — module effects are live. */
export function isSlotOnline(rack: string, idx: number, p: Player): boolean {
  return isSlotPoweredOn(rack, idx, p) && getSlotPowerCd(rack, idx, p) <= 0;
}
