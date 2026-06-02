import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { Client } from "../state.js";
import { effectLayer, worldContainer } from "../pixi.js";
import { getState } from "../state-access.js";
import type { System, Station, Gate } from "../types/world.js";
import { dst } from "../utils/math.js";
import { isVisible } from "../utils/game.js";
import { getDropZoneCenter } from "../hub.js";
import { getUIFont } from "./ui-font.js";
import { shouldShowWarpGate } from "../data/tutorial.js";
import { GATE_RANGE } from "../constants.js";

const TAU = Math.PI * 2;

let overlayLayer: Container | null = null;
const stationGfx = new Map<string, Graphics>();
const stationLabels = new Map<string, Text>();
const gateGfx = new Map<string, Graphics>();
const gateLabels = new Map<string, Text>();

function ensureLayer(): Container | null {
  const root = effectLayer ?? worldContainer;
  if (!root) return null;
  if (!overlayLayer) {
    overlayLayer = new Container();
    overlayLayer.label = "station-overlays";
    root.addChild(overlayLayer);
  } else if (!overlayLayer.parent) {
    root.addChild(overlayLayer);
  }
  return overlayLayer;
}

function colorToNumber(color: string): number {
  const clean = color.startsWith("#") ? color.slice(1) : color;
  const parsed = Number.parseInt(clean, 16);
  return Number.isNaN(parsed) ? 0xffffff : parsed;
}

function dashedCircle(
  g: Graphics,
  cx: number,
  cy: number,
  radius: number,
  segments: number,
  dashRatio: number,
  color: number,
  alpha: number,
  width: number,
) {
  for (let i = 0; i < segments; i++) {
    if (i % 2 !== 0) continue;
    const a0 = (i / segments) * TAU;
    const a1 = ((i + dashRatio) / segments) * TAU;
    g.moveTo(cx + Math.cos(a0) * radius, cy + Math.sin(a0) * radius);
    g.arc(cx, cy, radius, a0, a1);
    g.stroke({ color, width, alpha });
  }
}

function ensureText(id: string, text: string, x: number, y: number, fill: string): Text {
  let t = stationLabels.get(id);
  if (!t) {
    t = new Text({
      text,
      style: new TextStyle({
        fontFamily: getUIFont(),
        fontSize: 10,
        fontWeight: "bold",
        fill,
        stroke: { color: "#000000", width: 2.5 },
      }),
    });
    t.roundPixels = true;
    overlayLayer?.addChild(t);
    stationLabels.set(id, t);
  }
  t.text = text;
  t.style.fill = fill;
  t.position.set(Math.round(x), Math.round(y));
  t.alpha = 1;
  return t;
}

function ensureGateText(id: string, text: string, x: number, y: number, fill: string): Text {
  let t = gateLabels.get(id);
  if (!t) {
    t = new Text({
      text,
      style: new TextStyle({
        fontFamily: getUIFont(),
        fontSize: 11,
        fontWeight: "bold",
        fill,
        stroke: { color: "#000000", width: 3 },
      }),
    });
    t.roundPixels = true;
    overlayLayer?.addChild(t);
    gateLabels.set(id, t);
  }
  t.text = text;
  t.style.fill = fill;
  t.position.set(Math.round(x), Math.round(y));
  t.alpha = 1;
  return t;
}

export function refreshStationOverlayFonts(): void {
  const font = getUIFont();
  const scale = Client.settings?.fontScale ?? 1.0;
  for (const t of stationLabels.values()) {
    t.style.fontFamily = font;
    t.style.fontSize = 10 * scale;
  }
  for (const t of gateLabels.values()) {
    t.style.fontFamily = font;
    t.style.fontSize = 11 * scale;
  }
}

