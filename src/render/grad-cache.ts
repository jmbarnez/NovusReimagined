/**
 * Cached canvas gradients anchored at the origin.
 *
 * createRadialGradient allocates a new object on every call; in the 60Hz render
 * loop with hundreds of bullets/particles that is real GC churn and frame jitter.
 * These origin-anchored gradients depend only on color + bucketed radius, so
 * callers translate the context to position them and modulate intensity via
 * globalAlpha — the cached gradient itself never changes.
 */

const _glowCache = new Map<string, CanvasGradient>();

/**
 * 2-stop radial glow: `color` at center → transparent at `radius`, anchored at
 * the origin. Translate the context to position it; control brightness with
 * `ctx.globalAlpha`.
 */
export function radialGlow(c: CanvasRenderingContext2D, color: string, radius: number): CanvasGradient {
  const rb = Math.max(1, Math.round(radius));
  const key = color + "|" + rb;
  let g = _glowCache.get(key);
  if (g) return g;
  // Guard against unbounded growth from procedurally-varied colors.
  if (_glowCache.size > 600) _glowCache.clear();
  g = c.createRadialGradient(0, 0, 0, 0, 0, rb);
  g.addColorStop(0, color);
  g.addColorStop(1, "transparent");
  _glowCache.set(key, g);
  return g;
}
