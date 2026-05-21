/**
 * PixiJS player renderer — minimal trail dots.
 *
 * Replaced the complex multi-layer trail system (exhaust glow sprite,
 * bloom passes, per-nozzle segments, per-frame randomization) with
 * a single minimal trail: small coloured dots that fade out.
 */
import { ImageSource, Sprite, Texture } from "pixi.js";
import { G, Client } from "../state.js";
import { SHIPS } from "../data/ships.js";
import { entityLayer, thrustLayer, pixiDpr } from "../pixi.js";
import { lerp } from "../utils/math.js";
import { getNebulaDensity } from "./pixi-background.js";

const TAU = Math.PI * 2;
const HULL_SCALE = 1.0;
const LIGHT_DIRS = 8;
const LIGHT_RGB = "255,248,230";
/** Supersampling multiplier — baked canvas physical pixels per logical texel. */
const TEX_SCALE = 3;

// ─── DPR-aware texture factory ────────────────────────────────────────────────
function canvasToTexture(c: HTMLCanvasElement, dpr: number): Texture {
  const mipmapping = Client.settings?.mipmapping ?? true;
  return new Texture({ source: new ImageSource({ resource: c, resolution: TEX_SCALE * dpr, scaleMode: 'linear', autoGenerateMipmaps: mipmapping }) });
}

// ─── Ship hull texture ────────────────────────────────────────────────────────
const SHIP_TEX = 128;
const SHIP_HALF = SHIP_TEX / 2;

const _shipTexCache = new Map<string, Texture>();

