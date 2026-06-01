import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { app, effectLayer, screenContainer, worldContainer } from "../pixi.js";
import { getState } from "../state-access.js";
import { Client } from "../state.js";
import { isVisible } from "../utils/game.js";
import { getUIFont } from "./ui-font.js";
import { SECTOR_OUTER_RADIUS } from "../world-gen.js";
import { W, H } from "../canvas.js";
import { viewCenterX, viewCenterY } from "./viewport.js";

let overlayLayer: Container | null = null;
let shockwaveGfx: Graphics | null = null;
let borderGfx: Graphics | null = null;
let floatCardGfx: Graphics | null = null;
let floatLayer: Container | null = null;
const floatTextLabels = new Map<number, Text>();

// Reusable Set to avoid per-frame GC allocation
const _floatTextKeepSet = new Set<number>();

// Object pool for float text Text objects to avoid GC pressure
const _floatTextPool: Text[] = [];
const _floatTextPoolSize = 128;

function getPooledFloatText(): Text {
  if (_floatTextPool.length > 0) {
    const t = _floatTextPool.pop()!;
    t.visible = true;
    return t;
  }
  const t = new Text({
    text: "",
    style: new TextStyle({
      fontFamily: getUIFont(),
      fontSize: 12,
      fontWeight: "bold",
      fill: "#ffffff",
      stroke: { color: "#000000", width: 3 },
    }),
  });
  t.anchor.set(0.5, 0.5);
  return t;
}

function returnPooledFloatText(t: Text): void {
  t.visible = false;
  t.text = "";
  if (_floatTextPool.length < _floatTextPoolSize) {
    _floatTextPool.push(t);
  } else {
    t.destroy();
  }
}

function hexStringToNumber(hex: string): number {
  const clean = hex.replace("#", "");
  return parseInt(clean, 16) || 0xffffff;
}

function ensureLayer(): Container | null {
  const root = effectLayer ?? worldContainer;
  if (!root) return null;
  if (!overlayLayer) {
    overlayLayer = new Container();
    overlayLayer.label = "effects-overlay";
    root.addChild(overlayLayer);
  } else if (!overlayLayer.parent) {
    root.addChild(overlayLayer);
  }
  return overlayLayer;
}

function ensureShockwaves(): Graphics | null {
  const layer = ensureLayer();
  if (!layer) return null;
  if (!shockwaveGfx) {
    shockwaveGfx = new Graphics();
    shockwaveGfx.label = "shockwaves";
    layer.addChild(shockwaveGfx);
  }
  return shockwaveGfx;
}

function ensureBorder(): Graphics | null {
  const layer = ensureLayer();
  if (!layer) return null;
  if (!borderGfx) {
    borderGfx = new Graphics();
    borderGfx.label = "world-border";
    layer.addChild(borderGfx);
  }
  return borderGfx;
}

function ensureFloatCards(): Graphics | null {
  const layer = ensureFloatLayer();
  if (!layer) return null;
  if (!floatCardGfx) {
    floatCardGfx = new Graphics();
    floatCardGfx.label = "float-text-cards";
    layer.addChild(floatCardGfx);
  }
  return floatCardGfx;
}

function ensureFloatLayer(): Container | null {
  const root = app?.stage ?? screenContainer ?? effectLayer ?? worldContainer;
  if (!root) return null;
  if (!floatLayer) {
    floatLayer = new Container();
    floatLayer.label = "float-text-overlay";
    root.addChild(floatLayer);
  } else if (!floatLayer.parent) {
    root.addChild(floatLayer);
  }
  return floatLayer;
}

export function syncPixiShockwaves(): void {
  const g = ensureShockwaves();
  if (!g) return;
  const state = getState();
  if (!state.shockwaves?.length) { g.clear(); return; }
  g.clear();
  for (const s of state.shockwaves) {
    if (!isVisible(s.x, s.y, s.maxRadius)) continue;
    const a = s.life / Math.max(0.001, s.maxLife);
    g.circle(s.x, s.y, s.radius || 0)
      .stroke({ color: hexStringToNumber(s.color), width: s.width * a, alpha: a * 0.55 });
  }
}

