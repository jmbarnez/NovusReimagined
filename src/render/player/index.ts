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
import { AppMode } from "../../state.js";
import type { RenderSubsystem } from "../lifecycle.js";
import { getDotTexture, clearShipTextureCaches } from "./bake.js";
import { buildPlayerSprites, destroyPlayerSprites, syncPixiPlayer } from "./ship.js";
import { buildTrailPool, destroyTrailPool, syncPixiTrails } from "./trails.js";

export function initPixiPlayer(): void {
  const dotTex = getDotTexture();
  buildPlayerSprites(getState().player?.shipId ?? "scout");
  buildTrailPool();
}

export { clearShipTextureCaches as clearPlayerTextureCaches };

export const playerRenderer: RenderSubsystem = {
  name: "player",
  init: initPixiPlayer,
  sync: (ctx) => {
    syncPixiPlayer(ctx.alpha, ctx.now);
  },
  destroy: () => {
    destroyPlayerSprites();
    destroyTrailPool();
  },
  modes: [AppMode.SPACE],
  order: 110,
};

export const trailsRenderer: RenderSubsystem = {
  name: "trails",
  init: () => { /* trails init is part of player init */ },
  sync: (ctx) => {
    syncPixiTrails(ctx.now);
  },
  destroy: () => { /* trails destroy is part of player destroy */ },
  modes: [AppMode.SPACE],
  order: 120,
};
