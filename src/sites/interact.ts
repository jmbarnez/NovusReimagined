import { type Player } from "../state.js";
import { getState } from "../state-access.js";
import { curSys } from "../utils/game.js";
import { dst } from "../utils/math.js";

const SITE_INTERACT_RANGE = 280;

export function tryInteractSite(p: Player): boolean {
  const sys = curSys(p);
  if (!sys?.hiddenSites) return false;

  let nearest: { id: string; dist: number } | null = null;
  for (const site of sys.hiddenSites) {
    if (site.state !== "resolved" || !site.hasEncryptedContent) continue;
    if (p.completedSiteIds.includes(site.id)) continue;
    const d = dst(p.x, p.y, site.x, site.y);
    if (d > SITE_INTERACT_RANGE) continue;
    if (!nearest || d < nearest.dist) {
      nearest = { id: site.id, dist: d };
    }
  }

  if (!nearest) return false;
  if (p === getState().player) {
    void import("../ui/decryption.js").then(({ openDecryptionWindowForSite }) => {
      openDecryptionWindowForSite(nearest!.id);
    });
  }
  return true;
}
