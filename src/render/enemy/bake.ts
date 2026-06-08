/**
 * Enemy texture baking — hull and directional light maps.
 */
import { ImageSource, Texture } from "pixi.js";
import { Client } from "../../state.js";
import { pixiDpr } from "../../pixi.js";
import { ENEMY_DEFS } from "../../data/enemies.js";
import { tracePath } from "../bake-utils.js";
import { lightenCol, darkenCol } from "../../utils/color.js";

const TAU = Math.PI * 2;
/** Supersampling multiplier — baked canvas physical pixels per logical texel. */
const TEX_SCALE = 3;

// ─── Texture baking ──────────────────────────────────────────────────────────
// 192×192 canvas with the enemy centered at (96, 96).  Large enough for the
// biggest enemy type; smaller types are centred in blank space (no cost).
const TEX_SIZE = 192;
const TEX_HALF = TEX_SIZE / 2;

const _texCache = new Map<string, Texture>();

export function bakeEnemyTexture(type: string): Texture {
  const def = ENEMY_DEFS[type];
  const cfg = def?.render;
  if (!cfg) return Texture.EMPTY;

  const dpr = pixiDpr;
  const c = document.createElement("canvas");
  c.width = c.height = TEX_SIZE * TEX_SCALE * dpr;
  const cx = c.getContext("2d")!;
  cx.scale(TEX_SCALE * dpr, TEX_SCALE * dpr);

  // Build the hull path at (HALF, HALF) in canvas coords.
  const buildHullPath = () => tracePath(cx, cfg.path, TEX_HALF);

  // 1. Depth outline
  buildHullPath();
  cx.lineJoin = "round";
  cx.strokeStyle = "rgba(0,0,0,0.92)";
  cx.lineWidth = 2.5;
  cx.stroke();

  // 2. Smooth gradient fill
  buildHullPath();
  const baseCol = cfg.fill;
  const hullGrad = cx.createLinearGradient(TEX_HALF, TEX_HALF - 30, TEX_HALF, TEX_HALF + 30);
  hullGrad.addColorStop(0.0, lightenCol(baseCol, 18));
  hullGrad.addColorStop(0.45, baseCol);
  hullGrad.addColorStop(1.0, darkenCol(baseCol, 22));
  cx.fillStyle = hullGrad;
  cx.fill();

  // 3. Specular sheen + ambient occlusion (clipped to hull)
  cx.save();
  buildHullPath();
  cx.clip();
  const spec = cx.createRadialGradient(TEX_HALF + 6, TEX_HALF - 16, 0, TEX_HALF + 6, TEX_HALF - 16, 42);
  spec.addColorStop(0, "rgba(255,255,255,0.22)");
  spec.addColorStop(0.55, "rgba(255,255,255,0.07)");
  spec.addColorStop(1, "rgba(255,255,255,0)");
  cx.fillStyle = spec;
  cx.fillRect(TEX_HALF - 50, TEX_HALF - 50, 100, 100);
  const ao = cx.createLinearGradient(TEX_HALF, TEX_HALF + 5, TEX_HALF, TEX_HALF + 35);
  ao.addColorStop(0, "rgba(0,0,0,0)");
  ao.addColorStop(1, "rgba(0,0,0,0.35)");
  cx.fillStyle = ao;
  cx.fillRect(TEX_HALF - 50, TEX_HALF - 50, 100, 100);
  cx.restore();

  // 4. Coloured edge stroke (rim)
  buildHullPath();
  cx.strokeStyle = cfg.stroke;
  cx.lineWidth = 1.2;
  cx.lineJoin = "round";
  cx.stroke();

  // 5. Hairline panel lines
  for (const line of cfg.panelLines ?? []) {
    cx.beginPath();
    for (let i = 0; i < line.length; i++) {
      const [px, py] = line[i];
      i === 0 ? cx.moveTo(TEX_HALF + px, TEX_HALF + py) : cx.lineTo(TEX_HALF + px, TEX_HALF + py);
    }
    cx.strokeStyle = "rgba(0,0,0,0.45)";
    cx.lineWidth = 1.0;
    cx.lineJoin = "round";
    cx.lineCap = "round";
    cx.stroke();
  }

  // 6. Lights with soft halos
  for (const l of cfg.lights ?? []) {
    const lx = TEX_HALF + l.x, ly = TEX_HALF + l.y;
    const lr = l.r ?? 1.2;
    const col = l.color ?? "rgba(200,200,255,0.5)";
    const halo = cx.createRadialGradient(lx, ly, 0, lx, ly, lr * 4);
    halo.addColorStop(0, col.replace(/[\d.]+\)$/, "0.35)"));
    halo.addColorStop(1, col.replace(/[\d.]+\)$/, "0)"));
    cx.fillStyle = halo;
    cx.beginPath(); cx.arc(lx, ly, lr * 4, 0, TAU); cx.fill();
    cx.beginPath();
    cx.arc(lx, ly, lr, 0, TAU);
    cx.fillStyle = col;
    cx.fill();
  }

  // 7. Type-specific decorations
  if (type === "drone") {
    cx.beginPath();
    cx.arc(TEX_HALF, TEX_HALF, 5, 0, TAU);
    cx.fillStyle = "#ffaa22";
    cx.fill();
  } else if (type === "raider") {
    cx.fillStyle = "#cc3333";
    cx.fillRect(TEX_HALF + 12, TEX_HALF - 14, 8, 4);
    cx.fillRect(TEX_HALF + 12, TEX_HALF + 10, 8, 4);
  }

  const mipmapping = Client.settings?.mipmapping ?? true;
  return new Texture({ source: new ImageSource({ resource: c, resolution: TEX_SCALE * dpr, scaleMode: 'linear', autoGenerateMipmaps: mipmapping }) });
}

