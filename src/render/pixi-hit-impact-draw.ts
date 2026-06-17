/**
 * Shared PixiJS draw routines for shield ripples and hull impact sparks.
 * Used for both player and NPC ships.
 */
import type { Graphics } from "pixi.js";
import type { EntityVisualState } from "./entity-visuals.js";

export function drawShieldHitRipple(
  g: Graphics,
  cx: number,
  cy: number,
  shieldR: number,
  hitAngle: number,
  glow: number,
): void {
  const hx = Math.cos(hitAngle) * shieldR;
  const hy = Math.sin(hitAngle) * shieldR;
  const t = 1 - glow;

  g.circle(cx, cy, shieldR).fill({ color: 0x33aaff, alpha: glow * 0.16 });

  for (let i = 0; i < 3; i++) {
    const phase = t * 1.5 - i * 0.2;
    if (phase <= 0 || phase >= 1) continue;
    g.circle(cx + hx, cy + hy, phase * shieldR * 2.0)
      .stroke({ color: 0xaaddff, width: 2 * (1 - phase), alpha: glow * (1 - phase) * 0.65 });
  }

  const waveWidth = t * Math.PI * 1.2;
  const waveA = glow * 0.4 * (1 - t * 0.6);
  if (waveWidth > 0.05 && waveA > 0.01) {
    g.arc(cx, cy, shieldR * (0.96 + t * 0.06), hitAngle - waveWidth * 0.5, hitAngle + waveWidth * 0.5)
      .stroke({ color: 0x66ccff, width: 2, alpha: waveA });
  }
}

export function drawHullHitSparks(
  g: Graphics,
  cx: number,
  cy: number,
  edgeRadius: number,
  hitAngle: number,
  glow: number,
): void {
  const hx = cx + Math.cos(hitAngle) * edgeRadius;
  const hy = cy + Math.sin(hitAngle) * edgeRadius;

  const sparkR = 10 * glow + 4;
  g.circle(hx, hy, sparkR).fill({ color: 0xffcc44, alpha: glow * 0.85 })
    .circle(hx, hy, sparkR * 0.4).fill({ color: 0xffffff, alpha: glow });

  g.circle(hx, hy, 6 + (1 - glow) * 8)
    .stroke({ color: 0xff8c28, width: 1.5 * glow, alpha: glow * 0.6 });

  for (let i = 0; i < 5; i++) {
    const sa = hitAngle + (i - 2) * 0.4 + Math.PI;
    const sd = 8 + (1 - glow) * 14;
    const sx = hx + Math.cos(sa) * sd;
    const sy = hy + Math.sin(sa) * sd;
    g.rect(sx - 1.5, sy - 1.5, 3, 3).fill({ color: i % 2 === 0 ? 0xffbb44 : 0xff6622, alpha: glow * 0.5 });
  }
}

/** Draw all active shield/hull impact glows for a ship at world position (cx, cy). */
export function drawShipHitGlows(
  g: Graphics,
  cx: number,
  cy: number,
  shieldRadius: number,
  hullEdgeRadius: number,
  visual: EntityVisualState,
): void {
  const shieldGlow = visual.shieldHitGlow || 0;
  if (shieldGlow > 0 && visual.shieldHitAngle !== undefined) {
    drawShieldHitRipple(g, cx, cy, shieldRadius, visual.shieldHitAngle, shieldGlow);
  }

  const hullGlow = visual.hullHitGlow || 0;
  if (hullGlow > 0 && visual.hullHitAngle !== undefined) {
    drawHullHitSparks(g, cx, cy, hullEdgeRadius, visual.hullHitAngle, hullGlow);
  }
}
