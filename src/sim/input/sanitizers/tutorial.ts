/**
 * Tutorial action sanitizers: tutorial step sync (passthrough payload) and
 * tutorial skip (primeIdx validation).
 */
import type { Player } from "../../../state.js";
import type { GameCommand } from "../../commands.js";
import { isRecord, numberPayload } from "../sanitize-helpers.js";

export function sanitizeTutorialAction(action: Record<string, unknown>): GameCommand | null {
  switch (action.type) {
    case "syncTutorialStep": {
      return isRecord(action.payload)
        ? { type: "syncTutorialStep", payload: action.payload as Player["tutorial"] }
        : null;
    }
    case "skipTutorial": {
      const primeIdx = numberPayload(action, "primeIdx");
      return primeIdx == null ? null : { type: "skipTutorial", payload: { primeIdx } };
    }
    default:
      return null;
  }
}