function bakeShipTexture(shipId: string): Texture {
  const ship = SHIPS[shipId];
  if (!ship) return Texture.EMPTY;
  const r = ship.render;
  const dpr = pixiDpr;

  const c = document.createElement("canvas");
  c.width = c.height = SHIP_TEX * TEX_SCALE * dpr;
  const cx = c.getContext("2d")!;
  cx.scale(TEX_SCALE * dpr, TEX_SCALE * dpr);

  function shipPath() {
    cx.beginPath();
    for (let i = 0; i < r.path.length; i++) {
      const [px, py] = r.path[i];
      i === 0 ? cx.moveTo(SHIP_HALF + px, SHIP_HALF + py) : cx.lineTo(SHIP_HALF + px, SHIP_HALF + py);
    }
    cx.closePath();
  }

  // 1. Depth outline
  shipPath();
  cx.strokeStyle = "rgba(0,0,0,0.92)";
  cx.lineWidth = 2.5;
  cx.lineJoin = "round";
  cx.stroke();

  // 2. Smooth gradient fill
  shipPath();
  const baseCol = r.fill;
  const hullGrad = cx.createLinearGradient(SHIP_HALF, SHIP_HALF - 30, SHIP_HALF, SHIP_HALF + 30);
  hullGrad.addColorStop(0.0, lightenCol(baseCol, 18));
  hullGrad.addColorStop(0.45, baseCol);
  hullGrad.addColorStop(1.0, darkenCol(baseCol, 22));
  cx.fillStyle = hullGrad;
  cx.fill();

  // 3. Specular sheen + ambient occlusion (clipped to hull)
  cx.save();
  shipPath();
  cx.clip();
  const spec = cx.createRadialGradient(SHIP_HALF + 6, SHIP_HALF - 16, 0, SHIP_HALF + 6, SHIP_HALF - 16, 42);
  spec.addColorStop(0, "rgba(255,255,255,0.20)");
  spec.addColorStop(0.55, "rgba(255,255,255,0.06)");
  spec.addColorStop(1, "rgba(255,255,255,0)");
  cx.fillStyle = spec;
  cx.fillRect(SHIP_HALF - 50, SHIP_HALF - 50, 100, 100);
  const ao = cx.createLinearGradient(SHIP_HALF, SHIP_HALF + 5, SHIP_HALF, SHIP_HALF + 35);
  ao.addColorStop(0, "rgba(0,0,0,0)");
  ao.addColorStop(1, "rgba(0,0,0,0.32)");
  cx.fillStyle = ao;
  cx.fillRect(SHIP_HALF - 50, SHIP_HALF - 50, 100, 100);
  cx.restore();

  // 4. Coloured edge stroke (rim)
  shipPath();
  cx.strokeStyle = r.stroke;
  cx.lineWidth = 1.2;
  cx.lineJoin = "round";
  cx.stroke();

  // 5. Hairline panel lines
  for (const line of r.panelLines ?? []) {
    cx.beginPath();
    for (let i = 0; i < line.length; i++) {
      const [px, py] = line[i];
      i === 0 ? cx.moveTo(SHIP_HALF + px, SHIP_HALF + py) : cx.lineTo(SHIP_HALF + px, SHIP_HALF + py);
    }
    cx.strokeStyle = "rgba(0,0,0,0.45)";
    cx.lineWidth = 1.0;
    cx.lineJoin = "round";
    cx.lineCap = "round";
    cx.stroke();
  }

  // 6. Nav / hull lights with soft halos
  for (const lt of r.lights ?? []) {
    const lx = SHIP_HALF + lt.x, ly = SHIP_HALF + lt.y;
    const lr = lt.r ?? 1;
    const col = lt.color ?? "rgba(200,200,255,0.5)";
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

  // 7. Nozzles (gradient + rim)
  for (const [nx, ny] of r.nozzleOffsets) {
    const nx2 = SHIP_HALF + nx + 2, ny2 = SHIP_HALF + ny;
    const ng = cx.createRadialGradient(nx2, ny2, 0, nx2, ny2, 5);
    ng.addColorStop(0, "rgba(60,60,70,0.35)");
    ng.addColorStop(1, "rgba(60,60,70,0)");
    cx.fillStyle = ng;
    cx.beginPath(); cx.arc(nx2, ny2, 5, 0, TAU); cx.fill();
    cx.beginPath(); cx.arc(nx2, ny2, 3.5, 0, TAU);
    cx.strokeStyle = "rgba(15,15,20,0.45)";
    cx.lineWidth = 1.2;
    cx.stroke();
    cx.beginPath(); cx.arc(nx2, ny2, 2.5, 0, TAU);
    cx.fillStyle = "rgba(10,10,16,0.6)";
    cx.fill();
  }

  // 8. Cockpit (gradient glass + rim)
  cx.lineJoin = "miter";
  const cp = r.cockpit ?? { cx: 10, cy: 0, rx: 6, ry: 4 };
  const cpx = SHIP_HALF + cp.cx, cpy = SHIP_HALF + cp.cy;
  const cgCol = r.cockpitColor ?? "rgba(140,210,255,0.55)";
  const cg = cx.createLinearGradient(cpx - cp.rx, cpy - cp.ry, cpx + cp.rx, cpy + cp.ry);
  cg.addColorStop(0, lightenCol(cgCol, 20));
  cg.addColorStop(0.5, cgCol);
  cg.addColorStop(1, darkenCol(cgCol, 15));
  cx.fillStyle = cg;
  cx.beginPath();
  cx.ellipse(cpx, cpy, cp.rx, cp.ry, 0, 0, TAU);
  cx.fill();
  cx.strokeStyle = "rgba(255,255,255,0.25)";
  cx.lineWidth = 0.8;
  cx.beginPath();
  cx.ellipse(cpx, cpy, cp.rx, cp.ry, 0, 0, TAU);
  cx.stroke();

  // Cockpit specular dot — sells the glass read
  const sdR = Math.min(cp.rx, cp.ry) * 0.32;
  cx.beginPath();
  cx.arc(cpx - cp.rx * 0.32, cpy - cp.ry * 0.32, sdR, 0, TAU);
  cx.fillStyle = "rgba(255,255,255,0.52)";
  cx.fill();

  // 9. Sensor glow (soft radial)
  if (r.sensorGlow) {
    const sg = r.sensorGlow;
    const sgx = SHIP_HALF + sg.x, sgy = SHIP_HALF + sg.y;
    const sgGrad = cx.createRadialGradient(sgx, sgy, 0, sgx, sgy, sg.r * 2);
    sgGrad.addColorStop(0, sg.color ?? "rgba(100,170,255,0.40)");
    sgGrad.addColorStop(1, (sg.color ?? "rgba(100,170,255,0.40)").replace(/[\d.]+\)$/, "0)"));
    cx.fillStyle = sgGrad;
    cx.beginPath(); cx.arc(sgx, sgy, sg.r * 2, 0, TAU); cx.fill();
  }

  return canvasToTexture(c, dpr);
}

