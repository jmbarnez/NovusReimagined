/**
 * Station interior scene.
 *
 * Migrated from Canvas 2D to PixiJS (`render/station-interior.ts`).
 * Renders a hangar/docking bay: floor perspective, side walls, viewport,
 * docking platform, ship silhouette, animated hologram rings, dust, sparks.
 *
 * The scene is only drawn when Client.stationOpen is true; the layer is
 * attached to `screenContainer` so it sits in front of the playable world.
 */
import { Container, Graphics } from "pixi.js";
import { screenContainer } from "../pixi.js";
import { getState } from "../state-access.js";
import { TAU } from "../constants.js";
import { SHIPS } from "../data/ships.js";
import { viewportW, viewportH } from "./viewport.js";

interface InteriorDust {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  alpha: number;
}

interface InteriorSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: number;
}

const _dust: InteriorDust[] = (() => {
  const arr: InteriorDust[] = [];
  for (let i = 0; i < 40; i++) {
    arr.push({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.02,
      vy: (Math.random() - 0.5) * 0.015,
      r: 0.5 + Math.random() * 1.5,
      alpha: 0.1 + Math.random() * 0.3,
    });
  }
  return arr;
})();

let _sparks: InteriorSpark[] = [];
let _nextSpark = 0;

let stationLayer: Container | null = null;
let staticGfx: Graphics | null = null;
let ringGfx: Graphics | null = null;
let viewportGfx: Graphics | null = null;
let dustGfx: Graphics | null = null;
let sparkGfx: Graphics | null = null;
let shipGfx: Graphics | null = null;

let _staticWc = 0;
let _staticHc = 0;

function ensureLayer(): Container | null {
  if (stationLayer && stationLayer.parent) return stationLayer;
  if (!screenContainer) return null;
  stationLayer = new Container();
  stationLayer.label = "station-interior";
  stationLayer.eventMode = "none";
  screenContainer.addChild(stationLayer);

  staticGfx = new Graphics();
  ringGfx = new Graphics();
  viewportGfx = new Graphics();
  shipGfx = new Graphics();
  dustGfx = new Graphics();
  sparkGfx = new Graphics();
  stationLayer.addChild(staticGfx, ringGfx, viewportGfx, shipGfx, dustGfx, sparkGfx);
  return stationLayer;
}

function drawStatic(Wc: number, Hc: number): void {
  if (!staticGfx) return;
  staticGfx.clear();
  const cx = Wc / 2;
  const cy = Hc / 2;
  const floorY = cy + 80;

  // Background
  staticGfx.rect(0, 0, Wc, Hc).fill({ color: 0x030508 });
  // Soft central glow
  staticGfx.circle(cx, cy - 40, Math.max(Wc, Hc) * 0.6).fill({ color: 0x0a1928, alpha: 0.25 });

  // Side walls
  staticGfx.rect(0, 0, Wc * 0.35, Hc).fill({ color: 0x04080c, alpha: 0.95 });
  staticGfx.rect(Wc * 0.65, 0, Wc * 0.35, Hc).fill({ color: 0x04080c, alpha: 0.95 });
  // Vertical wall fade (approximation)
  staticGfx.rect(Wc * 0.25, 0, Wc * 0.10, Hc).fill({ color: 0x04080c, alpha: 0.5 });
  staticGfx.rect(Wc * 0.65, 0, Wc * 0.10, Hc).fill({ color: 0x04080c, alpha: 0.5 });

  // Wall stripes
  staticGfx.stroke({ color: 0x142837, width: 1, alpha: 0.35 });
  for (let y = 40; y < Hc; y += 60) {
    staticGfx.moveTo(0, y).lineTo(Wc * 0.18, y);
    staticGfx.moveTo(Wc, y).lineTo(Wc * 0.82, y);
  }
  staticGfx.stroke();

  // Floor perspective grid
  staticGfx.stroke({ color: 0x142d41, width: 1, alpha: 0.35 });
  const vanishY = Hc + 120;
  for (let i = -8; i <= 8; i++) {
    const ang = i * 0.09;
    staticGfx.moveTo(cx + Math.sin(ang) * 40, floorY + Math.cos(ang) * 20);
    staticGfx.lineTo(cx + Math.sin(ang) * (Wc * 0.8), vanishY);
  }
  // Floor arcs
  for (let d = 0; d < 8; d++) {
    const y = floorY + d * 55 + (d * d) * 3;
    if (y > Hc) break;
    const w = 120 + d * 160;
    const arcAlpha = 0.25 - d * 0.025;
    staticGfx.moveTo(cx + w, y);
    staticGfx.ellipse(cx, y, w, 12);
  }
  staticGfx.stroke({ color: 0x142d41, width: 1, alpha: 0.35 });

  // Overhead light strips
  const stripW = 180;
  for (const sx of [cx - stripW - 40, cx + 40]) {
    staticGfx.rect(sx, 0, stripW, Hc * 0.55).fill({ color: 0x3ca0c8, alpha: 0.06 });
    staticGfx.rect(sx + stripW * 0.3, 0, stripW * 0.4, Hc * 0.55).fill({ color: 0x6fd3ff, alpha: 0.04 });
  }
}

