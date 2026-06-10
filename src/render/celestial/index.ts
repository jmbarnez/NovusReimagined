import { Container } from "pixi.js";
import { getState } from "../../state-access.js";
import type { System } from "../../types/world.js";
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

export function initPixiCelestial(parent: Container, sys: System): void {
  destroyPixiCelestial();
  if (!sys) return;

  const starClass = sys.starClass ?? "G";
  const sunDir = sys.sunDir ?? 0;

  initStarSprites(parent, sunDir, starClass);
  initGateSprites(sys);
  initBorderSprites();
}

export function syncPixiCelestial(now: number, alpha: number, sys: System): void {
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
}