// ─── Colour helpers ───────────────────────────────────────────────────────────
function lightenCol(col: string, amt: number): string {
  const m = col.match(/rgba?\((\d+),(\d+),(\d+)(?:,([\d.]+))?\)/);
  if (!m) return col;
  const r = Math.min(255, parseInt(m[1]) + amt);
  const g = Math.min(255, parseInt(m[2]) + amt);
  const b = Math.min(255, parseInt(m[3]) + amt);
  const a = m[4] ?? "1";
  return `rgba(${r},${g},${b},${a})`;
}
function darkenCol(col: string, amt: number): string {
  const m = col.match(/rgba?\((\d+),(\d+),(\d+)(?:,([\d.]+))?\)/);
  if (!m) return col;
  const r = Math.max(0, parseInt(m[1]) - amt);
  const g = Math.max(0, parseInt(m[2]) - amt);
  const b = Math.max(0, parseInt(m[3]) - amt);
  const a = m[4] ?? "1";
  return `rgba(${r},${g},${b},${a})`;
}

function getShipTexture(shipId: string): Texture {
  let t = _shipTexCache.get(shipId);
  if (!t) { t = bakeShipTexture(shipId); _shipTexCache.set(shipId, t); }
  return t;
}

// ─── Directional light maps ──────────────────────────────────────────────────
// LIGHT_DIRS hull-clipped textures, each lit from a different angle. The live
// ship picks the one nearest its local sun direction (sys.sunDir − shipAngle).
const _shipLightCache = new Map<string, Texture[]>();

function bakeShipLightTextures(shipId: string): Texture[] {
  const ship = SHIPS[shipId];
  if (!ship) return [];
  const r = ship.render;
  const dpr = pixiDpr;
  const out: Texture[] = [];

  for (let d = 0; d < LIGHT_DIRS; d++) {
    const a = (d / LIGHT_DIRS) * TAU;
    const c = document.createElement("canvas");
    c.width = c.height = SHIP_TEX * TEX_SCALE * dpr;
    const cx = c.getContext("2d")!;
    cx.scale(TEX_SCALE * dpr, TEX_SCALE * dpr);

    cx.beginPath();
    for (let i = 0; i < r.path.length; i++) {
      const [px, py] = r.path[i];
      i === 0 ? cx.moveTo(SHIP_HALF + px, SHIP_HALF + py) : cx.lineTo(SHIP_HALF + px, SHIP_HALF + py);
    }
    cx.closePath();
    cx.clip();

    const ex = Math.cos(a) * SHIP_HALF, ey = Math.sin(a) * SHIP_HALF;
    const g = cx.createLinearGradient(SHIP_HALF - ex, SHIP_HALF - ey, SHIP_HALF + ex, SHIP_HALF + ey);
    g.addColorStop(0.00, `rgba(${LIGHT_RGB},0)`);
    g.addColorStop(0.50, `rgba(${LIGHT_RGB},0)`);
    g.addColorStop(0.82, `rgba(${LIGHT_RGB},0.45)`);
    g.addColorStop(1.00, `rgba(${LIGHT_RGB},0.9)`);
    cx.fillStyle = g;
    cx.fillRect(0, 0, SHIP_TEX, SHIP_TEX);

    out.push(canvasToTexture(c, dpr));
  }
  return out;
}

