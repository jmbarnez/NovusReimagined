/**
 * PixiJS particle renderer — Phase 2.
 *
 * Replaces per-frame createRadialGradient + arc draws with a pre-baked
 * white radial gradient texture that is tinted per sprite. All active
 * particles map 1-to-1 onto a fixed sprite pool; unused pool slots are
 * hidden rather than destroyed to avoid GC pressure.
 *
 * Float texts remain in Canvas 2D this phase because they must render
 * above live enemy sprites. They will migrate in Phase 3 once enemies
 * are in PixiJS and the draw order is correct.
 */
import { Container, ImageSource, Sprite, Texture } from "pixi.js";
import { getState } from "../state-access.js";
import { app, effectLayer, pixiDpr } from "../pixi.js";

const POOL_SIZE = 512;
const TEX_SIZE = 64; // px — radius = 32

let _container: Container | null = null;
let _pool: Sprite[] = [];
let _tex: Texture | null = null;

// ─── CSS colour → PixiJS hex ─────────────────────────────────────────────────
// Uses a 1×1 hidden canvas to let the browser parse any CSS colour string.
// Results are cached so repeated colours (very common) pay zero cost.
const _colCanvas = (() => {
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  return c;
})();
const _colCtx = _colCanvas.getContext("2d")!;
const _colCache = new Map<string, number>();

function cssToHex(css: string): number {
  const hit = _colCache.get(css);
  if (hit !== undefined) return hit;
  _colCtx.clearRect(0, 0, 1, 1);
  _colCtx.fillStyle = css;
  _colCtx.fillRect(0, 0, 1, 1);
  const d = _colCtx.getImageData(0, 0, 1, 1).data;
  const hex = (d[0] << 16) | (d[1] << 8) | d[2];
  _colCache.set(css, hex);
  return hex;
}

// ─── Texture ─────────────────────────────────────────────────────────────────
// White radial gradient: opaque at centre, fully transparent at edge.
// Sprites are tinted per-particle; the gradient shape gives the soft glow.
function bakeTexture(): Texture {
  const dpr = pixiDpr;
  const c = document.createElement("canvas");
  c.width = c.height = TEX_SIZE * dpr;
  const cx = c.getContext("2d")!;
  cx.scale(dpr, dpr);
  const r = TEX_SIZE / 2;
  const g = cx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0,    "rgba(255,255,255,1)");
  g.addColorStop(0.45, "rgba(255,255,255,0.55)");
  g.addColorStop(1,    "rgba(255,255,255,0)");
  cx.fillStyle = g;
  cx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  return new Texture({ source: new ImageSource({ resource: c, resolution: dpr }) });
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function initPixiParticles(): void {
  if (!app || !effectLayer) return;

  // Clean up any orphaned container from HMR or prior destroyPixi()
  for (let i = effectLayer.children.length - 1; i >= 0; i--) {
    const child = effectLayer.children[i];
    if (child.label === "particles") {
      effectLayer.removeChild(child);
      child.destroy({ children: true });
    }
  }

  _tex = bakeTexture();

  _container = new Container();
  _container.label = "particles";
  effectLayer.addChild(_container);

  _pool = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const s = new Sprite(_tex);
    s.anchor.set(0.5);
    s.visible = false;
    _container.addChild(s);
    _pool.push(s);
  }
}

export function destroyPixiParticles(): void {
  if (_container) {
    const parent = _container.parent;
    if (parent && !parent.destroyed) parent.removeChild(_container);
    if (!_container.destroyed) _container.destroy({ children: true });
  }
  _container = null;
  _pool = [];
  if (_tex && !_tex.destroyed) _tex.destroy(true);
  _tex = null;
}

/**
 * Sync sprite pool with getState().particles. Call once per rendered frame,
 * after physics has already updated particle positions and pruned dead ones.
 */
export function syncPixiParticles(): void {
  if (!_container || !_container.parent) {
    initPixiParticles();
    if (!_container) return;
  }

  const particles = getState().particles;
  const half = TEX_SIZE / 2;

  // Single pass through pool - update active particles, hide inactive ones
  for (let i = 0; i < POOL_SIZE; i++) {
    const s = _pool[i];
    const p = particles[i];
    if (!p) {
      if (s.visible) s.visible = false;
      continue;
    }
    s.visible = true;
    s.x = p.x;
    s.y = p.y;
    s.alpha = Math.min(1, (p.life ?? 0) * 0.75);
    s.scale.set((p.r ?? 1) / half);
    // Only update tint if color changed (cache hit is fast, but still avoid calls)
    const hex = cssToHex(p.color);
    if (s.tint !== hex) s.tint = hex;
  }
}