export function syncPixiFloatTexts(): void {
  const layer = ensureFloatLayer();
  const cards = ensureFloatCards();
  if (!layer || !cards) return;
  const state = getState();
  const width = W();
  const height = H();
  const viewCX = viewCenterX(width);
  const viewCY = viewCenterY(height);
  _floatTextKeepSet.clear();
  cards.clear();
  for (const f of state.floatTexts) {
    if (!isVisible(f.x, f.y, 20)) continue;
    const alpha = f.life ?? 1;
    const sx = viewCX + (f.x - Client.camx) * Client.zoom;
    const sy = viewCY + (f.y - Client.camy) * Client.zoom;
    _floatTextKeepSet.add(f.id);
    let t = floatTextLabels.get(f.id);
    if (!t) {
      t = getPooledFloatText();
      layer.addChild(t);
      floatTextLabels.set(f.id, t);
    } else if (t.parent !== layer) {
      t.parent?.removeChild(t);
      layer.addChild(t);
    }
    t.text = f.text;
    t.style.fill = f.bgColor ? "#000000" : (f.color ?? "#ffffff");
    t.style.stroke = f.bgColor
      ? { color: "#000000", width: 0 }
      : { color: "#000000", width: 3.5 };
    t.position.set(Math.round(sx), Math.round(sy));
    t.alpha = alpha;
    t.visible = true;

    if (f.bgColor) {
      const padX = 6;
      const padY = 3.5;
      const cardW = t.width + padX * 2;
      const cardH = t.height + padY * 2;
      cards.roundRect(Math.round(sx - cardW / 2), Math.round(sy - cardH / 2), cardW, cardH, 3.5)
        .fill({ color: hexStringToNumber(f.bgColor), alpha: alpha * 0.9 })
        .stroke({ color: 0x000000, width: 1.0, alpha: alpha * 0.7 });
    }
  }
  for (const [k, t] of floatTextLabels) {
    if (!_floatTextKeepSet.has(k)) {
      t.parent?.removeChild(t);
      returnPooledFloatText(t);
      floatTextLabels.delete(k);
    }
  }
}

export function syncPixiWorldBorder(now: number, sectorOuterRadius: number = SECTOR_OUTER_RADIUS): void {
  const g = ensureBorder();
  if (!g) return;
  const state = getState();
  const player = state.player;
  const pr = Math.hypot(player.x, player.y);
  const distToEdge = sectorOuterRadius - pr;
  const fadeStart = 1800;
  const fadeEnd = 600;
  if (distToEdge > fadeStart) { g.clear(); return; }

  const t = Math.min(1, (fadeStart - distToEdge) / (fadeStart - fadeEnd));
  const alpha = t * 0.18;
  const pulse = 0.92 + 0.08 * Math.sin(now * 0.0018);

  g.clear();
  g.circle(0, 0, sectorOuterRadius)
    .stroke({ color: 0x2a4560, width: 2.5, alpha: alpha * pulse });
  g.circle(0, 0, sectorOuterRadius - 120)
    .stroke({ color: 0x1a3048, width: 1, alpha: alpha * 0.35 * pulse });
}

export function destroyPixiEffectsOverlay(): void {
  shockwaveGfx?.destroy();
  borderGfx?.destroy();
  floatCardGfx?.destroy();
  for (const t of floatTextLabels.values()) {
    t.parent?.removeChild(t);
    t.destroy();
  }
  shockwaveGfx = null;
  borderGfx = null;
  floatCardGfx = null;
  floatTextLabels.clear();
  floatLayer?.destroy({ children: false });
  floatLayer = null;
  overlayLayer?.destroy({ children: false });
  overlayLayer = null;
}
