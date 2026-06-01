import { SHIPS, type ShipDef } from "../data/ships.js";
import type { Rack } from "../data/modules.js";
import type { Player } from "../state.js";

/** Ship hardpoint rack: high on player hulls, turret on legacy/NPC fits. */
export type HardpointRack = "high" | "turret";

export function getHardpointRack(ship: ShipDef | string): HardpointRack {
  const s = typeof ship === "string" ? SHIPS[ship] : ship;
  if (!s) return "high";
  return (s.fitting.high ?? 0) > 0 ? "high" : "turret";
}

export function getHardpointSlotCount(ship: ShipDef | string): number {
  const s = typeof ship === "string" ? SHIPS[ship] : ship;
  if (!s) return 0;
  const rack = getHardpointRack(s);
  return s.fitting[rack] ?? 0;
}

export function isHardpointRack(rack: string): rack is HardpointRack {
  return rack === "high" || rack === "turret";
}

/** Whether a module catalog rack can be installed in a ship slot rack. */
export function moduleFitsShipRack(moduleRack: Rack, shipSlotRack: Rack): boolean {
  if (moduleRack === shipSlotRack) return true;
  if (shipSlotRack === "high" && moduleRack === "turret") return true;
  return false;
}

export function mergeLegacyTurretSlotsIntoHigh<T>(
  highSource: readonly T[] | undefined,
  turretSource: readonly T[] | undefined,
  highCount: number,
  fallback: (idx: number) => T,
): T[] {
  const combined: T[] = [];
  if (Array.isArray(highSource)) combined.push(...highSource);
  if (Array.isArray(turretSource)) combined.push(...turretSource);
  return Array.from(
    { length: Math.max(0, highCount | 0) },
    (_, idx) => combined[idx] !== undefined ? combined[idx]! : fallback(idx),
  );
}

export function moduleRackLabel(moduleRack: Rack): string {
  return moduleRack === "turret" ? "high" : moduleRack;
}

export function playerHardpointRack(p: Player): HardpointRack {
  return getHardpointRack(p.shipId);
}

export function playerHardpointSlots(p: Player): (string | null)[] {
  const rack = playerHardpointRack(p);
  return p.fitting?.[rack] ?? [];
}
