/**
 * PixiJS player renderer.
 *
 * Flame thrust is rendered by pixi-thrust.ts. This file owns the shared Trail
 * sprite pool, including speed-based engine exhaust sheets and blink afterimages.
 */
import { ImageSource, Sprite, Texture } from "pixi.js";
import { Client } from "../state.js";
import { getState } from "../state-access.js";
import { SHIPS, type ShipDecor } from "../data/ships.js";
import { entityLayer, thrustLayer, pixiDpr } from "../pixi.js";
import { lerp } from "../utils/math.js";
import { isVisible } from "../utils/game.js";
import { getNebulaDensity } from "./pixi-background.js";
import { lightenCol, darkenCol } from "../utils/color.js";
import { tracePath } from "./bake-utils.js";
import { displayShipAngle } from "./display-orientation.js";

const TAU = Math.PI * 2;
const HULL_SCALE = 1.0;
const LIGHT_DIRS = 8;
const LIGHT_RGB = "255,248,230";
/** Supersampling multiplier — baked canvas physical pixels per logical texel. */
const TEX_SCALE = 4;

// ─── DPR-aware texture factory ────────────────────────────────────────────────
function canvasToTexture(c: HTMLCanvasElement, dpr: number): Texture {
  const mipmapping = Client.settings?.mipmapping ?? true;
  return new Texture({ source: new ImageSource({ resource: c, resolution: TEX_SCALE * dpr, scaleMode: 'linear', autoGenerateMipmaps: mipmapping }) });
}

// ─── Ship hull texture ────────────────────────────────────────────────────────
const SHIP_TEX = 160;
const SHIP_HALF = SHIP_TEX / 2;

const _shipTexCache = new Map<string, Texture>();

function traceDecorPath(cx: CanvasRenderingContext2D, points: number[][]): void {
  cx.beginPath();
  for (let i = 0; i < points.length; i++) {
    const [px, py] = points[i];
    i === 0 ? cx.moveTo(SHIP_HALF + px, SHIP_HALF + py) : cx.lineTo(SHIP_HALF + px, SHIP_HALF + py);
  }
}

function drawDecor(cx: CanvasRenderingContext2D, decor: ShipDecor): void {
  const alpha = decor.alpha ?? 1;
  cx.save();
  cx.globalAlpha *= alpha;

  if (decor.kind === "plate") {
    traceDecorPath(cx, decor.points);
    cx.closePath();
    cx.fillStyle = decor.fill;
    cx.fill();
    if (decor.stroke) {
      cx.strokeStyle = decor.stroke;
      cx.lineWidth = 0.75;
      cx.lineJoin = "round";
      cx.stroke();
    }
  } else if (decor.kind === "line") {
    traceDecorPath(cx, decor.points);
    cx.strokeStyle = decor.color;
    cx.lineWidth = decor.width;
    cx.lineJoin = "round";
    cx.lineCap = "round";
    cx.stroke();
  } else if (decor.kind === "vent") {
    const count = Math.max(1, decor.count ?? 3);
    const gap = decor.w / (count * 2 - 1);
    cx.fillStyle = decor.color;
    for (let i = 0; i < count; i++) {
      cx.fillRect(SHIP_HALF + decor.x + i * gap * 2, SHIP_HALF + decor.y, gap, decor.h);
    }
  } else {
    cx.beginPath();
    cx.arc(SHIP_HALF + decor.x, SHIP_HALF + decor.y, decor.r, 0, TAU);
    cx.fillStyle = decor.fill;
    cx.fill();
    if (decor.stroke) {
      cx.strokeStyle = decor.stroke;
      cx.lineWidth = 0.7;
      cx.stroke();
    }
  }

  cx.restore();
}

