import type { Player } from "../state.js";
import { curSys } from "../utils/game.js";
import type { Station } from "../types/world.js";

export function getHub(p: Player): Station | null {
  const sys = curSys(p);
  if (!sys) return null;
  return sys.stations.find((st: Station) => st.isProcessingHub) ?? null;
}

export function updateHub(_dt: number) {
  // Background ingestion remains manual by design.
}
