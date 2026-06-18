import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { app, effectLayer, screenContainer, worldContainer } from "../pixi.js";
import { getState } from "../state-access.js";
import { Client } from "../state.js";
import { isVisible } from "../utils/game.js";
import { getUIFont } from "./ui-font.js";
import { SECTOR_OUTER_RADIUS } from "../world-gen.js";
import { viewCenterX, viewCenterY, viewportW, viewportH } from "./viewport.js";
import { EFFECT_LAYER_Z, FLOAT_LAYER_Z, STAGE_LAYER_Z } from "./pixi-z-order.js";

let overlayLayer: Container | null = null;
let shockwaveGfx: Graphics | null = null;
let borderGfx: Graphics | null = null;
let floatCardGfx: Graphics | null = null;
let floatLayer: Container | null = null;
const floatTextLabels = new Map<number, Text>();
interface FloatTextCacheEntry {
  text: string;
  fill: string;
  strokeWidth: number;
}
const floatTextCache = new Map<number, FloatTextCacheEntry>();

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
  t.roundPixels = true;
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

export function refreshEffectsOverlayFonts(): void {
  const font = getUIFont();
  const scale = Client.settings?.fontScale ?? 1.2;
  for (const t of _floatTextPool) {
    t.style.fontFamily = font;
    t.style.fontSize = 12 * scale;
  }
  for (const t of floatTextLabels.values()) {
    t.style.fontFamily = font;
    t.style.fontSize = 12 * scale;
  }
}

export function destroyEffectsOverlay(): void {
  for (const text of floatTextLabels.values()) {
    const parent = text.parent;
    if (parent && !parent.destroyed) parent.removeChild(text);
    if (!text.destroyed) text.destroy();
  }
  for (const text of _floatTextPool) {
    const parent = text.parent;
    if (parent && !parent.destroyed) parent.removeChild(text);
    if (!text.destroyed) text.destroy();
  }
  floatTextLabels.clear();
  floatTextCache.clear();
  _floatTextKeepSet.clear();
  _floatTextPool.length = 0;

  if (overlayLayer) {
    const parent = overlayLayer.parent;
    if (parent && !parent.destroyed) parent.removeChild(overlayLayer);
    if (!overlayLayer.destroyed) overlayLayer.destroy({ children: true });
  }
  if (floatLayer) {
    const parent = floatLayer.parent;
    if (parent && !parent.destroyed) parent.removeChild(floatLayer);
    if (!floatLayer.destroyed) floatLayer.destroy({ children: true });
  }
  overlayLayer = null;
  shockwaveGfx = null;
  borderGfx = null;
  floatCardGfx = null;
  floatLayer = null;
}

import { hexStringToNumber } from "./cache.js";

function ensureLayer(): Container | null {
  const root = effectLayer ?? worldContainer;
  if (!root) return null;
  if (!overlayLayer) {
    overlayLayer = new Container();
    overlayLayer.label = "effects-overlay";
    overlayLayer.zIndex = EFFECT_LAYER_Z.OVERLAY;
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
    floatCardGfx.zIndex = FLOAT_LAYER_Z.CARDS;
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
    floatLayer.zIndex = STAGE_LAYER_Z.FLOAT_TEXT;
    floatLayer.sortableChildren = true;
    root.addChild(floatLayer);
  } else if (floatLayer.parent !== root) {
    floatLayer.removeFromParent();
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
  const width = viewportW();
  const height = viewportH();
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
      t.zIndex = FLOAT_LAYER_Z.TEXT;
      layer.addChild(t);
      floatTextLabels.set(f.id, t);
      floatTextCache.set(f.id, { text: "", fill: "", strokeWidth: -1 });
    } else if (t.parent !== layer) {
      t.parent?.removeChild(t);
      layer.addChild(t);
    }
    const fill = f.bgColor ? "#000000" : (f.color ?? "#ffffff");
    const strokeWidth = f.bgColor ? 0 : 3.5;
    const cache = floatTextCache.get(f.id);
    if (!cache || cache.text !== f.text) {
      t.text = f.text;
      if (cache) cache.text = f.text;
    }
    if (!cache || cache.fill !== fill) {
      t.style.fill = fill;
      if (cache) cache.fill = fill;
    }
    if (!cache || cache.strokeWidth !== strokeWidth) {
      t.style.stroke = { color: "#000000", width: strokeWidth };
      if (cache) cache.strokeWidth = strokeWidth;
    }
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
      floatTextCache.delete(k);
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
