/**
 * PixiJS v8 renderer.
 *
 * Layer structure (back → front):
 *   pixi canvas (zIndex 0)
 *     screenContainer  — background stars/dust/nebula (screen-space, no camera)
 *     worldContainer   — all world-space content
 *       planetLayer    — baked planet sprites + animated moon graphics
 *       thrustLayer    — Phase 4+: thrust flame sprites (behind hull)
 *       entityLayer    — Phase 3+: enemies, player hull, asteroids, bullets
 *       effectLayer    — Phase 2+: particles, float texts, impact decals
 *     hudOverlayLayer  — screen-space Pixi HUD graphics rendered over the world
 *     vignetteSprite   — GPU vignette overlay (last app.stage child, over worldContainer)
 *   main canvas (zIndex 1, alpha:true) — Canvas 2D HUD + transitional world content
 */
import { Application, Container, ColorMatrixFilter, Rectangle, Graphics } from "pixi.js";
import "pixi.js/unsafe-eval";
import { Client } from "./state.js";
import { clearShipTextureCaches, rebuildPlayerSprites } from "./render/pixi-player.js";
import { clearEnemyTextureCaches } from "./render/pixi-entities.js";
import { clearStationTextureCaches } from "./render/pixi-stations.js";
import { LOCK_RAIL_H } from "./constants.js";
import { playRect, setViewportSize } from "./render/viewport.js";

let app: Application | null = null;
let worldContainer: Container | null = null;
let screenContainer: Container | null = null;
let hudOverlayLayer: Container | null = null;
/** Baked planet textures + animated moon Graphics — behind everything else in worldContainer. */
let planetLayer: Container | null = null;
/** Phase 3 (background): baked stations — rendered behind thrust and entity layers. */
let stationLayer: Container | null = null;
/** Phase 4+: thrust flame sprites — rendered behind entityLayer. */
let thrustLayer: Container | null = null;
/** Phase 3+: enemies, player hull, asteroids, bullets. */
let entityLayer: Container | null = null;
/** Phase 2+: particles, float texts. */
let effectLayer: Container | null = null;
/** Cinematic colour grade applied to worldContainer (attached by the background renderer). */
let worldGradeFilter: ColorMatrixFilter | null = null;
let _pixiReady = false;
/** Physical pixels per CSS pixel — set during initPixi, used by texture bakers. */
let pixiDpr = 1;

export { app, worldContainer, screenContainer, hudOverlayLayer, planetLayer, stationLayer, thrustLayer, entityLayer, effectLayer, worldGradeFilter, _pixiReady, pixiDpr };

/** Render the PixiJS stage once. Call once per game frame after updating positions. */
export function renderPixi() {
  if (!app || !_pixiReady) return;
  app.render();
}

