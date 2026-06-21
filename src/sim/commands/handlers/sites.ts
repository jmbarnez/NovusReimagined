/**
 * Site interaction command handlers: hidden-site interaction and site
 * completion (with decryption reward application).
 */
import type { Player } from "../../../state.js";
import { PlayerAccess, WorldAccess, getState } from "../../../state-access.js";
import { tryInteractSite } from "../../../sites/interact.js";
import { applyDecryptionReward } from "../../../sites/decryption-rewards.js";
import type { GameCommand } from "../types.js";
import { isFiniteNonNegative } from "../validators.js";

export type SitesCommand = Extract<GameCommand, { type: "interactSite" | "completeSite" }>;

export function handleSitesCommand(command: SitesCommand, p: Player): void {
  switch (command.type) {
    case "interactSite":
      tryInteractSite(p);
      break;
    case "completeSite": {
      if (
        !isFiniteNonNegative(command.payload.payload) ||
        !isFiniteNonNegative(command.payload.integrity)
      )
        break;
      const site = getState().GALAXY[p.sysIdx]?.hiddenSites?.find(
        (entry) => entry.id === command.payload.siteId,
      );
      if (!site) break;
      PlayerAccess.addCompletedSiteId(command.payload.siteId, p);
      WorldAccess.setHiddenSiteState(p.sysIdx, command.payload.siteId, "cleared");
      if (command.payload.payload > 0 && command.payload.integrity > 0) {
        applyDecryptionReward(site, command.payload.payload, command.payload.integrity, command.payload.partial, p);
      }
      if (command.payload.partial) {
        PlayerAccess.setEnergy(Math.max(0, p.energy - 12), p);
      }
      break;
    }
  }
}
