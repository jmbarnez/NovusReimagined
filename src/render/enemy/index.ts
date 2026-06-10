export { bakeEnemyTexture, getEnemyTexture, bakeEnemyLightTextures, getEnemyLightTextures, lightDirIndex } from "./bake.js";
export { syncPixiEntities, _bundles } from "./render.js";
export { initPixiEntities, refreshEntityFonts, clearEnemyTextureCachesAndBundles as clearEnemyTextureCaches, _nameStyle, _levelStyle, _speechStyle } from "./lifecycle.js";

import { AppMode } from "../../state.js";
import type { RenderSubsystem } from "../lifecycle.js";
import { initPixiEntities, clearEnemyTextureCachesAndBundles } from "./lifecycle.js";
import { syncPixiEntities } from "./render.js";

export const entitiesRenderer: RenderSubsystem = {
  name: "entities",
  init: initPixiEntities,
  sync: (ctx) => {
    syncPixiEntities(ctx.alpha, ctx.now);
  },
  destroy: clearEnemyTextureCachesAndBundles,
  modes: [AppMode.SPACE],
  order: 100,
};
