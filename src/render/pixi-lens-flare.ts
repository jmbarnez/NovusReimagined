import { Graphics } from "pixi.js";
import { Client } from "../state.js";
import { getState } from "../state-access.js";
import { hudOverlayLayer } from "../pixi.js";
import { getSunWorldPos } from "../utils/sun-position.js";

let lensGfx: Graphics | null = null;

type FlareGhost = {
  readonly t: number;
  readonly radius: number;
  readonly color: number;
  readonly alpha: number;
};

const FLARE_GHOSTS: readonly FlareGhost[] = [
  { t: 0.72, radius: 7, color: 0xffe0b8, alpha: 0.030 },
  { t: 1.16, radius: 11, color: 0x9fc8ff, alpha: 0.018 },
];

export function destroyLensFlare(): void {
  if (lensGfx) {
    lensGfx.destroy();
    lensGfx = null;
  }
}

function ensureLensLayer(): Graphics | null {
  const root = hudOverlayLayer;
  if (!root) return null;
  if (!lensGfx) {
    lensGfx = new Graphics();
    lensGfx.label = "lens-flare";
    lensGfx.blendMode = "add";
    root.addChild(lensGfx);
  } else if (!lensGfx.parent) {
    root.addChild(lensGfx);
  }
  return lensGfx;
}

function drawSoftCircle(gfx: Graphics, x: number, y: number, radius: number, color: number, alpha: number): void {
  gfx.circle(x, y, radius * 2.15).fill({ color, alpha: alpha * 0.16 });
  gfx.circle(x, y, radius * 1.35).fill({ color, alpha: alpha * 0.32 });
  gfx.circle(x, y, radius).fill({ color, alpha });
}

function isNearViewport(x: number, y: number, width: number, height: number, margin: number): boolean {
  return x >= -margin && x <= width + margin && y >= -margin && y <= height + margin;
}

export function syncPixiLensFlare(width: number, height: number): void {
  if (!Client.settings?.lensFlare) {
    lensGfx?.clear();
    return;
  }

  const gfx = ensureLensLayer();
  if (!gfx) return;

  const sys = getState().GALAXY?.[getState().player?.sysIdx ?? 0];
  if (!sys) { gfx.clear(); return; }

  const sun = getSunWorldPos(sys);
  const cx = width / 2;
  const cy = height / 2;
  const sx = cx + (sun.x - Client.camx) * Client.zoom;
  const sy = cy + (sun.y - Client.camy) * Client.zoom;

  const dx = cx - sx;
  const dy = cy - sy;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) { gfx.clear(); return; }

  const shortSide = Math.min(width, height);
  const visibleRange = shortSide * 1.9;
  const proximity = Math.max(0, 1 - dist / visibleRange);
  const sunNearViewport = isNearViewport(sx, sy, width, height, shortSide * 0.42);
  const strength = Math.pow(proximity, 1.35) * (sunNearViewport ? 0.42 : 0.22);
  if (strength < 0.02) { gfx.clear(); return; }

  gfx.clear();
  gfx.position.set(0, 0);
  gfx.alpha = 1;

  for (const ghost of FLARE_GHOSTS) {
    const gx = sx + dx * ghost.t;
    const gy = sy + dy * ghost.t;
    const radius = ghost.radius * (0.82 + proximity * 0.38);
    if (isNearViewport(gx, gy, width, height, radius * 2.5)) {
      drawSoftCircle(gfx, gx, gy, radius, ghost.color, ghost.alpha * strength);
    }
  }

  const sunOnScreen = isNearViewport(sx, sy, width, height, 24);
  if (sunOnScreen) {
    drawSoftCircle(gfx, sx, sy, 3.5 + proximity * 4, 0xffffff, 0.16 * strength);
    drawSoftCircle(gfx, sx, sy, 12 + proximity * 10, 0xffc27a, 0.018 * strength);
  } else {
    const edgeX = Math.max(12, Math.min(width - 12, sx));
    const edgeY = Math.max(12, Math.min(height - 12, sy));
    drawSoftCircle(gfx, edgeX, edgeY, 10 + proximity * 8, 0xffb46c, 0.035 * strength);
  }
}