function drawStationOverlay(g: Graphics, st: Station, sysSecurity: number, now: number) {
  g.clear();
  const player = getState().player;
  const dockR = st.radius * 2;
  const interactR = st.isProcessingHub ? ((st.collectRadius ?? 220) + 80) : dockR;
  const inRange = dst(player.x, player.y, st.x, st.y) < interactR;
  const locked = Boolean((getState() as unknown as { _liveEnemies?: Array<{ hasLockOnPlayer?: boolean }> })._liveEnemies?.some(e => e?.hasLockOnPlayer));

  // Safe zone
  const safeR = st.safeRadius ?? (st.isHome ? 900 : 675);
  const pd = dst(player.x, player.y, st.x, st.y);
  if (pd < safeR * 2) {
    const t = Math.max(0, 1 - pd / (safeR * 2));
    const zoneAlpha = t * 0.18;
    const spulse = 0.90 + 0.10 * Math.sin(now * 0.0018);
    const colStr = st.isHome ? "#00d2ff" : sysSecurity >= 0.6 ? "#00d2ff" : sysSecurity >= 0.3 ? "#c8c8ff" : "#ff503c";
    const col = colorToNumber(colStr);
    dashedCircle(g, st.x, st.y, safeR, 64, 0.55, col, zoneAlpha * spulse, 1.8);
    g.circle(st.x, st.y, safeR - 10).stroke({ color: col, width: 0.8, alpha: zoneAlpha * 0.35 });
  }

  if (st.isProcessingHub) {
    const dropZone = getDropZoneCenter(st);
    const inDropZone = dst(player.x, player.y, dropZone.x, dropZone.y) < dropZone.radius + 60;
    const collectR = st.collectRadius ?? 220;

    // Collection ring
    g.circle(st.x, st.y, collectR).stroke({
      color: colorToNumber(inDropZone ? "#ffa028" : "#c86414"),
      width: inDropZone ? 1.5 : 1,
      alpha: inDropZone ? 0.55 : 0.18,
    });

    // Pylons and cradle
    const dx = dropZone.x - st.x;
    const dy = dropZone.y - st.y;
    const ang = Math.atan2(dy, dx);
    const x1 = st.x + st.radius * Math.cos(ang - 0.6);
    const y1 = st.y + st.radius * Math.sin(ang - 0.6);
    const x2 = dropZone.x + dropZone.radius * Math.cos(ang + Math.PI - 0.5);
    const y2 = dropZone.y + dropZone.radius * Math.sin(ang + Math.PI - 0.5);
    const x3 = st.x + st.radius * Math.cos(ang + 0.6);
    const y3 = st.y + st.radius * Math.sin(ang + 0.6);
    const x4 = dropZone.x + dropZone.radius * Math.cos(ang + Math.PI + 0.5);
    const y4 = dropZone.y + dropZone.radius * Math.sin(ang + Math.PI + 0.5);

    g.poly([x1, y1, x2, y2, dropZone.x + Math.cos(ang + Math.PI - 0.5) * dropZone.radius, dropZone.y + Math.sin(ang + Math.PI - 0.5) * dropZone.radius, x4, y4, x3, y3], true)
      .fill({ color: 0x11161d, alpha: 0.9 })
      .stroke({ color: 0x243242, width: 3.5, alpha: 0.9 });

    g.moveTo(x1, y1).lineTo(x4, y4);
    g.moveTo(x3, y3).lineTo(x2, y2);
    g.stroke({ color: 0x304458, width: 2, alpha: 0.7 });

    g.moveTo(x1, y1).lineTo(x3, y3);
    g.stroke({ color: inDropZone ? 0xffa028 : 0xff8c28, width: 1.5, alpha: inDropZone ? 0.85 : 0.4 });

    g.arc(dropZone.x, dropZone.y, dropZone.radius, ang + Math.PI + 0.5, ang + Math.PI - 0.5)
      .stroke({ color: inDropZone ? 0xffa028 : 0x647887, width: 3.5, alpha: inDropZone ? 0.85 : 0.45 });

    g.arc(dropZone.x, dropZone.y, dropZone.radius - 4, ang + Math.PI + 0.5, ang + Math.PI - 0.5)
      .stroke({ color: inDropZone ? 0xffb43c : 0xff8c28, width: 1.5, alpha: inDropZone ? 0.65 : 0.25, alignment: 0 });

    g.circle(st.x, st.y, (st.collectRadius ?? 220) + 40).stroke({ color: 0xffa028, width: 1, alpha: 0.12 });

  } else {
    const dockReady = inRange && !locked;
    if (dockReady) {
      const dockPulse = 0.5 + 0.15 * Math.sin(now * 0.0035);
      g.circle(st.x, st.y, dockR).stroke({ color: 0x00f0ff, width: 1.6, alpha: 0.45 + dockPulse });
      g.circle(st.x, st.y, dockR - 6).stroke({ color: 0x28ff96, width: 0.8, alpha: 0.25 + dockPulse * 0.5 });
    } else {
      dashedCircle(g, st.x, st.y, dockR, 48, 0.5, 0x00b450, 0.12, 1.0);
      dashedCircle(g, st.x, st.y, dockR - 6, 48, 0.25, 0x00b450, 0.06, 1.0);
    }
  }
}

