/**
 * Combat action sanitizers.
 */
import type { GameCommand } from "../../commands.js";
import {
  RACK_IDS,
  numberPayload,
  optionalPayloadRecord,
} from "../sanitize-helpers.js";

export function sanitizeCombatAction(action: Record<string, unknown>): GameCommand | null {
  switch (action.type) {
    case "fireSelectedTurret":
      return { type: "fireSelectedTurret" };
    case "setFireControlSlot": {
      const slot = numberPayload(action, "slot");
      return slot == null ? null : { type: "setFireControlSlot", payload: { slot } };
    }
    case "toggleSlotDefaultAction": {
      const payload = optionalPayloadRecord(action);
      if (typeof payload.rack !== "string" || !RACK_IDS.has(payload.rack)) return null;
      if (typeof payload.idx !== "number" || !Number.isFinite(payload.idx)) return null;
      return { type: "toggleSlotDefaultAction", payload: { rack: payload.rack, idx: payload.idx } };
    }
    case "setTractorTightness": {
      const value = numberPayload(action, "value");
      return value == null ? null : { type: "setTractorTightness", payload: { value } };
    }
    default:
      return null;
  }
}
