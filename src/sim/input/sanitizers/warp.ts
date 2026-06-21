/**
 * Warp action sanitizers: system warp (optional targetIdx) and warp-gate
 * traversal (optional gateId).
 */
import type { GameCommand } from "../../commands.js";
import { numberPayload, optionalPayloadRecord } from "../sanitize-helpers.js";

export function sanitizeWarpAction(action: Record<string, unknown>): GameCommand | null {
  switch (action.type) {
    case "warp": {
      const targetIdx = numberPayload(action, "targetIdx");
      return targetIdx == null ? { type: "warp" } : { type: "warp", payload: { targetIdx } };
    }
    case "warpGate": {
      const payload = optionalPayloadRecord(action);
      return typeof payload.gateId === "string"
        ? { type: "warpGate", payload: { gateId: payload.gateId } }
        : { type: "warpGate" };
    }
    default:
      return null;
  }
}
