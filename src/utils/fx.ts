import { TAU } from "../constants.js";
import { addParticle, addBeam, addFloatText, addShockwave, addImpactDecal, removeImpactDecal } from "./entities.js";
import { getState } from "../state-access.js";

// ─── Material-based collision FX ─────────────────────────────────────────────
//  Every collision/impact in the game routes through spawnCollisionFx, which
//  picks spark colors, particle counts, and flash ring style based on the
//  material pair.  This replaces the scattered spawnImpactFlash / spawnBeamImpact
//  / spawnMiningSparks / spawnCollisionSparks wrappers with one entry point.

export type CollisionMaterial =
  | "metal"    // ship hulls, station plating
  | "rock"     // asteroids
  | "shield"   // energy shields
  | "debris"   // wreck pieces
  | "energy"   // beam/projectile hits
  | "ore";     // mining laser on asteroid

export function spawnMuzzleFlash(x: number, y: number, angle: number, color: string, intensity = 6) {
  const n = Math.max(3, Math.round(intensity));
  for (let i = 0; i < n; i++) {
    const a = angle + (Math.random() - 0.5) * 0.7;
    const s = 70 + Math.random() * 110;
    addParticle({
      x, y, color,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      r: 1.1 + Math.random() * 2.2,
      life: 0.25 + Math.random() * 0.25,
      drag: 0.80 + Math.random() * 0.06,
      decay: 2.8 + Math.random() * 1.2,
    });
  }
  addParticle({
    x, y, color: "#ffffff",
    vx: Math.cos(angle) * 30 + (Math.random() - 0.5) * 20,
    vy: Math.sin(angle) * 30 + (Math.random() - 0.5) * 20,
    r: 2.5 + Math.random() * 2,
    life: 0.08 + Math.random() * 0.08,
    drag: 0.85,
    decay: 6,
  });
  for (let i = 0; i < 2; i++) {
    const a = angle + (Math.random() - 0.5) * 1.2;
    const s = 40 + Math.random() * 60;
    addParticle({
      x, y, color: "#ffcc88",
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      r: 0.6 + Math.random() * 0.8,
      life: 0.2 + Math.random() * 0.15,
      drag: 0.88,
      decay: 3.5,
    });
  }
}

export function spawnParticles(x: number, y: number, color: string, n = 8, spd = 100) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU;
    const s = spd * 0.4 + Math.random() * spd;
    addParticle({
      x, y, color,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      r: 1.2 + Math.random() * 2.2,
      life: 1,
      drag: 0.92 + Math.random() * 0.05,
      decay: 0.9 + Math.random() * 0.8,
    });
  }
}

export function spawnBeam(x1: number, y1: number, x2: number, y2: number, color: string, width = 2) {
  addBeam({ x1, y1, x2, y2, color, width, life: 1 });
}

export function floatText(x: number, y: number, text: string, color = "#fff", bgColor?: string) {
  addFloatText({ x, y, text, color, bgColor, life: 1, vy: -44 });
}

// ─── Legacy compat wrappers (delegate to spawnCollisionFx) ───────────────────
//  These keep existing call sites working. New code should call spawnCollisionFx
//  directly with an explicit material.

export function spawnImpactFlash(x: number, y: number, color: string) {
  spawnCollisionFx({ x, y, nx: 0, ny: 0, intensity: 60, material: "energy", tint: color });
}

export function spawnBeamImpactSubtle(x: number, y: number, color: string) {
  spawnCollisionFx({ x, y, nx: 0, ny: 0, intensity: 35, material: "energy", tint: color });
}

export function spawnMiningSparks(x: number, y: number, nx = 0, ny = -1, color = "#c8a060", scale = 1) {
  spawnCollisionFx({ x, y, nx, ny, intensity: 40 * scale, material: "ore", tint: color });
}

