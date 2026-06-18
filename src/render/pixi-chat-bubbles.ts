/**
 * Chat bubble and typing indicator overlays above player ships.
 * Pools Text objects to avoid per-frame GC allocations.
 */
import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { app, screenContainer, worldContainer, effectLayer } from "../pixi.js";
import { getState } from "../state-access.js";
import { Client } from "../state.js";
import { isVisible } from "../utils/game.js";
import { getUIFont } from "./ui-font.js";
import { viewCenterX, viewCenterY, viewportW, viewportH } from "./viewport.js";
import { FLOAT_LAYER_Z, STAGE_LAYER_Z } from "./pixi-z-order.js";

const BUBBLE_OFFSET_Y = -40;
const TYPING_OFFSET_Y = -55;
const BUBBLE_DURATION_MS = 5000;
const TYPING_PULSE_MS = 800;

let bubbleLayer: Container | null = null;
let bubbleCardGfx: Graphics | null = null;
const bubbleTexts = new Map<string, Text>();
const typingTexts = new Map<string, Text>();
const _bubbleKeepSet = new Set<string>();
const _typingKeepSet = new Set<string>();

const _bubblePool: Text[] = [];
const _typingPool: Text[] = [];
const POOL_SIZE = 32;

const _bubbleStyle = new TextStyle({
  fontFamily: getUIFont(),
  fontSize: 10,
  fontWeight: "bold",
  fill: "#88c8ff",
  align: "center",
  wordWrap: true,
  wordWrapWidth: 240,
  stroke: { color: "#000000", width: 2 },
});

const _typingStyle = new TextStyle({
  fontFamily: getUIFont(),
  fontSize: 11,
  fontWeight: "bold",
  fill: "#aabbcc",
  align: "center",
  stroke: { color: "#000000", width: 2 },
});

export function refreshChatBubbleFonts(): void {
  const font = getUIFont();
  const scale = Client.settings?.fontScale ?? 1.2;
  _bubbleStyle.fontFamily = font;
  _bubbleStyle.fontSize = 10 * scale;
  _typingStyle.fontFamily = font;
  _typingStyle.fontSize = 11 * scale;
}

function ensureBubbleLayer(): Container | null {
  const root = effectLayer ?? worldContainer ?? screenContainer;
  if (!root) return null;
  if (!bubbleLayer) {
    bubbleLayer = new Container();
    bubbleLayer.label = "chat-bubbles";
    bubbleLayer.sortableChildren = true;
    bubbleLayer.zIndex = STAGE_LAYER_Z.FLOAT_TEXT + 1;
    root.addChild(bubbleLayer);
  } else if (!bubbleLayer.parent) {
    root.addChild(bubbleLayer);
  } else if (bubbleLayer.parent !== root) {
    bubbleLayer.removeFromParent();
    root.addChild(bubbleLayer);
  }
  return bubbleLayer;
}

function ensureBubbleCards(): Graphics | null {
  const layer = ensureBubbleLayer();
  if (!layer) return null;
  if (!bubbleCardGfx) {
    bubbleCardGfx = new Graphics();
    bubbleCardGfx.label = "chat-bubble-cards";
    bubbleCardGfx.zIndex = FLOAT_LAYER_Z.CARDS;
    layer.addChild(bubbleCardGfx);
  }
  return bubbleCardGfx;
}

function getPooledBubble(): Text {
  if (_bubblePool.length > 0) {
    const t = _bubblePool.pop()!;
    t.visible = true;
    return t;
  }
  const t = new Text({ text: "", style: _bubbleStyle });
  t.anchor.set(0.5, 0.5);
  return t;
}

function returnPooledBubble(t: Text): void {
  t.visible = false;
  t.text = "";
  if (_bubblePool.length < POOL_SIZE) {
    _bubblePool.push(t);
  } else {
    t.destroy();
  }
}

function getPooledTyping(): Text {
  if (_typingPool.length > 0) {
    const t = _typingPool.pop()!;
    t.visible = true;
    return t;
  }
  const t = new Text({ text: "", style: _typingStyle });
  t.anchor.set(0.5, 0.5);
  return t;
}

function returnPooledTyping(t: Text): void {
  t.visible = false;
  t.text = "";
  if (_typingPool.length < POOL_SIZE) {
    _typingPool.push(t);
  } else {
    t.destroy();
  }
}

