export { initPixiHUD } from "./init.js";
export { refreshHudFonts } from "./fonts.js";
export { syncPixiHUD } from "./render.js";
export { destroyPixiHUD } from "./cleanup.js";

import { AppMode } from "../../state.js";
import type { RenderSubsystem } from "../lifecycle.js";
import { initPixiHUD } from "./init.js";
import { syncPixiHUD } from "./render.js";
import { destroyPixiHUD } from "./cleanup.js";

export const hudRenderer: RenderSubsystem = {
  name: "hud",
  init: initPixiHUD,
  sync: (ctx) => {
    syncPixiHUD(ctx.width, ctx.height, ctx.now);
  },
  destroy: destroyPixiHUD,
  modes: [AppMode.SPACE],
  order: 310,
};
