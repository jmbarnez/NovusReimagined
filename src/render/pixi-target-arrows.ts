/**
 * PixiJS Target Arrows Renderer
 * 
 * Migrates Canvas 2D target arrows and tutorial guide arrows to PixiJS.
 * Includes enemy lock arrows, asteroid lock arrows, and tutorial guide arrows.
 */
import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { Client } from "../state.js";
import { getState } from "../state-access.js";
import { hudOverlayLayer } from "../pixi.js";
import { LOCK_RAIL_H, HUD_BOTTOM_H } from "../constants.js";
import { viewCenterX, viewCenterY } from "./viewport.js";
import { dst } from "../utils/math.js";
import { curSys } from "../utils/game.js";
import { ensureLockQueue } from "../targeting.js";
import { getUIFont } from "./ui-font.js";
import { getTutorialGuideTarget } from "./pixi-tutorial-markers.js";

let arrowsContainer: Container | null = null;

// Pool of arrow graphics for reuse (max 32 simultaneous arrows)
const POOL_SIZE = 32;
let arrowPool: Graphics[] = [];
let textPool: Text[] = [];
let poolIndex = 0;

// Shared text style
let labelStyle: TextStyle | null = null;

// Edge calculation scratch array
const edgesScratch = new Float64Array(4);

export function initPixiTargetArrows(): void {
  if (!hudOverlayLayer) return;

  arrowsContainer = new Container();
  arrowsContainer.label = "target-arrows";
  hudOverlayLayer.addChild(arrowsContainer);

  // Initialize arrow pool
  const font = getUIFont();
  labelStyle = new TextStyle({
    fontFamily: font,
    fontSize: 8,
    fill: "#ffffff",
    align: "center",
  });

  for (let i = 0; i < POOL_SIZE; i++) {
    const arrow = new Graphics();
    arrow.visible = false;
    arrowsContainer.addChild(arrow);
    arrowPool.push(arrow);

    const text = new Text({ text: "", style: labelStyle });
    text.anchor.set(0.5, 0.5);
    text.visible = false;
    arrowsContainer.addChild(text);
    textPool.push(text);
  }
}

export function refreshTargetArrowFonts(): void {
  const font = getUIFont();
  const scale = Client.settings?.fontScale ?? 1.0;
  if (labelStyle) { labelStyle.fontFamily = font; labelStyle.fontSize = 8 * scale; }
}

function getArrow(): Graphics {
  const arrow = arrowPool[poolIndex];
  arrow.clear();
  arrow.visible = true;
  return arrow;
}

function getLabel(): Text {
  const text = textPool[poolIndex];
  text.visible = true;
  return text;
}

function releaseArrowAndLabel(): void {
  poolIndex++;
}

function resetPool(): void {
  poolIndex = 0;
  for (let i = 0; i < POOL_SIZE; i++) {
    arrowPool[i].visible = false;
    textPool[i].visible = false;
  }
}

// Returns screen-edge position for a world point, or null if on-screen.
function edgePos(
  wx: number, wy: number,
  Wc: number, Hc: number,
  cx: number, cy: number,
  camxR: number, camyR: number,
  zoom: number,
  mL: number, mR: number, mT: number, mB: number,
): [number, number, number] | null {
  const sx = cx + (wx - camxR) * zoom;
  const sy = cy + (wy - camyR) * zoom;
  if (sx > mL && sx < Wc - mR && sy > mT && sy < Hc - mB) return null;
  const angle = Math.atan2(sy - cy, sx - cx);
  const cosA = Math.cos(angle), sinA = Math.sin(angle);
  let ec = 0;
  if (cosA > 0.001) edgesScratch[ec++] = (Wc - mR - cx) / cosA;
  if (cosA < -0.001) edgesScratch[ec++] = (mL - cx) / cosA;
  if (sinA > 0.001) edgesScratch[ec++] = (Hc - mB - cy) / sinA;
  if (sinA < -0.001) edgesScratch[ec++] = (mT - cy) / sinA;
  if (!ec) return null;
  let t = Infinity;
  for (let i = 0; i < ec; i++) if (edgesScratch[i] > 0 && edgesScratch[i] < t) t = edgesScratch[i];
  if (t === Infinity) return null;
  return [cx + cosA * t, cy + sinA * t, angle];
}

