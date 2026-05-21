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
