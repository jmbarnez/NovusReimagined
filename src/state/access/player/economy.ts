/**
 * Player economy state access.
 *
 * Composed from focused sub-modules, each owning a slice of the player's
 * economic state:
 * - {@link playerResourcesAccess} — credits, ammo, ore, loot, components
 * - {@link playerCargoAccess} — mixed-ore and bulk material cargo
 * - {@link playerContractsAccess} — mission contracts and station offers
 * - {@link playerCraftingAccess} — craft queue, blueprints, hub output
 * - {@link playerRefineryStorageAccess} — refinery storage, alloy codex, hub deposit
 *
 * The composed {@link playerEconomyAccess} object is spread into
 * `PlayerAccess` by `src/state/access/player.ts`. Method cross-references
 * (e.g. hub-deposit material helpers delegating to refinery-storage paths)
 * are resolved via direct function calls within `refinery-storage.ts` rather
 * than `this`, so spreading is safe.
 */
import { playerResourcesAccess } from "./economy/resources.js";
import { playerCargoAccess } from "./economy/cargo.js";
import { playerContractsAccess } from "./economy/contracts.js";
import { playerCraftingAccess } from "./economy/crafting.js";
import { playerRefineryStorageAccess } from "./economy/refinery-storage.js";

export const playerEconomyAccess = {
  ...playerResourcesAccess,
  ...playerCargoAccess,
  ...playerContractsAccess,
  ...playerCraftingAccess,
  ...playerRefineryStorageAccess,
};