function drawArrow(
  px: number, py: number, angle: number, fill: number, alpha: number, outlined: boolean,
  distStr?: string, shieldPct?: number, hullPct?: number,
): void {
  const arrow = getArrow();
  arrow.position.set(px, py);
  arrow.rotation = angle;

  if (outlined) {
    // Outer ring
    arrow.moveTo(16, 0);
    arrow.lineTo(-10, -9);
    arrow.lineTo(-10, 9);
    arrow.closePath();
    arrow.stroke({ color: fill, width: 1.5, alpha: Math.min(alpha, 1) * 0.45 });
  }

  // Main arrow
  arrow.moveTo(11, 0);
  arrow.lineTo(-6, -5.5);
  arrow.lineTo(-6, 5.5);
  arrow.closePath();
  arrow.fill({ color: fill, alpha });

  // Status bars
  if (shieldPct !== undefined || hullPct !== undefined) {
    const barL = 12;
    const barX = -20;
    const barAlpha = alpha * 0.7;

    if (shieldPct !== undefined && shieldPct > 0) {
      arrow.moveTo(barX, -4);
      arrow.lineTo(barX + barL * shieldPct, -4);
      arrow.stroke({ color: 0x44ccff, width: 1.5, alpha: barAlpha * 0.8 });
    }

    if (hullPct !== undefined) {
      arrow.moveTo(barX, -2);
      arrow.lineTo(barX + barL * hullPct, -2);
      arrow.stroke({ color: 0xee9944, width: 1.5, alpha: barAlpha * 0.8 });
    }
  }

  // Distance label
  if (distStr) {
    const text = getLabel();
    text.text = distStr;
    text.style.fill = fill;
    text.alpha = alpha * 0.85;

    const dx = px - viewCenterX(hudOverlayLayer?.parent?.width || window.innerWidth);
    const dy = py - viewCenterY(hudOverlayLayer?.parent?.height || window.innerHeight);
    const dMag = Math.hypot(dx, dy) || 1;
    text.position.set(
      Math.round(px - (dx / dMag) * 22),
      Math.round(py - (dy / dMag) * 22),
    );
  }

  releaseArrowAndLabel();
}

export function syncPixiTargetArrows(Wc: number, Hc: number, camxR: number, camyR: number, now: number): void {
  if (!arrowsContainer) return;

  const sys = curSys();
  const state = getState();
  const player = state.player;
  if (!player || !sys) {
    arrowsContainer.visible = false;
    return;
  }
  arrowsContainer.visible = true;

  resetPool();

  const zoom = Client.zoom;
  const cx = viewCenterX(Wc);
  const cy = viewCenterY(Hc);
  const mL = 30, mR = 10, mT = LOCK_RAIL_H + 10, mB = HUD_BOTTOM_H + 10;

  // Collect resolved locks
  const lockedIds = new Set<string>();
  ensureLockQueue(player);
  for (const slot of player.lockQueue) {
    if (!slot.resolving) lockedIds.add(slot.id);
  }

  const flash = 0.4 + 0.6 * Math.abs(Math.sin(now * 0.006));

  // Enemy arrows
  for (const e of sys.enemies) {
    if (!e.alive) continue;
    const youLocked = lockedIds.has(e.id);
    const theyLocked = !!e.hasLockOnPlayer;
    const theyLocking = !!e.targetingPlayer && !theyLocked;
    if (!youLocked && !theyLocked && !theyLocking) continue;

    const pos = edgePos(e.x, e.y, Wc, Hc, cx, cy, camxR, camyR, zoom, mL, mR, mT, mB);
    if (!pos) continue;

    const fill = theyLocked ? 0xff3333 : theyLocking ? 0xffdd44 : 0xff6666;
    const alpha = theyLocked ? 1.0 : theyLocking ? flash : 0.75;

    const d = Math.round(dst(player.x, player.y, e.x, e.y));
    const distStr = d > 1000 ? `${(d / 1000).toFixed(1)}k` : `${d}m`;

    const maxShield = e.maxShield || 0;
    const shieldPct = maxShield > 0 ? (e.shield || 0) / maxShield : 0;
    const hullPct = Math.max(0, Math.min(1, (e.hp || 0) / Math.max(1, e.maxHp)));

    drawArrow(pos[0], pos[1], pos[2], fill, alpha, youLocked, distStr, shieldPct, hullPct);
  }

  // Locked asteroid arrows
  for (const slot of player.lockQueue) {
    if (slot.resolving) continue;
    const a = sys.asteroids.find((a2) => a2.id === slot.id && !a2.depleted && a2.hp > 0);
    if (!a) continue;
    const pos = edgePos(a.x, a.y, Wc, Hc, cx, cy, camxR, camyR, zoom, mL, mR, mT, mB);
    if (pos) {
      const d = Math.round(dst(player.x, player.y, a.x, a.y));
      const distStr = d > 1000 ? `${(d / 1000).toFixed(1)}k` : `${d}m`;
      const hullPct = Math.max(0, Math.min(1, (a.hp || 0) / Math.max(1, a.maxHp)));
      drawArrow(pos[0], pos[1], pos[2], 0x88aaff, 0.75, true, distStr, undefined, hullPct);
    }
  }
}

export function syncPixiTutorialGuideArrow(Wc: number, Hc: number, camxR: number, camyR: number, now: number): void {
  if (!arrowsContainer) return;

  const state = getState();
  const player = state.player;
  if (!player?.tutorial?.active) return;

  const target = getTutorialGuideTarget();
  if (!target) return;

  const zoom = Client.zoom;
  const cx = viewCenterX(Wc);
  const cy = viewCenterY(Hc);
  const mL = 30, mR = 10, mT = LOCK_RAIL_H + 10, mB = HUD_BOTTOM_H + 10;

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
  arrow.moveTo(13, 0);
  arrow.lineTo(-7, -6);
  arrow.lineTo(-7, 6);
  arrow.closePath();
  arrow.fill({ color: 0xffdd44, alpha: pulse * 0.85 });
  releaseArrowAndLabel();
}