function getShipLightTextures(shipId: string): Texture[] {
  let t = _shipLightCache.get(shipId);
  if (!t) { t = bakeShipLightTextures(shipId); _shipLightCache.set(shipId, t); }
  return t;
}

// ─── Shared dot texture ───────────────────────────────────────────────────────
// White circle — tinted per trail segment.
const DOT_TEX = 32;
const DOT_HALF = DOT_TEX / 2;

let _dotTex: Texture | null = null;

function bakeDotTexture(): Texture {
  const dpr = pixiDpr;
  const c = document.createElement("canvas");
  c.width = c.height = DOT_TEX * TEX_SCALE * dpr;
  const cx = c.getContext("2d")!;
  cx.scale(TEX_SCALE * dpr, TEX_SCALE * dpr);
  const g = cx.createRadialGradient(DOT_HALF, DOT_HALF, 0, DOT_HALF, DOT_HALF, DOT_HALF);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.5, "rgba(255,255,255,0.5)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  cx.fillStyle = g;
  cx.fillRect(0, 0, DOT_TEX, DOT_TEX);
  return canvasToTexture(c, dpr);
}

// ─── Player bundle ────────────────────────────────────────────────────────────
let _hullSprite: Sprite | null = null;
let _hullLightSprite: Sprite | null = null;
let _shipLightTex: Texture[] = [];
let _currentShipId = "";

function destroyPlayerSprites() {
  if (_hullSprite) { entityLayer?.removeChild(_hullSprite); _hullSprite.destroy(); _hullSprite = null; }
  if (_hullLightSprite) { entityLayer?.removeChild(_hullLightSprite); _hullLightSprite.destroy(); _hullLightSprite = null; }
  _shipLightTex = [];
  _currentShipId = "";
}

function buildPlayerSprites(shipId: string) {
  if (!entityLayer || !_dotTex) return;
  destroyPlayerSprites();

  _hullSprite = new Sprite(getShipTexture(shipId));
  _hullSprite.anchor.set(0.5);
  _hullSprite.scale.set(HULL_SCALE);
  _hullSprite.visible = false;
  entityLayer.addChild(_hullSprite);

  // Directional light overlay — sits directly above the hull, additive blend.
  _shipLightTex = getShipLightTextures(shipId);
  _hullLightSprite = new Sprite(_shipLightTex[0] ?? Texture.EMPTY);
  _hullLightSprite.anchor.set(0.5);
  _hullLightSprite.scale.set(HULL_SCALE);
  _hullLightSprite.blendMode = "add";
  _hullLightSprite.alpha = 0.7;
  _hullLightSprite.visible = false;
  entityLayer.addChild(_hullLightSprite);

  _currentShipId = shipId;
}

// ─── Trail sprite pool ────────────────────────────────────────────────────────
// Bumped from 128 → 384 to accommodate longer-lived trails (player + AB +
// every enemy emitting), and switched to additive blending so the engine
// exhaust reads as a glowing flame rather than a faint tinted dot.
const TRAIL_POOL = 384;
const _trailPool: Sprite[] = [];

