export {
  bakeShipTexture,
  getShipTexture,
  bakeShipLightTextures,
  getShipLightTextures,
  bakeDotTexture,
  getDotTexture,
  clearShipTextureCaches,
} from "./bake.js";

export {
  destroyPlayerSprites,
  destroyRemotePlayerSprites,
  buildPlayerSprites,
  syncPixiPlayer,
  rebuildPlayerSprites,
} from "./ship.js";

export {
  buildTrailPool,
  syncPixiTrails,
  destroyTrailPool,
  refreshTrailTexture,
} from "./trails.js";

import { getState } from "../../state-access.js";
import { getDotTexture, clearShipTextureCaches } from "./bake.js";
import { buildPlayerSprites } from "./ship.js";
import { buildTrailPool } from "./trails.js";

export function initPixiPlayer(): void {
  const dotTex = getDotTexture();
  buildPlayerSprites(getState().player?.shipId ?? "scout");
  buildTrailPool();
}

export { clearShipTextureCaches as clearPlayerTextureCaches };