export async function initPixi(): Promise<Application> {
  app = new Application();

  const cap = Client.settings?.renderScale ?? 2.5;
  pixiDpr = Math.min(window.devicePixelRatio || 1, cap);

  const rect = playRect();
  await app.init({
    width: rect.width,
    height: rect.height,
    resolution: pixiDpr,
    autoDensity: true,
    antialias: true,
    // Snap sprite positions to whole pixels at render time. Without this, any
    // fractional camera/world position causes texture sampling to interpolate
    // across texel boundaries, producing the "ship never looks perfectly sharp"
    // softness even when standing still. roundPixels affects position only —
    // rotation stays smooth.
    roundPixels: true,
    background: "#000000",
    backgroundAlpha: 0,
    preference: "webgl",
    // Disable auto-ticker so the game loop controls when pixi renders.
    // Call app.render() once per game frame after updating sprite positions.
    autoStart: false,
  });

  setViewportSize(rect.width, rect.height);
  _pixiReady = true;

  // Insert the PixiJS canvas behind the HUD canvas (#c, zIndex 1).
  const pixiCanvas = app.canvas as HTMLCanvasElement;
  pixiCanvas.style.position = "fixed";
  pixiCanvas.style.top = `${rect.top}px`;
  pixiCanvas.style.left = "0";
  pixiCanvas.style.zIndex = "0";
  document.body.appendChild(pixiCanvas);

  // Screen-space container comes first so it renders behind world content.
  screenContainer = new Container();
  screenContainer.label = "screen";
  app.stage.addChild(screenContainer);

  // World container: camera transform is applied each frame by the game loop.
  worldContainer = new Container();
  worldContainer.label = "world";
  app.stage.addChild(worldContainer);

  // Front-most Pixi HUD graphics layer. Used for screen-space overlays that
  // must always sit over world objects but still render in Pixi.
  hudOverlayLayer = new Container();
  hudOverlayLayer.label = "hud-overlay";
  app.stage.addChild(hudOverlayLayer);

  // Named sub-layers so phase migrations land in the right draw order.
  planetLayer = new Container();
  planetLayer.label = "planets";
  worldContainer.addChild(planetLayer);

  stationLayer = new Container();
  stationLayer.label = "stations";
  worldContainer.addChild(stationLayer);

  thrustLayer = new Container();
  thrustLayer.label = "thrust";
  worldContainer.addChild(thrustLayer);

  entityLayer = new Container();
  entityLayer.label = "entities";
  // Bold edge look is baked into each sprite's texture (thick dark stroke as
  // the first pass). A layer-level OutlineFilter was tried, but Pixi computes
  // its filter render-texture from the layer's full content bounds — at low
  // zoom that exceeds GPU texture limits and sprites get clipped.
  worldContainer.addChild(entityLayer);

  effectLayer = new Container();
  effectLayer.label = "effects";
  worldContainer.addChild(effectLayer);

  // Colour-grade filter — created here, attached/detached and tuned per-system
  // by the background renderer based on the colorGrading setting. filterArea is
  // pinned to the viewport so PixiJS skips a per-frame getBounds() on the world.
  worldGradeFilter = new ColorMatrixFilter();
  if (worldContainer) {
    worldContainer.filterArea = new Rectangle(0, 0, rect.width, rect.height);
  }

  return app;
}

export function resizePixi() {
  if (!app) return;
  const cap = Client.settings?.renderScale ?? 2.5;
  const oldDpr = pixiDpr;
  pixiDpr = Math.min(window.devicePixelRatio || 1, cap);

  const rect = playRect();
  app.renderer.resize(rect.width, rect.height);
  app.renderer.resolution = pixiDpr;
  setViewportSize(rect.width, rect.height);

  const pixiCanvas = app.canvas as HTMLCanvasElement;
  if (pixiCanvas) {
    pixiCanvas.style.top = `${rect.top}px`;
  }

  if (worldContainer) {
    worldContainer.filterArea = new Rectangle(0, 0, rect.width, rect.height);
  }
  // If DPR changed, invalidate all baked textures so they re-render at the new resolution.
  if (pixiDpr !== oldDpr) {
    clearShipTextureCaches();
    clearEnemyTextureCaches();
    clearStationTextureCaches();
    rebuildPlayerSprites();
  }
}

export function syncColorGrading(enabled: boolean) {
  if (!worldContainer || !worldGradeFilter) return;
  const filters = worldContainer.filters ?? [];
  const hasIt = filters.includes(worldGradeFilter);
  if (enabled && !hasIt) {
    worldContainer.filters = [...filters, worldGradeFilter];
  } else if (!enabled && hasIt) {
    worldContainer.filters = filters.filter((f) => f !== worldGradeFilter);
    worldGradeFilter.reset();
  }
}

export function destroyPixi() {
  if (app) {
    app.destroy(true, { children: true, texture: false });
  }
  app = null;
  worldContainer = null;
  screenContainer = null;
  hudOverlayLayer = null;
  planetLayer = null;
  stationLayer = null;
  thrustLayer = null;
  entityLayer = null;
  effectLayer = null;
  worldGradeFilter = null;
  _pixiReady = false;
}
