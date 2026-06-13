import { getState } from "../state-access.js";
import { initInput } from "../input/index.js";
import { initPixi, resizePixi, app, _pixiReady, entityLayer, effectLayer, stationLayer } from "../pixi.js";
import { initHudOverlay } from "../ui/hud-overlay.js";
import { initPixiBackground, refreshBackground } from "./pixi-background.js";
import { initPixiParticles } from "./pixi-particles.js";
import { initPixiEntities } from "./enemy/index.js";
import { initPixiPlayer } from "./player/index.js";
import { initPixiCombat } from "./combat/index.js";
import { initPixiEffects } from "./fx/index.js";
import { initVignette } from "./pixi-vignette.js";
import { initPixiHUD } from "./pixi-hud-core.js";
import { initPixiTargetArrows } from "./pixi-target-arrows.js";
import { initPixiMaps } from "./pixi-maps.js";
import { initPixiMinimap } from "./pixi-minimap.js";
import { initPixiCelestial } from "./celestial/index.js";

export async function ensureGameplayRenderSystems(): Promise<void> {
  if (!app || !_pixiReady || !entityLayer || !effectLayer || !stationLayer) {
    await initPixi();
  }

  initInput();
  initHudOverlay();
  initPixiBackground();
  initVignette();
  initPixiParticles();
  initPixiEntities();
  initPixiPlayer();

  if (entityLayer) initPixiCombat(entityLayer);
  if (effectLayer) initPixiEffects(effectLayer);

  const player = getState().player;
  const sys = getState().GALAXY?.[player?.sysIdx ?? 0];
  if (stationLayer && sys) initPixiCelestial(stationLayer, sys);

  initPixiHUD();
  initPixiTargetArrows();
  initPixiMinimap();
  initPixiMaps();

  resizePixi();
  refreshBackground();
}
