/**
 * Enemy sprite lifecycle management.
 */
import { clearEnemyTextureCaches as clearTextures } from "./bake.js";
import { destroyPixiEntityBundles } from "./render.js";

export function initPixiEntities(): void {
  // Sprites are created on demand in syncPixiEntities — nothing to do at boot.
}

/** Clear all cached enemy hull/light textures and destroy live bundles so they re-bake at the current DPR. */
export function clearEnemyTextureCachesAndBundles(): void {
  clearTextures();
  destroyPixiEntityBundles();
}

export function destroyPixiEntities(): void {
  destroyPixiEntityBundles();
}
