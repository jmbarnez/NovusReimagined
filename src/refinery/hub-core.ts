import type { Player } from "../state.js";
import { getState } from "../state-access.js";
import type { Station } from "../types/station.js";

export function getHub(p: Player): Station | null {
  const sys = getState().GALAXY[p.sysIdx] || getState().GALAXY[0] || null;
  if (!sys) return null;
  return sys.stations.find((st: Station) => st.isProcessingHub) ?? null;
}

export function updateHub(_dt: number) {
  // Background ingestion remains manual by design.
}