function _spawnDebris(x: number, y: number, color: string, count: number, sizeScale: number) {
  for (let i = 0; i < count; i++) {
    const ox = (Math.random() - 0.5) * 20 * sizeScale;
    const oy = (Math.random() - 0.5) * 20 * sizeScale;
    const pts: number[][] = [];
    const n = 4 + Math.floor(Math.random() * 4);
    const baseR = 3 + Math.random() * 7 * sizeScale;
    for (let j = 0; j < n; j++) {
      const a = (j / n) * TAU + (Math.random() - 0.5) * 0.9;
      const r = baseR * (0.5 + Math.random() * 0.6);
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    if (getState().impactDecals.length >= 78) removeImpactDecal(0);
    addImpactDecal({ x: x + ox, y: y + oy, poly: pts, color, life: 5 + Math.random() * 4, maxLife: 9 });
  }
}

export function spawnExplosion(x: number, y: number, color: string, scale = 1.0, tier: "small" | "medium" | "large" = "small") {
  const n  = Math.round(4 * scale);
  const s  = 80 * scale;

  if (tier === "small") {
    spawnParticles(x, y, color, n, s);
    spawnParticles(x, y, "#ffcc66", Math.round(n * 0.25), s * 0.6);
    // Quick white flash ring
    addShockwave({ x, y, maxRadius: 22 * scale, life: 0.18, color: "#fff8e0", width: 2.5 });
    return;
  }

  if (tier === "medium") {
    spawnParticles(x, y, color, n + 4, s);
    spawnParticles(x, y, "#ffcc66", Math.round(n * 0.5), s * 0.7);
    spawnParticles(x, y, "#ffffff", 2, s * 0.5);
    addShockwave({ x, y, maxRadius: 18 * scale, life: 0.16, color: "#fffae8", width: 3 });
    addShockwave({ x, y, maxRadius: (35 + scale * 40), life: 0.45 + scale * 0.2, color, width: 2 + scale * 1.5 });
    _spawnDebris(x, y, color, 2, scale);
    _spawnDebris(x, y, "#ffaa44", 1, scale);
    return;
  }

  // "large"
  spawnParticles(x, y, color, n + 10, s * 1.1);
  spawnParticles(x, y, "#ffcc66", Math.round(n * 0.7), s * 0.85);
  spawnParticles(x, y, "#ffffff", 4, s * 0.6);
  // Bright flash ring
  addShockwave({ x, y, maxRadius: 20 * scale, life: 0.14, color: "#ffffff", width: 4 });
  // Primary ring
  addShockwave({ x, y, maxRadius: (45 + scale * 55), life: 0.5 + scale * 0.35, color, width: 2 + scale * 2 });
  // Secondary wider ring, slight delay simulated by starting wider
  addShockwave({ x, y, maxRadius: (65 + scale * 70), life: 0.65 + scale * 0.3, color: "#ff8844", width: 1.5 });
  // Debris chunks
  _spawnDebris(x, y, color, 3, scale * 1.2);
  _spawnDebris(x, y, "#ffaa44", 2, scale * 0.9);
  // Lingering afterburn — large slow-decaying glow
  addParticle({
    x, y, color: "#ff6622",
    vx: 0, vy: 0,
    r: 18 + scale * 14,
    life: 1.8 + scale * 0.6,
    drag: 1.0,
    decay: 0.55,
  });
}

export function spawnShockwave(x: number, y: number, color: string, scale = 1.0) {
  addShockwave({
    x, y,
    maxRadius: 45 + scale * 55,
    life: 0.5 + scale * 0.35,
    color,
    width: 2 + scale * 2,
  });
}

/** Unified collision FX — bright hot sparks + flash ring on every collision.
 *
 *  Simple and visible: orange-gold sparks, white-hot center, warm flash ring.
 *  No material-specific colors — just hot debris flying off a contact point.
 */
export interface CollisionFxOptions {
  x: number;
  y: number;
  /** Contact normal pointing away from the impacted surface. (0,0) = radial. */
  nx: number;
  ny: number;
  /** Impact strength — controls particle count and flash ring size. */
  intensity: number;
  /** Material type (kept for API compat, currently unused). */
  material?: CollisionMaterial;
  /** Unused — kept for API compat. */
  tint?: string;
}

export function spawnCollisionFx(opts: CollisionFxOptions): void {
  const { x, y, nx, ny, intensity, tint } = opts;
  if (intensity <= 0) return;

  const sparkColor = tint ?? "#ffcc66";
  const hasNormal = nx !== 0 || ny !== 0;
  const count = Math.min(8, Math.max(3, Math.round(intensity * 0.06)));
  const spdScale = Math.min(1.0, Math.max(0.4, intensity * 0.006));

  // Minimal directional spark spray
  const tx = -ny;
  const ty = nx;
  for (let i = 0; i < count; i++) {
    const spd = (40 + Math.random() * 80) * spdScale;
    let vx: number, vy: number;
    if (hasNormal) {
      const spread = (Math.random() - 0.5) * 1.6;
      vx = (nx * 0.3 + tx * spread) * spd;
      vy = (ny * 0.3 + ty * spread) * spd;
    } else {
      const a = Math.random() * TAU;
      vx = Math.cos(a) * spd;
      vy = Math.sin(a) * spd;
    }
    addParticle({
      x, y,
      color: sparkColor,
      vx, vy,
      r: 2 + Math.random() * 2,
      life: 0.2 + Math.random() * 0.2,
      drag: 0.9 + Math.random() * 0.04,
      decay: 1.8 + Math.random() * 0.6,
    });
  }

  // Few tiny white-hot center sparks
  const hotCount = Math.min(3, Math.max(1, Math.round(count * 0.25)));
  for (let i = 0; i < hotCount; i++) {
    const a = Math.random() * TAU;
    const s = (30 + Math.random() * 50) * spdScale;
    addParticle({
      x, y,
      color: "#ffffff",
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      r: 1.5 + Math.random() * 1,
      life: 0.12 + Math.random() * 0.1,
      drag: 0.86,
      decay: 3.0,
    });
  }

  // Subtle flash ring
  const ringR = 4 + Math.min(12, intensity * 0.08);
  addShockwave({
    x, y,
    maxRadius: ringR,
    life: 0.08 + Math.min(0.08, intensity * 0.0008),
    color: "#fff8e0",
    width: 1,
  });
}
