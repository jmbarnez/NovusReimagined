import { app } from "../../pixi.js";
import { pixiMapState } from "./state.js";
import type { MapWindowBounds } from "./utils.js";

export function invalidatePixiMapBounds(): void {
  pixiMapState.mapBoundsDirty = true;
}

export function getPixiMapViewportBounds(Wc: number, Hc: number): MapWindowBounds {
  if (!pixiMapState.mapBoundsDirty && pixiMapState.cachedMapBounds) return pixiMapState.cachedMapBounds;

  const winBody = document.getElementById("hud-win-body-map");
  if (!winBody || !app) {
    pixiMapState.cachedMapBounds = { baseX: 0, baseY: 0, width: Wc, height: Hc };
    pixiMapState.mapBoundsDirty = false;
    return pixiMapState.cachedMapBounds;
  }

  const rect = winBody.getBoundingClientRect();
  const pixiCanvas = app.canvas as HTMLCanvasElement;
  const pixiRect = pixiCanvas.getBoundingClientRect();
  pixiMapState.cachedMapBounds = {
    baseX: rect.left - pixiRect.left,
    baseY: rect.top - pixiRect.top,
    width: rect.width,
    height: rect.height,
  };
  pixiMapState.mapBoundsDirty = false;

  return pixiMapState.cachedMapBounds;
}

export function syncMapWindowBounds(Wc: number, Hc: number): MapWindowBounds {
  const bounds = getPixiMapViewportBounds(Wc, Hc);

  pixiMapState.positioningContainer?.position.set(bounds.baseX, bounds.baseY);
  if (pixiMapState.mapMask) {
    pixiMapState.mapMask.clear();
    pixiMapState.mapMask.rect(0, 0, bounds.width, bounds.height);
    pixiMapState.mapMask.fill({ color: 0xffffff });
  }

  return bounds;
}