export function getEnemyTexture(type: string): Texture {
  let tex = _texCache.get(type);
  if (!tex) { tex = bakeEnemyTexture(type); _texCache.set(type, tex); }
  return tex;
}

// ─── Directional light maps ──────────────────────────────────────────────────
// LIGHT_DIRS hull-clipped textures per type, each lit from a different angle.
// At render time the enemy selects the texture nearest its local sun direction
// (sys.sunDir − entityRotation) and renders it additively over the hull.
const LIGHT_DIRS = 8;
const LIGHT_RGB = "255,248,230";
const _lightTexCache = new Map<string, Texture[]>();

export function bakeEnemyLightTextures(type: string): Texture[] {
  const def = ENEMY_DEFS[type];
  const cfg = def?.render;
  if (!cfg) return [];
  const dpr = pixiDpr;
  const out: Texture[] = [];

  for (let d = 0; d < LIGHT_DIRS; d++) {
    const a = (d / LIGHT_DIRS) * TAU;
    const c = document.createElement("canvas");
    c.width = c.height = TEX_SIZE * TEX_SCALE * dpr;
    const cx = c.getContext("2d")!;
    cx.scale(TEX_SCALE * dpr, TEX_SCALE * dpr);

    cx.beginPath();
    for (let i = 0; i < cfg.path.length; i++) {
      const [px, py] = cfg.path[i];
      i === 0 ? cx.moveTo(TEX_HALF + px, TEX_HALF + py) : cx.lineTo(TEX_HALF + px, TEX_HALF + py);
    }
    cx.closePath();
    cx.clip();

    const ex = Math.cos(a) * TEX_HALF, ey = Math.sin(a) * TEX_HALF;
    const g = cx.createLinearGradient(TEX_HALF - ex, TEX_HALF - ey, TEX_HALF + ex, TEX_HALF + ey);
    g.addColorStop(0.00, `rgba(${LIGHT_RGB},0)`);
    g.addColorStop(0.50, `rgba(${LIGHT_RGB},0)`);
    g.addColorStop(0.82, `rgba(${LIGHT_RGB},0.45)`);
    g.addColorStop(1.00, `rgba(${LIGHT_RGB},0.9)`);
    cx.fillStyle = g;
    cx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

    const mipmapping = Client.settings?.mipmapping ?? true;
    out.push(new Texture({ source: new ImageSource({ resource: c, resolution: TEX_SCALE * dpr, scaleMode: 'linear', autoGenerateMipmaps: mipmapping }) }));
  }
  return out;
}

export function getEnemyLightTextures(type: string): Texture[] {
  let t = _lightTexCache.get(type);
  if (!t) { t = bakeEnemyLightTextures(type); _lightTexCache.set(type, t); }
  return t;
}

/** Pick the light-map index whose baked direction is nearest `localSunAngle`. */
export function lightDirIndex(localSunAngle: number): number {
  let di = Math.round((localSunAngle / TAU) * LIGHT_DIRS) % LIGHT_DIRS;
  if (di < 0) di += LIGHT_DIRS;
  return di;
}

export function clearEnemyTextureCaches(): void {
  for (const t of _texCache.values()) t.destroy();
  _texCache.clear();
  for (const arr of _lightTexCache.values()) {
    for (const t of arr) t.destroy();
  }
  _lightTexCache.clear();
}
