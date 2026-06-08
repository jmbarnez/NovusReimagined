/**
 * PixiJS player renderer.
 *
 * Flame thrust is rendered by pixi-thrust.ts. This file owns the shared Trail
 * sprite pool, including speed-based engine exhaust sheets and blink afterimages.
 */
import { getState } from "../state-access.js";
import {
  bakeShipTexture,
  getShipTexture,
  bakeShipLightTextures,
  getShipLightTextures,
  bakeDotTexture,
  getDotTexture,
  clearShipTextureCaches,
} from "./player/bake.js";
import {
  destroyPlayerSprites,
  destroyRemotePlayerSprites,
  buildPlayerSprites,
  syncPixiPlayer,
  rebuildPlayerSprites,
} from "./player/ship.js";
import {
  buildTrailPool,
  syncPixiTrails,
  destroyTrailPool,
  refreshTrailTexture,
} from "./player/trails.js";

export {
  bakeShipTexture,
  getShipTexture,
  bakeShipLightTextures,
  getShipLightTextures,
  bakeDotTexture,
  getDotTexture,
  clearShipTextureCaches,
};

export {
  destroyPlayerSprites,
  destroyRemotePlayerSprites,
  buildPlayerSprites,
  syncPixiPlayer,
  rebuildPlayerSprites,
};

export {
  buildTrailPool,
  syncPixiTrails,
  destroyTrailPool,
  refreshTrailTexture,
};

export function initPixiPlayer(): void {
  const dotTex = getDotTexture();
  void dotTex;
  buildPlayerSprites(getState().player?.shipId ?? "scout");
  buildTrailPool();
}

export { clearShipTextureCaches as clearPlayerTextureCaches };
