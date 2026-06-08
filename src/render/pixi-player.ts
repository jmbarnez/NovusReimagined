/**
 * PixiJS player renderer.
 *
 * Flame thrust is rendered by pixi-thrust.ts. This file owns the shared Trail
 * sprite pool, including speed-based engine exhaust sheets and blink afterimages.
 */
import { getState } from "../state-access.js";

export {
  bakeShipTexture,
  getShipTexture,
  bakeShipLightTextures,
  getShipLightTextures,
  bakeDotTexture,
  getDotTexture,
  clearShipTextureCaches,
} from "./player/bake.js";

export {
  destroyPlayerSprites,
  destroyRemotePlayerSprites,
  buildPlayerSprites,
  syncPixiPlayer,
  rebuildPlayerSprites,
} from "./player/ship.js";

export {
  buildTrailPool,
  syncPixiTrails,
  destroyTrailPool,
  refreshTrailTexture,
} from "./player/trails.js";

export function initPixiPlayer(): void {
  const dotTex = getDotTexture();
  buildPlayerSprites(getState().player?.shipId ?? "scout");
  buildTrailPool();
}

export { clearShipTextureCaches as clearPlayerTextureCaches };