function buildTrailPool() {
  if (!thrustLayer || !_dotTex) return;
  for (let i = 0; i < TRAIL_POOL; i++) {
    const s = new Sprite(_dotTex);
    s.anchor.set(0.5);
    s.visible = false;
    s.blendMode = "add";
    thrustLayer.addChild(s);
    _trailPool.push(s);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function initPixiPlayer(): void {
  _dotTex = bakeDotTexture();
  buildPlayerSprites(G.P?.shipId ?? "scout");
  buildTrailPool();
}

/** Clear all cached ship/hull/light textures so they re-bake at the current DPR. */
export function clearShipTextureCaches(): void {
  for (const t of _shipTexCache.values()) t.destroy();
  _shipTexCache.clear();
  for (const arr of _shipLightCache.values()) {
    for (const t of arr) t.destroy();
  }
  _shipLightCache.clear();
  if (_dotTex) { _dotTex.destroy(); _dotTex = null; }
}

/** Destroy and rebuild the player hull + light sprites with freshly baked textures. */
export function rebuildPlayerSprites(): void {
  destroyPlayerSprites();
  buildPlayerSprites(G.P?.shipId ?? "scout");
  // Rebuild trail pool with fresh dot texture.
  if (_dotTex) {
    for (const s of _trailPool) {
      s.texture = _dotTex;
    }
  }
}

export function syncPixiPlayer(alpha: number, now: number): void {
  if (!_hullSprite || !G.P) return;

  if (G.P.shipId !== _currentShipId) {
    buildPlayerSprites(G.P.shipId);
    return;
  }

  const ix = lerp(G.P.px, G.P.x, alpha);
  const iy = lerp(G.P.py, G.P.y, alpha);
  const ia = lerp(G.P.prevAngle, G.P.angle, alpha);

  // Invincibility blink
  if (G.P.invincible > 0 && Math.floor(now / 75) % 2 === 0) {
    _hullSprite.visible = false;
    if (_hullLightSprite) _hullLightSprite.visible = false;
    return;
  }
  _hullSprite.visible = true;

  // LOD: prevent the ship from shrinking below a minimum on-screen size
  const lodScale = Math.max(Client.zoom, 0.55);
  _hullSprite.scale.set(HULL_SCALE * lodScale / Client.zoom);

  // Banking tilt
  const latV = G.P.vx * Math.sin(ia) - G.P.vy * Math.cos(ia);
  const bankTilt = Math.max(-0.13, Math.min(0.13, latV * 0.0045));
  const angle = ia + (Math.abs(bankTilt) > 0.002 ? bankTilt : 0);

  _hullSprite.x = ix;
  _hullSprite.y = iy;
  _hullSprite.rotation = angle;

  // Directional light overlay — texture picked by local sun direction.
  if (_hullLightSprite) {
    _hullLightSprite.scale.set(HULL_SCALE * lodScale / Client.zoom);
    if (Client.settings?.directionalLighting !== false && _shipLightTex.length) {
      const sys = G.GALAXY?.[G.P?.sysIdx ?? 0];
      const _sd = sys?.sunDir ?? 0;
      const sunDir = Math.atan2(Math.sin(_sd) * 3500 - iy, Math.cos(_sd) * 3500 - ix);
      let di = Math.round(((sunDir - angle) / TAU) * LIGHT_DIRS) % LIGHT_DIRS;
      if (di < 0) di += LIGHT_DIRS;
      _hullLightSprite.texture = _shipLightTex[di];
      _hullLightSprite.x = ix;
      _hullLightSprite.y = iy;
      _hullLightSprite.rotation = angle;
      _hullLightSprite.visible = true;

      // Dynamic nebula lighting
      const density = getNebulaDensity(ix, iy);
      _hullLightSprite.alpha = 0.45 + density * 1.8;
    } else {
      _hullLightSprite.visible = false;
    }
  }
}

export function syncPixiTrails(): void {
  const trails = G.trails;
  for (let i = 0; i < TRAIL_POOL; i++) {
    const s = _trailPool[i];
    if (!s) continue;
    const t = trails[i];
    if (!t || t.life <= 0) {
      if (s.visible) s.visible = false;
      continue;
    }
    const a = t.life / Math.max(0.001, t.maxLife);
    s.visible = true;
    s.x = t.x;
    s.y = t.y;
    // Particle dot — small round puff that shrinks as it ages. Uniform scale,
    // no rotation, no elongation — reads as discrete particles in a stream.
    const base = (t.width * 0.55 * a) / DOT_HALF;
    s.scale.set(base, base);
    s.rotation = 0;
    s.alpha = a * 0.85;
    s.tint = parseInt(t.color.replace("#", ""), 16) || 0xffffff;
  }
}
