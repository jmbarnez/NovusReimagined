import { Client } from "../state.js";
import { tutorialKey } from "../data/tutorial-controls.js";

export function canModifyFitting(): { ok: boolean; reason?: string } {
  if (Client.stationOpen) return { ok: true };
  return {
    ok: false,
    reason: `Dock at a station (${tutorialKey("dock")}) and open the Hangar to modify your fitting.`,
  };
}
