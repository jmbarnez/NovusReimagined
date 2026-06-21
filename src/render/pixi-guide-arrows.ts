/**
 * PixiJS Tutorial Guide Arrow Renderer.
 *
 * Migrates the Canvas 2D tutorial guide arrow to PixiJS.
 * Target-lock arrows (enemy/asteroid) were removed with the target-locking system.
 */
import { Container, Graphics } from "pixi.js";
import { Client } from "../state.js";
import { getState } from "../state-access.js";
import { hudOverlayLayer } from "../pixi.js";
import { HUD_BOTTOM_H } from "../constants.js";
import { viewCenterX, viewCenterY } from "./viewport.js";
import { getTutorialGuideTarget } from "./pixi-tutorial-markers.js";
import { HUD_LAYER_Z } from "./pixi-z-order.js";

let arrowsContainer: Container | null = null;

// Pool of arrow graphics for reuse (max 8 simultaneous guide arrows).
const POOL_SIZE = 8;
let arrowPool: Graphics[] = [];
let poolIndex = 0;

function isArrowsContainerAttachedToCurrentLayer(): boolean {
  return !!hudOverlayLayer
    && !!arrowsContainer
    && !arrowsContainer.destroyed
    && arrowsContainer.parent === hudOverlayLayer;
}

export function initPixiGuideArrows(): void {
  if (!hudOverlayLayer) return;
  if (isArrowsContainerAttachedToCurrentLayer()) return;
  if (arrowsContainer) {
    const parent = arrowsContainer.parent;
    if (parent && !parent.destroyed) parent.removeChild(arrowsContainer);
    if (!arrowsContainer.destroyed) arrowsContainer.destroy({ children: true });
  }
  arrowsContainer = null;
  arrowPool = [];
  poolIndex = 0;

  arrowsContainer = new Container();
  arrowsContainer.label = "guide-arrows";
  arrowsContainer.zIndex = HUD_LAYER_Z.GUIDE_ARROWS;
  hudOverlayLayer.addChild(arrowsContainer);

  for (let i = 0; i < POOL_SIZE; i++) {
    const arrow = new Graphics();
    arrow.visible = false;
    arrowsContainer.addChild(arrow);
    arrowPool.push(arrow);
  }
}

export function destroyPixiGuideArrows(): void {
  if (arrowsContainer) {
    const parent = arrowsContainer.parent;
    if (parent && !parent.destroyed) parent.removeChild(arrowsContainer);
    if (!arrowsContainer.destroyed) arrowsContainer.destroy({ children: true });
  }
  arrowsContainer = null;
  arrowPool = [];
  poolIndex = 0;
}

function getArrow(): Graphics {
  const arrow = arrowPool[poolIndex];
  arrow.clear();
  arrow.visible = true;
  return arrow;
}

function releaseArrow(): void {
  poolIndex++;
}

function resetPool(): void {
  poolIndex = 0;
  for (let i = 0; i < POOL_SIZE; i++) {
    arrowPool[i].visible = false;
  }
}

export function syncPixiTutorialGuideArrow(Wc: number, Hc: number, camxR: number, camyR: number, now: number): void {
  if (!isArrowsContainerAttachedToCurrentLayer()) initPixiGuideArrows();
  if (!arrowsContainer) return;

  const state = getState();
  const player = state.player;
  if (!player?.tutorial?.active) return;

  const target = getTutorialGuideTarget();
  if (!target) return;

  resetPool();

  const zoom = Client.zoom;
  const cx = viewCenterX(Wc);
  const cy = viewCenterY(Hc);
  const margin = 72;
  const mL = margin, mR = margin, mT = margin, mB = HUD_BOTTOM_H + margin;

  const sx = cx + (target.x - camxR) * zoom;
  const sy = cy + (target.y - camyR) * zoom;
  if (sx > mL && sx < Wc - mR && sy > mT && sy < Hc - mB) return;

  const angle = Math.atan2(sy - cy, sx - cx);
  const cosA = Math.cos(angle), sinA = Math.sin(angle);
  let t = Infinity;
  const edges = [0, 0, 0, 0];
  let ec = 0;
  if (cosA > 0.001) edges[ec++] = (Wc - mR - cx) / cosA;
  if (cosA < -0.001) edges[ec++] = (mL - cx) / cosA;
  if (sinA > 0.001) edges[ec++] = (Hc - mB - cy) / sinA;
  if (sinA < -0.001) edges[ec++] = (mT - cy) / sinA;
  for (let i = 0; i < ec; i++) if (edges[i] > 0 && edges[i] < t) t = edges[i];
  if (t === Infinity) return;

  const px = cx + cosA * t;
  const py = cy + sinA * t;
  const pulse = 0.65 + 0.35 * Math.abs(Math.sin(now * 0.005));

  const arrow = getArrow();
  arrow.position.set(px, py);
  arrow.rotation = angle;
  arrow.moveTo(22, 0);
  arrow.lineTo(-13, -11);
  arrow.lineTo(-13, 11);
  arrow.closePath();
  arrow.fill({ color: 0xffdd44, alpha: pulse * 0.9 });
  releaseArrow();
}
