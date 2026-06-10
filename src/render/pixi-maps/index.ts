export { pixiMapState } from "./state.js";
export { invalidatePixiMapBounds, getPixiMapViewportBounds, syncMapWindowBounds } from "./viewport.js";
export { initPixiMaps } from "./init.js";
export { syncPixiSystemMap } from "./render.js";
export { drawPixiSystemMapCanvasOverlays } from "./overlays.js";
export { destroyPixiMaps } from "./cleanup.js";

import { AppMode } from "../../state.js";
import type { RenderSubsystem } from "../lifecycle.js";
import { initPixiMaps } from "./init.js";
import { syncPixiSystemMap } from "./render.js";
import { destroyPixiMaps } from "./cleanup.js";

export const systemMapRenderer: RenderSubsystem = {
  name: "systemMap",
  init: initPixiMaps,
  sync: (ctx) => {
    if (ctx.mapBounds) {
      syncPixiSystemMap(ctx.mapBounds.width, ctx.mapBounds.height, ctx.now);
    }
  },
  destroy: destroyPixiMaps,
  modes: [AppMode.SPACE],
  order: 280,
};