function worldToScreen(x: number, y: number): { sx: number; sy: number } {
  const width = viewportW();
  const height = viewportH();
  const viewCX = viewCenterX(width);
  const viewCY = viewCenterY(height);
  return {
    sx: viewCX + (x - Client.camx) * Client.zoom,
    sy: viewCY + (y - Client.camy) * Client.zoom,
  };
}

/** Draw a dark rounded card behind a text label. */
function drawCard(g: Graphics, sx: number, sy: number, w: number, h: number, alpha: number): void {
  const pad = 4;
  const r = 3.5;
  g.roundRect(Math.round(sx - w / 2 - pad), Math.round(sy - h / 2 - pad), w + pad * 2, h + pad * 2, r)
    .fill({ color: 0x000000, alpha: alpha * 0.6 })
    .stroke({ color: 0x3c78c8, width: 1, alpha: alpha * 0.5 });
}

export function syncPixiChatBubbles(now: number): void {
  const layer = ensureBubbleLayer();
  const cards = ensureBubbleCards();
  if (!layer || !cards) return;

  const state = getState();
  const selfNetId = state.player?.netId ?? "local";

  cards.clear();
  _bubbleKeepSet.clear();
  _typingKeepSet.clear();

  // ─── Chat bubbles ───
  // Iterate over a copy since we may delete expired entries
  const bubbleEntries = Array.from(Client.chatBubbles.entries());
  for (const [netId, bubble] of bubbleEntries) {
    if (now > bubble.expiresAt) {
      Client.chatBubbles.delete(netId);
      continue;
    }

    const player = netId === selfNetId ? state.player : state.players.get(netId);
    if (!player || !isVisible(player.x, player.y, 20)) continue;

    const { sx, sy } = worldToScreen(player.x, player.y + BUBBLE_OFFSET_Y);
    _bubbleKeepSet.add(netId);

    let t = bubbleTexts.get(netId);
    if (!t) {
      t = getPooledBubble();
      t.zIndex = FLOAT_LAYER_Z.TEXT;
      layer.addChild(t);
      bubbleTexts.set(netId, t);
    } else if (t.parent !== layer) {
      t.parent?.removeChild(t);
      layer.addChild(t);
    }

    t.text = bubble.text;
    t.position.set(Math.round(sx), Math.round(sy));
    t.alpha = Math.min(1, (bubble.expiresAt - now) / 1000);
    t.visible = true;

    drawCard(cards, sx, sy, t.width, t.height, t.alpha);
  }

  for (const [k, t] of bubbleTexts) {
    if (!_bubbleKeepSet.has(k)) {
      t.parent?.removeChild(t);
      returnPooledBubble(t);
      bubbleTexts.delete(k);
    }
  }

  // ─── Typing indicators ───
  for (const netId of Client.typingPlayers) {
    if (netId === selfNetId) continue;

    const player = state.players.get(netId);
    if (!player || !isVisible(player.x, player.y, 20)) continue;

    const { sx, sy } = worldToScreen(player.x, player.y + TYPING_OFFSET_Y);
    _typingKeepSet.add(netId);

    let t = typingTexts.get(netId);
    if (!t) {
      t = getPooledTyping();
      t.zIndex = FLOAT_LAYER_Z.TEXT + 1;
      layer.addChild(t);
      typingTexts.set(netId, t);
    } else if (t.parent !== layer) {
      t.parent?.removeChild(t);
      layer.addChild(t);
    }

    // Pulsing "..." animation
    const dots = Math.floor((now % TYPING_PULSE_MS) / (TYPING_PULSE_MS / 3)) + 1;
    t.text = ".".repeat(dots);
    t.position.set(Math.round(sx), Math.round(sy));
    t.alpha = 0.7 + 0.3 * Math.sin(now * 0.005);
    t.visible = true;
  }

  for (const [k, t] of typingTexts) {
    if (!_typingKeepSet.has(k)) {
      t.parent?.removeChild(t);
      returnPooledTyping(t);
      typingTexts.delete(k);
    }
  }
}

export function destroyPixiChatBubbles(): void {
  for (const t of bubbleTexts.values()) {
    t.parent?.removeChild(t);
    t.destroy();
  }
  bubbleTexts.clear();
  for (const t of typingTexts.values()) {
    t.parent?.removeChild(t);
    t.destroy();
  }
  typingTexts.clear();
  _bubblePool.length = 0;
  _typingPool.length = 0;
  bubbleCardGfx?.destroy();
  bubbleCardGfx = null;
  bubbleLayer?.destroy({ children: false });
  bubbleLayer = null;
}
