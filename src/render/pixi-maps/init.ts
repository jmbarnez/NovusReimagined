import { Container, Graphics } from "pixi.js";
import { app } from "../../pixi.js";
import { pixiMapState } from "./state.js";
import { invalidatePixiMapBounds } from "./viewport.js";

let listenersBound = false;

export function destroyPixiMaps(): void {
  if (pixiMapState.positioningContainer && !pixiMapState.positioningContainer.destroyed) {
    pixiMapState.positioningContainer.destroy({ children: true });
  }
  pixiMapState.bgGfx = null;
  pixiMapState.gridGfx = null;
  pixiMapState.starGfx = null;
  pixiMapState.sectorGfx = null;
  pixiMapState.objectGfx = null;
  pixiMapState.waypointGfx = null;
  pixiMapState.playerGfx = null;
  pixiMapState.vignetteGfx = null;
  pixiMapState.labelContainer = null;
  pixiMapState.mapMask = null;
  pixiMapState.positioningContainer = null;
  pixiMapState.overlayGfx = null;
  pixiMapState.mapContainer = null;
  pixiMapState.cachedMapBounds = null;
  pixiMapState.mapBoundsDirty = true;
  pixiMapState._lastLabelFontKey = "";
  pixiMapState._nameStyle = null;
  pixiMapState._smallStyle = null;
  pixiMapState._boldStyle = null;
  pixiMapState._labelStyleVariantCache.clear();
  pixiMapState._mapLabelPool.clear();
  pixiMapState._activeMapLabelKeys.clear();
}

export function initPixiMaps(): void {
  if (!app) return;
  if (pixiMapState.positioningContainer?.parent) return;
  destroyPixiMaps();

  // Positioning container: handles screen placement and masking
  pixiMapState.positioningContainer = new Container();
  pixiMapState.positioningContainer.label = "map-positioning";
  pixiMapState.positioningContainer.visible = false;
  app.stage.addChild(pixiMapState.positioningContainer);

  // Map container: holds the actual map content with zoom/pan
  pixiMapState.mapContainer = new Container();
  pixiMapState.mapContainer.label = "map-content";
  pixiMapState.positioningContainer.addChild(pixiMapState.mapContainer);

  // Mask for clipping to window bounds (in positioningContainer space)
  pixiMapState.mapMask = new Graphics();
  pixiMapState.positioningContainer.addChild(pixiMapState.mapMask);
  pixiMapState.positioningContainer.mask = pixiMapState.mapMask;

  // Background — in positioningContainer so zoom/pan don't affect it
  pixiMapState.bgGfx = new Graphics();
  pixiMapState.positioningContainer.addChildAt(pixiMapState.bgGfx, 0);

  // Grid
  pixiMapState.gridGfx = new Graphics();
  pixiMapState.mapContainer.addChild(pixiMapState.gridGfx);

  // Sectors/boundaries
  pixiMapState.sectorGfx = new Graphics();
  pixiMapState.mapContainer.addChild(pixiMapState.sectorGfx);

  // Star
  pixiMapState.starGfx = new Graphics();
  pixiMapState.mapContainer.addChild(pixiMapState.starGfx);

  // Objects (asteroids, enemies, gates, stations)
  pixiMapState.objectGfx = new Graphics();
  pixiMapState.mapContainer.addChild(pixiMapState.objectGfx);

  // Waypoint
  pixiMapState.waypointGfx = new Graphics();
  pixiMapState.mapContainer.addChild(pixiMapState.waypointGfx);

  // Player
  pixiMapState.playerGfx = new Graphics();
  pixiMapState.mapContainer.addChild(pixiMapState.playerGfx);

  // Vignette
  pixiMapState.vignetteGfx = new Graphics();
  pixiMapState.mapContainer.addChild(pixiMapState.vignetteGfx);

  // Labels container
  pixiMapState.labelContainer = new Container();
  pixiMapState.mapContainer.addChild(pixiMapState.labelContainer);

  // Dynamic overlays (radar sweep, survey cone, tutorial tracks)
  pixiMapState.overlayGfx = new Graphics();
  pixiMapState.mapContainer.addChild(pixiMapState.overlayGfx);

  if (!listenersBound) {
    window.addEventListener("resize", invalidatePixiMapBounds);
    window.addEventListener("hud:window-layout", invalidatePixiMapBounds);
    listenersBound = true;
  }
}
