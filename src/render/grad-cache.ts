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

const _asteroidShadowCache = new Map<string, CanvasGradient>();
const _asteroidShadeCache = new Map<string, CanvasGradient>();
const _asteroidBodyCache = new Map<string, CanvasGradient>();

export function getAsteroidDropShadowGrad(c: CanvasRenderingContext2D, radius: number): CanvasGradient {
  const rb = Math.max(1, Math.round(radius));
  const key = `${rb}`;
  let g = _asteroidShadowCache.get(key);
  if (g) return g;
  if (_asteroidShadowCache.size > 200) _asteroidShadowCache.clear();
  g = c.createRadialGradient(0, 0, 0, 0, 0, rb * 1.1);
  g.addColorStop(0, "rgba(0,0,0,0.32)");
  g.addColorStop(0.55, "rgba(0,0,0,0.14)");
  g.addColorStop(1, "transparent");
  _asteroidShadowCache.set(key, g);
  return g;
}

export function getAsteroidShadeGrad(c: CanvasRenderingContext2D, radius: number, localSunAngle: number): CanvasGradient {
  const rb = Math.max(1, Math.round(radius));
  const tau = Math.PI * 2;
  let normAngle = localSunAngle % tau;
  if (normAngle < 0) normAngle += tau;
  const ab = Math.round((normAngle / tau) * 32) % 32;
  const key = `${rb}|${ab}`;
  let g = _asteroidShadeCache.get(key);
  if (g) return g;
  if (_asteroidShadeCache.size > 400) _asteroidShadeCache.clear();

  const angle = (ab / 32) * tau;
  const sdx = Math.cos(angle);
  const sdy = Math.sin(angle);
  g = c.createLinearGradient(sdx * rb, sdy * rb, -sdx * rb, -sdy * rb);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(0.4, "rgba(0,0,0,0)");
  g.addColorStop(0.75, "rgba(0,0,0,0.50)");
  g.addColorStop(1, "rgba(0,0,0,0.78)");
  _asteroidShadeCache.set(key, g);
  return g;
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
  
  const tau = Math.PI * 2;
  let normAngle = localSunAngle % tau;
  if (normAngle < 0) normAngle += tau;
  const ab = Math.round((normAngle / tau) * 32) % 32;
  
  const key = `${rb}|${hb}|${sb}|${hpb}|${ab}`;
  let g = _asteroidBodyCache.get(key);
  if (g) return g;
  if (_asteroidBodyCache.size > 800) _asteroidBodyCache.clear();

  const angle = (ab / 32) * tau;
  const aHL = rb * 0.38;
  const hlx = Math.cos(angle) * aHL;
  const hly = Math.sin(angle) * aHL;

  g = c.createRadialGradient(hlx, hly, 0, 0, 0, rb);
  g.addColorStop(0, `hsl(${hb},${sb + 4}%,${44 + hpb * 14}%)`);
  g.addColorStop(0.45, `hsl(${hb},${sb}%,${22 + hpb * 8}%)`);
  g.addColorStop(0.85, `hsl(${hb},${Math.max(0, sb - 4)}%,${10 + hpb * 5}%)`);
  g.addColorStop(1, `hsl(${hb},${Math.max(0, sb - 6)}%,${4 + hpb * 3}%)`);
  
  _asteroidBodyCache.set(key, g);
  return g;
}
