import { Graphics } from "pixi.js";
import { Client } from "../state.js";
import { getState } from "../state-access.js";
import { screenContainer, worldContainer } from "../pixi.js";
import { getSunWorldPos } from "../utils/sun-position.js";

let lensGfx: Graphics | null = null;

function ensureLensLayer(): Graphics | null {
  const root = screenContainer ?? worldContainer;
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

export function syncPixiLensFlare(width: number, height: number): void {
  if (!Client.settings?.lensFlare) return;
  const gfx = ensureLensLayer();
  if (!gfx) return;

  const sys = getState().GALAXY?.[getState().player?.sysIdx ?? 0];
  const sun = getSunWorldPos(sys);
  const cx = width / 2;
  const cy = height / 2;
  const sx = cx + (sun.x - Client.camx) * Client.zoom;
  const sy = cy + (sun.y - Client.camy) * Client.zoom;
  if (sx === 0 && sy === 0) { gfx.clear(); return; }

  const dx = cx - sx;
  const dy = cy - sy;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) { gfx.clear(); return; }
  const nx = dx / dist;
  const ny = dy / dist;

  const proximity = Math.max(0, 1 - dist / (Math.min(width, height) * 0.7));
  const strength = proximity * 0.7;
  if (strength < 0.01) { gfx.clear(); return; }

  gfx.clear();
  gfx.position.set(0, 0);
  gfx.alpha = 1;

  // Anamorphic horizontal streak
  const streakW = width * 0.14;
  const streakH = 1 + proximity;
  gfx.rect(sx - streakW / 2, sy - streakH / 2, streakW, streakH).fill({ color: 0xffffff, alpha: 0.05 * strength });

  // Ghost circles along sun→center axis
  const ghosts = [
    { t: 0.30, r: 8, color: 0xffc878 },
    { t: 0.60, r: 16, color: 0xb4d2ff },
    { t: 0.90, r: 6, color: 0xffa064 },
    { t: 1.20, r: 10, color: 0xc8b4ff },
  ];
  for (const g of ghosts) {
    const gx = sx + dx * g.t;
    const gy = sy + dy * g.t;
    const alpha = 0.03 * strength;
    gfx.circle(gx, gy, g.r).fill({ color: g.color, alpha }).stroke({ color: g.color, width: 0, alpha: 0 });
  }

  // Chromatic chord crossing the streak
  const chordW = 20;
  const chordH = 2;
  gfx.rect(sx - chordW / 2, sy - chordH / 2, chordW, chordH).fill({ color: 0xff3c3c, alpha: 0.02 * strength });
  gfx.rect(sx - chordW / 2, sy - chordH / 2, chordW, chordH).fill({ color: 0x3cff3c, alpha: 0.015 * strength });
  gfx.rect(sx - chordW / 2, sy - chordH / 2, chordW, chordH).fill({ color: 0x3c3cff, alpha: 0.02 * strength });

  // Small starburst at sun position
  gfx.circle(sx, sy, 3 + proximity * 4).fill({ color: 0xffffff, alpha: 0.08 * strength });
  gfx.moveTo(sx - 10, sy).lineTo(sx + 10, sy);
  gfx.moveTo(sx, sy - 10).lineTo(sx, sy + 10);
  gfx.stroke({ color: 0xffffff, width: 1, alpha: 0.04 + 0.1 * strength });
}