function drawGateOverlay(g: Graphics, gate: Gate, now: number) {
  g.clear();
  const col = colorToNumber("#64c8ff");
  const pulse = 0.5 + 0.5 * Math.sin(now * 0.0022 + gate.radius);
  g.circle(gate.x, gate.y, gate.radius * 2.2).stroke({ color: col, width: 1.5, alpha: 0.12 * pulse });
  g.circle(gate.x, gate.y, gate.radius * 1.2).stroke({ color: col, width: 2.5, alpha: 0.22 * pulse });
  g.circle(gate.x, gate.y, gate.radius).stroke({ color: col, width: 3.0, alpha: 0.35 + pulse * 0.15 });
  const segments = 16;
  for (let i = 0; i < segments; i++) {
    const a = gate.spin + (i / segments) * TAU;
    const ar = a + (1 / segments) * TAU * 0.72;
    g.arc(gate.x, gate.y, gate.radius, a, ar).stroke({
      color: i % 4 === 0 ? col : colorToNumber("#3c78c8"),
      width: i % 4 === 0 ? 3 : 1.5,
      alpha: i % 4 === 0 ? 0.8 + pulse * 0.2 : 0.45,
    });
  }
}

export function syncPixiStationOverlays(now: number, sys: System): void {
  const layer = ensureLayer();
  if (!layer) return;

  const keepStations = new Set<string>();
  const keepLabels = new Set<string>();

  for (const st of sys.stations ?? []) {
    if (!isVisible(st.x, st.y, Math.max(800, st.radius * 3))) continue;
    keepStations.add(st.id);
    let gfx = stationGfx.get(st.id);
    if (!gfx) {
      gfx = new Graphics();
      gfx.label = `station-overlay-${st.id}`;
      layer.addChild(gfx);
      stationGfx.set(st.id, gfx);
    }
    const locked = Boolean((getState() as unknown as { _liveEnemies?: Array<{ hasLockOnPlayer?: boolean }> })._liveEnemies?.some(e => e?.hasLockOnPlayer));
    drawStationOverlay(gfx, st, sys.security ?? 0.5, now);

    if (dst(getState().player.x, getState().player.y, st.x, st.y) < st.radius * 2.5) {
      const labelText = st.isProcessingHub ? "[F] Processing Hub" : (locked ? "◉ Locked" : "[F] Dock");
      const labelFill = st.isProcessingHub ? "#ffaa44" : (locked ? "#ff5555" : "#88c8ff");
      const t = ensureText(st.id, labelText, st.x + st.radius + 15, st.y, labelFill);
      keepLabels.add(st.id);
      if (!layer.children.includes(t)) layer.addChild(t);
    }
  }

  // Cleanup station graphics/labels not in current system
  for (const [id, gfx] of stationGfx) {
    if (!keepStations.has(id)) {
      gfx.destroy();
      stationGfx.delete(id);
    }
  }
  for (const [id, t] of stationLabels) {
    if (!keepLabels.has(id)) {
      t.destroy();
      stationLabels.delete(id);
    }
  }

  // Gates
  const keepGates = new Set<string>();
  const keepGateLabels = new Set<string>();
  for (const g of sys.gates ?? []) {
    if (!shouldShowWarpGate(g, sys.idx, getState().player)) continue;
    if (!isVisible(g.x, g.y, g.radius * 2.5)) continue;
    const id = (g as unknown as { id?: string }).id ?? `${g.x}|${g.y}|${g.targetSysIdx}`;
    keepGates.add(id);
    let gfx = gateGfx.get(id);
    if (!gfx) {
      gfx = new Graphics();
      gfx.label = `gate-overlay-${id}`;
      layer.addChild(gfx);
      gateGfx.set(id, gfx);
    }
    drawGateOverlay(gfx, g as Gate, now);

    const player = getState().player;
    const inRange = dst(player.x, player.y, g.x, g.y) < g.radius + GATE_RANGE;
    if (inRange) {
      const tgt = getState().GALAXY[g.targetSysIdx];
      const text = `[F] Jump To ${tgt?.name || "Sector"}`;
      const label = ensureGateText(id, text, g.x + g.radius + 15, g.y, "#88c8ff");
      keepGateLabels.add(id);
      if (!layer.children.includes(label)) layer.addChild(label);
    }
  }
  for (const [id, gfx] of gateGfx) {
    if (!keepGates.has(id)) {
      gfx.destroy();
      gateGfx.delete(id);
    }
  }
  for (const [id, t] of gateLabels) {
    if (!keepGateLabels.has(id)) {
      t.destroy();
      gateLabels.delete(id);
    }
  }
}

export function destroyPixiStationOverlays(): void {
  for (const g of stationGfx.values()) g.destroy();
  for (const g of gateGfx.values()) g.destroy();
  for (const t of stationLabels.values()) t.destroy();
  for (const t of gateLabels.values()) t.destroy();
  stationGfx.clear();
  gateGfx.clear();
  stationLabels.clear();
  gateLabels.clear();
  overlayLayer?.destroy({ children: false });
  overlayLayer = null;
}
