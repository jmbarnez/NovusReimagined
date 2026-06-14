import { initInput } from "../input/index.js";
import { initPixi, resizePixi, destroyPixi, isPixiRendererUsable } from "../pixi.js";
import { initHudOverlay } from "../ui/hud-overlay.js";
import { initGameplayPixiRenderSystems } from "./pixi-render-systems.js";

export async function ensureGameplayRenderSystems(): Promise<void> {
  if (!isPixiRendererUsable()) {
    destroyPixi();
    await initPixi();
  }

  initInput();
  initHudOverlay();
  initGameplayPixiRenderSystems();
  resizePixi();
}
