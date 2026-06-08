/**
 * Ship hull texture baking, directional light maps, and trail dot texture.
 */
import { ImageSource, Texture } from "pixi.js";
import { Client } from "../../state.js";
import { SHIPS, type ShipDecor } from "../../data/ships.js";
import { pixiDpr } from "../../pixi.js";
import { lightenCol, darkenCol } from "../../utils/color.js";
import { tracePath } from "../bake-utils.js";

const TAU = Math.PI * 2;
const SHIP_TEX = 160;
const SHIP_HALF = SHIP_TEX / 2;
const LIGHT_DIRS = 8;
const LIGHT_RGB = "255,248,230";
const TEX_SCALE = 4;

const _shipTexCache = new Map<string, Texture>();
const _shipLightCache = new Map<string, Texture[]>();
let _dotTex: Texture | null = null;

function canvasToTexture(c: HTMLCanvasElement, dpr: number): Texture {
  const mipmapping = Client.settings?.mipmapping ?? true;
  return new Texture({ source: new ImageSource({ resource: c, resolution: TEX_SCALE * dpr, scaleMode: 'linear', autoGenerateMipmaps: mipmapping }) });
}

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

export function bakeShipTexture(shipId: string): Texture {
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

export function getShipTexture(shipId: string): Texture {
  let t = _shipTexCache.get(shipId);
  if (!t) { t = bakeShipTexture(shipId); _shipTexCache.set(shipId, t); }
  return t;
}

export function bakeShipLightTextures(shipId: string): Texture[] {
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

export function getShipLightTextures(shipId: string): Texture[] {
  let t = _shipLightCache.get(shipId);
  if (!t) { t = bakeShipLightTextures(shipId); _shipLightCache.set(shipId, t); }
  return t;
}

export function bakeDotTexture(): Texture {
  const DOT_TEX = 32;
  const DOT_HALF = DOT_TEX / 2;
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

export function getDotTexture(): Texture {
  if (!_dotTex) _dotTex = bakeDotTexture();
  return _dotTex;
}

export function clearShipTextureCaches(): void {
  for (const t of _shipTexCache.values()) t.destroy();
  _shipTexCache.clear();
  for (const arr of _shipLightCache.values()) {
    for (const t of arr) t.destroy();
  }
  _shipLightCache.clear();
  if (_dotTex) { _dotTex.destroy(); _dotTex = null; }
}