function drawViewport(Wc: number, Hc: number, now: number): void {
  if (!viewportGfx) return;
  viewportGfx.clear();
  const cx = Wc / 2;
  const cy = Hc / 2;
  const vpR = 55;
  const vpX = cx;
  const vpY = 75;
  // Clip to circle by drawing circle as mask via fill with inner clear — approximation.
  viewportGfx.circle(vpX, vpY, vpR).fill({ color: 0x02040a });
  // Drifting stars inside the viewport
  viewportGfx.fill({ color: 0x88aacc });
  for (let s = 0; s < 18; s++) {
    const sx = vpX + Math.sin(s * 1.3 + now * 0.0002 * (s % 3 + 1)) * (vpR - 4);
    const sy = vpY + Math.cos(s * 2.1 + now * 0.00015 * (s % 4 + 1)) * (vpR - 4);
    viewportGfx.circle(sx, sy, 0.8 + (s % 3) * 0.4);
  }
  viewportGfx.fill();
  // Viewport rim
  viewportGfx.circle(vpX, vpY, vpR).stroke({ color: 0x285a78, width: 3, alpha: 0.5 });
  viewportGfx.circle(vpX, vpY, vpR + 3).stroke({ color: 0x3c8cb4, width: 1, alpha: 0.25 });
}

function drawPlatform(Wc: number, Hc: number): void {
  if (!staticGfx) return;
  const cx = Wc / 2;
  const cy = Hc / 2;
  const floorY = cy + 80;

  // Docking platform glow + rings
  staticGfx.circle(cx, floorY + 30, 140).fill({ color: 0x143246, alpha: 0.35 });
  staticGfx.circle(cx, floorY + 30, 60).fill({ color: 0x0f283c, alpha: 0.15 });
  staticGfx.ellipse(cx, floorY + 30, 120, 24).stroke({ color: 0x28648c, width: 1.5, alpha: 0.45 });
  staticGfx.ellipse(cx, floorY + 30, 140, 28).stroke({ color: 0x1e5078, width: 1, alpha: 0.3 });
}

function drawShip(Wc: number, Hc: number): void {
  if (!shipGfx) return;
  shipGfx.clear();
  const cx = Wc / 2;
  const cy = Hc / 2;
  const floorY = cy + 80;
  const def = SHIPS[getState().player?.shipId || "starter"];
  if (!def) return;
  const path = def.render.path;
  if (path.length < 3) return;

  // Apply ship-local transform: scale 3x, rotate -0.25, translate to (cx, floorY + 10).
  // Pixi's arc/lineTo operate in the Graphics local space, so we transform
  // each path vertex into screen space, then draw the polygon.
  const cos = Math.cos(-0.25) * 3;
  const sin = Math.sin(-0.25) * 3;
  const tx = cx;
  const ty = floorY + 10;
  const screen: number[] = [];
  for (let i = 0; i < path.length; i++) {
    const [px, py] = path[i];
    screen.push(px * cos - py * sin + tx, px * sin + py * cos + ty);
  }

  // Outline + fill
  shipGfx.poly(screen);
  shipGfx.fill({ color: 0x102a48 });
  shipGfx.stroke({ color: 0x2a8ec8, width: 1.5 });
  // Black underlay
  shipGfx.poly(screen);
  shipGfx.stroke({ color: 0x000000, width: 3.5, alpha: 0.9 });
}

