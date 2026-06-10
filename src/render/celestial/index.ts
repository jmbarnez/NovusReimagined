import { getState } from "../../state-access.js";
import { AppMode } from "../../state.js";
import type { System } from "../../types/world.js";
import type { RenderSubsystem } from "../lifecycle.js";
import { stationLayer } from "../../pixi.js";
import { refreshWorldLabelTextStyle } from "../world-label-card.js";
import { isVisible } from "../../utils/game.js";
import {
  initStarSprites,
  syncStarSprites,
  destroyStarSprites,
  SUN_DIST,
  STAR_CONFIG,
  getStarCfg,
  hexToRgb,
  shadeHex,
} from "./star.js";
import {
  initGateSprites,
  syncGateSprites,
  destroyGateSprites,
  refreshGateFonts,
} from "./gates.js";
import {
  initBorderSprites,
  syncBorderSprites,
  destroyBorderSprites,
} from "./border.js";

export { SUN_DIST, STAR_CONFIG, getStarCfg, hexToRgb, shadeHex } from "./star.js";

export function refreshCelestialFonts() {
  refreshWorldLabelTextStyle();
  refreshGateFonts();
}

let _currentSysIdx = -1;

function doInit(sys: System): void {
  if (!stationLayer) return;
  const starClass = sys.starClass ?? "G";
  const sunDir = sys.sunDir ?? 0;
  initStarSprites(stationLayer, sunDir, starClass);
  initGateSprites(sys);
  initBorderSprites();
}

export function initPixiCelestial(_parent?: import("pixi.js").Container, _sys?: System): void {
  destroyPixiCelestial();
  const sysIdx = getState().player?.sysIdx ?? 0;
  const sys = getState().GALAXY?.[sysIdx];
  _currentSysIdx = sysIdx;
  if (!sys) return;
  doInit(sys);
}

export function syncPixiCelestial(now: number, _alpha: number, sys: System): void {
  const starClass = sys.starClass ?? "G";
  const sunDir = sys.sunDir ?? 0;
  const r = STAR_CONFIG[starClass]?.radius ?? 250;

  const sunX = Math.cos(sunDir) * SUN_DIST;
  const sunY = Math.sin(sunDir) * SUN_DIST;
  const visible = isVisible(sunX, sunY, r * 3.5);

  syncStarSprites(now, sunDir, starClass, visible);
  syncGateSprites(now, sys);
  syncBorderSprites(sys);
}

export function destroyPixiCelestial(): void {
  destroyStarSprites();
  destroyGateSprites();
  destroyBorderSprites();
  _currentSysIdx = -1;
}

function syncCelestial(ctx: import("../lifecycle.js").SyncContext): void {
  const sysIdx = getState().player?.sysIdx ?? 0;
  const sys = ctx.sys;
  if (sysIdx !== _currentSysIdx) {
    destroyPixiCelestial();
    _currentSysIdx = sysIdx;
    if (sys) doInit(sys);
  }
  if (sys) syncPixiCelestial(ctx.now, ctx.alpha, sys);
}

export const celestialRenderer: RenderSubsystem = {
  name: "celestial",
  init: initPixiCelestial,
  sync: syncCelestial,
  destroy: destroyPixiCelestial,
  modes: [AppMode.TITLE, AppMode.SPACE],
  order: 10,
};
