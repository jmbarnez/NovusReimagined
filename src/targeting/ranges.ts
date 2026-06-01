import { C } from "../config/index.js";
import type { ShipDef } from "../data/ships.js";

export function getLockAcquireRangePx(ship: ShipDef): number {
  return C.TARGETING.LOCK.baseRangePx * ((ship.lockRangeKm || C.TARGETING.LOCK.referenceKm) / C.TARGETING.LOCK.referenceKm);
}

export function getSensorContactRangePx(ship: ShipDef): number {
  return C.TARGETING.SENSOR.baseRangePx * ((ship.sensorContactRangeKm || C.TARGETING.LOCK.referenceKm) / C.TARGETING.LOCK.referenceKm);
}

export function getPassiveScanRangePx(ship: ShipDef): number {
  return 2900 * ((ship.passiveScanRangeKm ?? 54) / 72);
}