function drawHoloRings(Wc: number, Hc: number, now: number): void {
  if (!ringGfx) return;
  ringGfx.clear();
  const cx = Wc / 2;
  const cy = Hc / 2;
  const floorY = cy + 80;
  const ringPulse = 0.75 + 0.25 * Math.sin(now * 0.0015);
  ringGfx.ellipse(cx, floorY + 10, 90 + Math.sin(now * 0.001) * 6, 22 + Math.sin(now * 0.001) * 2)
    .stroke({ color: 0x50c8ff, width: 1, alpha: 0.35 * ringPulse });
  ringGfx.ellipse(cx, floorY + 10, 110 + Math.cos(now * 0.0013) * 8, 28 + Math.cos(now * 0.0013) * 3)
    .stroke({ color: 0x3caadc, width: 0.8, alpha: 0.25 * ringPulse });
}

function drawLamps(Wc: number, Hc: number, now: number): void {
  if (!staticGfx) return;
  const lampPulse = 0.6 + 0.4 * Math.sin(now * 0.0018);
  for (const lx of [Wc * 0.12, Wc * 0.88]) {
    staticGfx.circle(lx, Hc * 0.22, 60).fill({ color: 0x2882b4, alpha: 0.18 * lampPulse });
  }
}

function drawDust(Wc: number, Hc: number): void {
  if (!dustGfx) return;
  dustGfx.clear();
  for (const d of _dust) {
    d.x += d.vx;
    d.y += d.vy;
    if (d.x < 0) d.x += 1;
    if (d.x > 1) d.x -= 1;
    if (d.y < 0) d.y += 1;
    if (d.y > 1) d.y -= 1;
    dustGfx.circle(d.x * Wc, d.y * Hc, d.r);
  }
  dustGfx.fill({ color: 0x88bbcc, alpha: 0.2 });
}

function drawSparks(Wc: number, Hc: number, now: number): void {
  if (!sparkGfx) return;
  if (now > _nextSpark) {
    _nextSpark = now + 800 + Math.random() * 2200;
    const sx = Wc * 0.15 + Math.random() * Wc * 0.7;
    const sy = Hc * 0.25 + Math.random() * Hc * 0.4;
    for (let i = 0; i < 5; i++) {
      _sparks.push({
        x: sx, y: sy,
        vx: (Math.random() - 0.5) * 40,
        vy: (Math.random() - 1.0) * 40,
        life: 0.3 + Math.random() * 0.4,
        color: Math.random() > 0.5 ? 0xffaa44 : 0xffdd88,
      });
    }
  }

  sparkGfx.clear();
  const dt = 1 / 60;
  let writeIdx = 0;
  for (let i = 0; i < _sparks.length; i++) {
    const s = _sparks[i];
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vy += 30 * dt;
    s.life -= dt;
    if (s.life > 0) {
      _sparks[writeIdx++] = s;
      sparkGfx.rect(s.x - 1, s.y - 1, 2, 2).fill({ color: s.color, alpha: Math.min(1, s.life * 3) });
    }
  }
  _sparks.length = writeIdx;
}

export function syncPixiStationInterior(now: number): void {
  const layer = ensureLayer();
  if (!layer) return;
  const Wc = viewportW();
  const Hc = viewportH();
  if (Wc <= 0 || Hc <= 0) {
    layer.visible = false;
    return;
  }
  layer.visible = true;
  if (Wc !== _staticWc || Hc !== _staticHc) {
    _staticWc = Wc;
    _staticHc = Hc;
    drawStatic(Wc, Hc);
    drawPlatform(Wc, Hc);
  }
  drawLamps(Wc, Hc, now);
  drawViewport(Wc, Hc, now);
  drawShip(Wc, Hc);
  drawHoloRings(Wc, Hc, now);
  drawDust(Wc, Hc);
  drawSparks(Wc, Hc, now);
}

export function destroyPixiStationInterior(): void {
  stationLayer?.destroy({ children: true });
  stationLayer = null;
  staticGfx = null;
  ringGfx = null;
  viewportGfx = null;
  shipGfx = null;
  dustGfx = null;
  sparkGfx = null;
  _staticWc = 0;
  _staticHc = 0;
  _sparks = [];
}
