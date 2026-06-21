/**
 * Scanning action sanitizers: map scanner power/cone/strength and scan pulses.
 */
import type { GameCommand } from "../../commands.js";
import { numberPayload, optionalPayloadRecord } from "../sanitize-helpers.js";

export function sanitizeScanningAction(action: Record<string, unknown>): GameCommand | null {
  switch (action.type) {
    case "setMapScannerPower": {
      const payload = optionalPayloadRecord(action);
      return { type: "setMapScannerPower", payload: { active: payload.active === true } };
    }
    case "setMapScannerCone": {
      const coneDeg = numberPayload(action, "coneDeg");
      return coneDeg === 180 || coneDeg === 90 || coneDeg === 45 || coneDeg === 15
        ? { type: "setMapScannerCone", payload: { coneDeg } }
        : null;
    }
    case "setMapScannerStrength":
    case "startScanPulse": {
      const key = action.type === "setMapScannerStrength" ? "strength" : "angleDeg";
      const value = numberPayload(action, key);
      return value == null ? null : { type: action.type, payload: { [key]: value } } as GameCommand;
    }
    default:
      return null;
  }
}
