/**
 * Docking command handlers: dock (with delivery-contract checks, station
 * offers, sensor-lock clear, invincibility) and undock (shield refill,
 * invincibility, offer clear).
 */
import type { Player } from "../../../state.js";
import { PlayerAccess } from "../../../state-access.js";
import { getDockableStation } from "../../../docking/index.js";
import { clearSensorLocks } from "../../../targeting.js";
import { getStats } from "../../../player/player-stats.js";
import { checkDeliveryContracts } from "../../../data/missions.js";
import type { GameCommand } from "../types.js";
import { refreshStationOffers } from "../station-offers.js";

export type DockingCommand = Extract<GameCommand, { type: "dock" | "undock" }>;

export function handleDockingCommand(command: DockingCommand, p: Player): void {
  switch (command.type) {
    case "dock": {
      const station = getDockableStation(p, command.payload?.stationId ?? null);
      if (!station) break;
      checkDeliveryContracts(station, p);
      refreshStationOffers(p, station.id);
      clearSensorLocks(p);
      PlayerAccess.updatePhysics({ vx: 0, vy: 0 }, p);
      PlayerAccess.setInvincible(1.5, p);
      break;
    }
    case "undock": {
      PlayerAccess.setInvincible(1.5, p);
      PlayerAccess.setShieldCd(0, p);
      const stats = getStats(p);
      if (stats.maxShield > 0) PlayerAccess.setShield(stats.maxShield, p);
      PlayerAccess.setStationOffers([], null, p);
      break;
    }
  }
}