function bakeShipTexture(shipId: string): Texture {
  const ship = SHIPS[shipId];
  if (!ship) return Texture.EMPTY;
  const r = ship.render;
  const dpr = pixiDpr;

  const c = document.createElement("canvas");
  c.width = c.height = SHIP_TEX * TEX_SCALE * dpr;
  const cx = c.getContext("2d")!;
  cx.scale(TEX_SCALE * dpr, TEX_SCALE * dpr);

  const shipPath = () => tracePath(cx, r.path, SHIP_HALF);

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

  // 4a. Metallic rim highlight — upper-left quadrant specular arc
  shipPath();
  cx.strokeStyle = "rgba(160,200,230,0.55)";
  cx.lineWidth = 0.7;
  cx.lineJoin = "round";
  cx.stroke();

  // 5. Role-specific plates, stripes, vents, and small fittings.
  cx.save();
  shipPath();
  cx.clip();
  for (const decor of r.decor ?? []) {
    drawDecor(cx, decor);
  }
  cx.restore();

  // 5a. Recessed panel lines with a tiny lit edge.
  for (const line of r.panelLines ?? []) {
    cx.beginPath();
    for (let i = 0; i < line.length; i++) {
      const [px, py] = line[i];
      i === 0 ? cx.moveTo(SHIP_HALF + px, SHIP_HALF + py) : cx.lineTo(SHIP_HALF + px, SHIP_HALF + py);
    }
    cx.strokeStyle = "rgba(0,0,0,0.58)";
    cx.lineWidth = 1.2;
    cx.lineJoin = "round";
    cx.lineCap = "round";
    cx.stroke();

    cx.save();
    cx.translate(0, -0.55);
    cx.beginPath();
    for (let i = 0; i < line.length; i++) {
      const [px, py] = line[i];
      i === 0 ? cx.moveTo(SHIP_HALF + px, SHIP_HALF + py) : cx.lineTo(SHIP_HALF + px, SHIP_HALF + py);
    }
    cx.strokeStyle = "rgba(210,235,245,0.18)";
    cx.lineWidth = 0.45;
    cx.lineJoin = "round";
    cx.lineCap = "round";
    cx.stroke();
    cx.restore();
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

  // 7. Cockpit (gradient glass + rim)
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

interface RemotePlayerSprites {
  hull: Sprite;
  light: Sprite;
  lightTex: Texture[];
  shipId: string;
}

const _remotePlayerSprites = new Map<string, RemotePlayerSprites>();

function destroyPlayerSprites() {
  if (_hullSprite) { entityLayer?.removeChild(_hullSprite); _hullSprite.destroy(); _hullSprite = null; }
  if (_hullLightSprite) { entityLayer?.removeChild(_hullLightSprite); _hullLightSprite.destroy(); _hullLightSprite = null; }
  _shipLightTex = [];
  _currentShipId = "";
}

function destroyRemotePlayerSprites(): void {
  for (const bundle of _remotePlayerSprites.values()) {
    entityLayer?.removeChild(bundle.hull);
    entityLayer?.removeChild(bundle.light);
    bundle.hull.destroy();
    bundle.light.destroy();
  }
  _remotePlayerSprites.clear();
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

function createRemotePlayerSprites(shipId: string): RemotePlayerSprites | null {
  if (!entityLayer) return null;

  const hull = new Sprite(getShipTexture(shipId));
  hull.anchor.set(0.5);
  hull.scale.set(HULL_SCALE);
  hull.visible = false;
  entityLayer.addChild(hull);

  const lightTex = getShipLightTextures(shipId);
  const light = new Sprite(lightTex[0] ?? Texture.EMPTY);
  light.anchor.set(0.5);
  light.scale.set(HULL_SCALE);
  light.blendMode = "add";
  light.alpha = 0.7;
  light.visible = false;
  entityLayer.addChild(light);

  return { hull, light, lightTex, shipId };
}

function getRemotePlayerSprites(netId: string, shipId: string): RemotePlayerSprites | null {
  const existing = _remotePlayerSprites.get(netId);
  if (existing?.shipId === shipId) return existing;

  if (existing) {
    entityLayer?.removeChild(existing.hull);
    entityLayer?.removeChild(existing.light);
    existing.hull.destroy();
    existing.light.destroy();
    _remotePlayerSprites.delete(netId);
  }

  const created = createRemotePlayerSprites(shipId);
  if (created) _remotePlayerSprites.set(netId, created);
  return created;
}

// ─── Trail sprite pool ────────────────────────────────────────────────────────
// Shared renderer for authored Trail effects. Trails with a length render as
// thin sheets; plain trails remain soft dots for abilities such as blink.
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
  buildPlayerSprites(getState().player?.shipId ?? "scout");
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
  destroyRemotePlayerSprites();
  buildPlayerSprites(getState().player?.shipId ?? "scout");
  // Rebuild trail pool with fresh dot texture.
  if (_dotTex) {
    for (const s of _trailPool) {
      s.texture = _dotTex;
    }
  }
}

function syncRemotePlayers(alpha: number, now: number): void {
  const state = getState();
  const local = state.player;
  if (!local) {
    destroyRemotePlayerSprites();
    return;
  }

  const activeRemoteIds = new Set<string>();
  for (const [key, remote] of state.players) {
    const netId = remote.netId ?? key;
    if (!netId || remote === local || netId === local.netId || key === "local") continue;

    activeRemoteIds.add(netId);
    const bundle = getRemotePlayerSprites(netId, remote.shipId || "scout");
    if (!bundle) continue;

    if (remote.sysIdx !== local.sysIdx || !isVisible(remote.x, remote.y, 80)) {
      bundle.hull.visible = false;
      bundle.light.visible = false;
      continue;
    }

    const useRenderInterpolation = Client.multiplayerRole === "none";
    const ix = useRenderInterpolation ? lerp(remote.px, remote.x, alpha) : remote.x;
    const iy = useRenderInterpolation ? lerp(remote.py, remote.y, alpha) : remote.y;
    const ia = useRenderInterpolation ? lerp(remote.prevAngle, remote.angle, alpha) : remote.angle;
    const lodScale = Math.max(Client.zoom, 0.55);

    bundle.hull.visible = true;
    bundle.hull.scale.set(HULL_SCALE * lodScale / Client.zoom);
    bundle.hull.x = ix;
    bundle.hull.y = iy;
    bundle.hull.rotation = ia;

    bundle.light.scale.set(HULL_SCALE * lodScale / Client.zoom);
    if (Client.settings?.directionalLighting !== false && bundle.lightTex.length) {
      const sys = state.GALAXY?.[remote.sysIdx ?? 0];
      const sunSeed = sys?.sunDir ?? 0;
      const sunDir = Math.atan2(Math.sin(sunSeed) * 3500 - iy, Math.cos(sunSeed) * 3500 - ix);
      let lightIdx = Math.round(((sunDir - ia) / TAU) * LIGHT_DIRS) % LIGHT_DIRS;
      if (lightIdx < 0) lightIdx += LIGHT_DIRS;
      bundle.light.texture = bundle.lightTex[lightIdx];
      bundle.light.x = ix;
      bundle.light.y = iy;
      bundle.light.rotation = ia;
      bundle.light.alpha = 0.45 + getNebulaDensity(ix, iy) * 1.8;
      bundle.light.visible = true;
    } else {
      bundle.light.visible = false;
    }

  }

  for (const [netId, bundle] of _remotePlayerSprites) {
    if (activeRemoteIds.has(netId)) continue;
    entityLayer?.removeChild(bundle.hull);
    entityLayer?.removeChild(bundle.light);
    bundle.hull.destroy();
    bundle.light.destroy();
    _remotePlayerSprites.delete(netId);
  }
}

export function syncPixiPlayer(alpha: number, now: number): void {
  if (!_hullSprite || !getState().player) return;

  if (getState().player.shipId !== _currentShipId) {
    buildPlayerSprites(getState().player.shipId);
    return;
  }

  const ix = lerp(getState().player.px, getState().player.x, alpha);
  const iy = lerp(getState().player.py, getState().player.y, alpha);
  const ia = lerp(getState().player.prevAngle, getState().player.angle, alpha);

  // Invincibility blink
  if (getState().player.invincible > 0 && Math.floor(now / 75) % 2 === 0) {
    _hullSprite.visible = false;
    if (_hullLightSprite) _hullLightSprite.visible = false;
    syncRemotePlayers(alpha, now);
    return;
  }
  _hullSprite.visible = true;

  // LOD: prevent the ship from shrinking below a minimum on-screen size
  const lodScale = Math.max(Client.zoom, 0.55);
  _hullSprite.scale.set(HULL_SCALE * lodScale / Client.zoom);

  // Banking tilt
  const angle = displayShipAngle(ia, getState().player.vx, getState().player.vy);

  _hullSprite.x = ix;
  _hullSprite.y = iy;
  _hullSprite.rotation = angle;

  // Directional light overlay — texture picked by local sun direction.
  if (_hullLightSprite) {
    _hullLightSprite.scale.set(HULL_SCALE * lodScale / Client.zoom);
    if (Client.settings?.directionalLighting !== false && _shipLightTex.length) {
      const sys = getState().GALAXY?.[getState().player?.sysIdx ?? 0];
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

  syncRemotePlayers(alpha, now);
}

export function syncPixiTrails(): void {
  const trails = getState().trails;
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
    if (t.length !== undefined && t.angle !== undefined) {
      s.blendMode = "add";
      s.width = t.length * (0.70 + a * 0.24);
      s.height = t.width * (0.48 + a * 0.24);
      s.rotation = t.angle;
      s.alpha = Math.min(0.34, a * 0.34);
    } else {
      s.blendMode = "add";
      const base = (t.width * 0.55 * a) / DOT_HALF;
      s.scale.set(base, base);
      s.rotation = 0;
      s.alpha = a * 0.85;
    }
    s.tint = parseInt(t.color.replace("#", ""), 16) || 0xffffff;
  }
}
