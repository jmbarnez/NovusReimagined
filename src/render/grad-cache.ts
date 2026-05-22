/**
 * Cached canvas gradients anchored at the origin.
 *
 * createRadialGradient allocates a new object on every call; in the 60Hz render
 * loop with hundreds of bullets/particles that is real GC churn and frame jitter.
 * These origin-anchored gradients depend only on color + bucketed radius, so
 * callers translate the context to position them and modulate intensity via
 * globalAlpha — the cached gradient itself never changes.
 */

import { TAU } from "../constants.js";
import { normalizeAngle } from "../utils/math.js";

/**
 * Memoized gradient lookup: returns the cached gradient for `key`, otherwise
 * builds one with `make`, stores, and returns it. Clears the cache past `limit`
 * to bound growth from procedurally-varied keys.
 */
function cached(
  cache: Map<string, CanvasGradient>,
  key: string,
  limit: number,
  make: () => CanvasGradient
): CanvasGradient {
  let g = cache.get(key);
  if (g) return g;
  if (cache.size > limit) cache.clear();
  g = make();
  cache.set(key, g);
  return g;
}

/** Bucket a sun angle into one of 32 directions (matches the baked light maps). */
function sunBucket(localSunAngle: number): number {
  return Math.round((normalizeAngle(localSunAngle) / TAU) * 32) % 32;
}

const _glowCache = new Map<string, CanvasGradient>();

/**
 * 2-stop radial glow: `color` at center → transparent at `radius`, anchored at
 * the origin. Translate the context to position it; control brightness with
 * `ctx.globalAlpha`.
 */
export function radialGlow(c: CanvasRenderingContext2D, color: string, radius: number): CanvasGradient {
  const rb = Math.max(1, Math.round(radius));
  return cached(_glowCache, color + "|" + rb, 600, () => {
    const g = c.createRadialGradient(0, 0, 0, 0, 0, rb);
    g.addColorStop(0, color);
    g.addColorStop(1, "transparent");
    return g;
  });
}

const _asteroidShadowCache = new Map<string, CanvasGradient>();
const _asteroidShadeCache = new Map<string, CanvasGradient>();
const _asteroidBodyCache = new Map<string, CanvasGradient>();

export function getAsteroidDropShadowGrad(c: CanvasRenderingContext2D, radius: number): CanvasGradient {
  const rb = Math.max(1, Math.round(radius));
  return cached(_asteroidShadowCache, `${rb}`, 200, () => {
    const g = c.createRadialGradient(0, 0, 0, 0, 0, rb * 1.1);
    g.addColorStop(0, "rgba(0,0,0,0.32)");
    g.addColorStop(0.55, "rgba(0,0,0,0.14)");
    g.addColorStop(1, "transparent");
    return g;
  });
}

export function getAsteroidShadeGrad(c: CanvasRenderingContext2D, radius: number, localSunAngle: number): CanvasGradient {
  const rb = Math.max(1, Math.round(radius));
  const ab = sunBucket(localSunAngle);
  return cached(_asteroidShadeCache, `${rb}|${ab}`, 400, () => {
    const angle = (ab / 32) * TAU;
    const sdx = Math.cos(angle);
    const sdy = Math.sin(angle);
    const g = c.createLinearGradient(sdx * rb, sdy * rb, -sdx * rb, -sdy * rb);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(0.4, "rgba(0,0,0,0)");
    g.addColorStop(0.75, "rgba(0,0,0,0.50)");
    g.addColorStop(1, "rgba(0,0,0,0.78)");
    return g;
  });
}

export function getAsteroidBodyGrad(
  c: CanvasRenderingContext2D,
  radius: number,
  h: number,
  s: number,
  hp: number,
  localSunAngle: number
): CanvasGradient {
  const rb = Math.max(1, Math.round(radius));
  const hb = Math.round(h);
  const sb = Math.round(s);
  const hpb = Math.round(hp * 10) / 10;
  const ab = sunBucket(localSunAngle);

  const key = `${rb}|${hb}|${sb}|${hpb}|${ab}`;
  return cached(_asteroidBodyCache, key, 800, () => {
    const angle = (ab / 32) * TAU;
    const aHL = rb * 0.38;
    const hlx = Math.cos(angle) * aHL;
    const hly = Math.sin(angle) * aHL;

    const g = c.createRadialGradient(hlx, hly, 0, 0, 0, rb);
    g.addColorStop(0, `hsl(${hb},${sb + 4}%,${44 + hpb * 14}%)`);
    g.addColorStop(0.45, `hsl(${hb},${sb}%,${22 + hpb * 8}%)`);
    g.addColorStop(0.85, `hsl(${hb},${Math.max(0, sb - 4)}%,${10 + hpb * 5}%)`);
    g.addColorStop(1, `hsl(${hb},${Math.max(0, sb - 6)}%,${4 + hpb * 3}%)`);
    return g;
  });
}

const _shieldBubbleCache = new Map<string, CanvasGradient>();
const _shieldImpactCache = new Map<string, CanvasGradient>();
const _hullSparkCache = new Map<string, CanvasGradient>();

/** Cache player/enemy shield bubble gradients. Modulated via globalAlpha. */
export function getShieldBubbleGrad(c: CanvasRenderingContext2D, offset: number, shieldR: number): CanvasGradient {
  const ob = Math.round(offset);
  const rb = Math.max(1, Math.round(shieldR));
  const key = `${ob}|${rb}`;
  return cached(_shieldBubbleCache, key, 100, () => {
    const g = c.createRadialGradient(-ob, -ob * 1.2, ob * 0.4, 0, 0, rb);
    g.addColorStop(0,    `rgba(30,100,180,${0.12 * 0.15})`);
    g.addColorStop(0.5,  `rgba(40,140,210,${0.12 * 0.4})`);
    g.addColorStop(0.78, `rgba(50,170,240,${0.12 * 0.75})`);
    g.addColorStop(0.88, `rgba(80,200,255,${0.12 * 1.0})`);
    g.addColorStop(0.94, `rgba(100,220,255,${0.12 * 0.7})`);
    g.addColorStop(1,    `rgba(40,120,200,0)`);
    return g;
  });
}

/** Cache shield impact flash gradients. Centered at the origin (translate first). */
export function getShieldImpactGrad(c: CanvasRenderingContext2D, flashSz: number): CanvasGradient {
  const fs = Math.max(1, Math.round(flashSz));
  return cached(_shieldImpactCache, `${fs}`, 100, () => {
    const g = c.createRadialGradient(0, 0, 0, 0, 0, fs);
    g.addColorStop(0,   "rgba(230,250,255,1.0)");
    g.addColorStop(0.35,"rgba(150,220,255,0.55)");
    g.addColorStop(0.7, "rgba(80,190,255,0.15)");
    g.addColorStop(1,   "rgba(40,150,255,0)");
    return g;
  });
}

/** Cache player/enemy hull impact sparks. Centered at the origin with bucketed radius. */
export function getHullSparkGrad(c: CanvasRenderingContext2D, radius: number): CanvasGradient {
  const rb = Math.max(1, Math.round(radius));
  return cached(_hullSparkCache, `${rb}`, 50, () => {
    const g = c.createRadialGradient(0, 0, 0, 0, 0, rb);
    g.addColorStop(0, "rgba(255,255,220,0.95)");
    g.addColorStop(0.25, "rgba(255,180,60,0.7)");
    g.addColorStop(0.6, "rgba(255,100,30,0.25)");
    g.addColorStop(1, "rgba(200,50,10,0)");
    return g;
  });
}
