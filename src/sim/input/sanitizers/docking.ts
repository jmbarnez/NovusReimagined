/**
 * Docking action sanitizers: dock (optional stationId) and undock (no payload).
 */
import type { GameCommand } from "../../commands.js";
import { optionalPayloadRecord } from "../sanitize-helpers.js";

export function sanitizeDockingAction(action: Record<string, unknown>): GameCommand | null {
  switch (action.type) {
    case "dock": {
      const payload = optionalPayloadRecord(action);
      return typeof payload.stationId === "string"
        ? { type: "dock", payload: { stationId: payload.stationId } }
        : { type: "dock" };
    }
    case "undock":
      return { type: "undock" };
    default:
      return null;
  }
}
