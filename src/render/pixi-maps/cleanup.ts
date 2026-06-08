import { app } from "../../pixi.js";
import { pixiMapState } from "./state.js";
import { invalidatePixiMapBounds } from "./viewport.js";

export function destroyPixiMaps(): void {
  if (!pixiMapState.mapContainer) return;

  if (pixiMapState.bgGfx && pixiMapState.positioningContainer) {
    pixiMapState.positioningContainer.removeChild(pixiMapState.bgGfx);
    pixiMapState.bgGfx.destroy();
  }
  if (pixiMapState.mapMask && pixiMapState.positioningContainer) {
    pixiMapState.positioningContainer.removeChild(pixiMapState.mapMask);
    pixiMapState.mapMask.destroy();
  }
  pixiMapState.gridGfx?.destroy();
  pixiMapState.starGfx?.destroy();
  pixiMapState.sectorGfx?.destroy();
  pixiMapState.objectGfx?.destroy();
  pixiMapState.waypointGfx?.destroy();
  pixiMapState.playerGfx?.destroy();
  pixiMapState.vignetteGfx?.destroy();
  for (const label of pixiMapState._mapLabelPool.values()) {
    label.destroy();
  }
  pixiMapState._mapLabelPool.clear();
  pixiMapState._activeMapLabelKeys.clear();
  pixiMapState._labelStyleVariantCache.clear();
  pixiMapState.labelContainer?.destroy();
  pixiMapState.overlayGfx?.destroy();

  if (pixiMapState.positioningContainer && app) {
    app.stage.removeChild(pixiMapState.positioningContainer);
    pixiMapState.positioningContainer.destroy();
  }
  pixiMapState.positioningContainer = null;
  pixiMapState.mapContainer = null;
  pixiMapState.mapMask = null;
  pixiMapState.bgGfx = null;
  pixiMapState.overlayGfx = null;
  pixiMapState.cachedMapBounds = null;
  pixiMapState.mapBoundsDirty = true;
  window.removeEventListener("resize", invalidatePixiMapBounds);
  window.removeEventListener("hud:window-layout", invalidatePixiMapBounds);
}
