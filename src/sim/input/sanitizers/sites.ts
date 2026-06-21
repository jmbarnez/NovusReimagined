/**
 * Site interaction action sanitizers: site interaction (no payload) and site
 * completion (with payload/integrity/partial validation).
 */
import type { GameCommand } from "../../commands.js";
import { optionalPayloadRecord } from "../sanitize-helpers.js";

export function sanitizeSitesAction(action: Record<string, unknown>): GameCommand | null {
  switch (action.type) {
    case "interactSite":
      return { type: "interactSite" };
    case "completeSite": {
      const payload = optionalPayloadRecord(action);
      if (typeof payload.siteId !== "string") return null;
      if (typeof payload.payload !== "number" || typeof payload.integrity !== "number") return null;
      return {
        type: "completeSite",
        payload: {
          siteId: payload.siteId,
          payload: payload.payload,
          integrity: payload.integrity,
          partial: payload.partial === true,
        },
      };
    }
    default:
      return null;
  }
}
