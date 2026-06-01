import { lightenCol, darkenCol } from "../../../utils/color.js";
import type { Rack } from "../../../data/modules.js";

export interface IconPaintCtx {
  cx: CanvasRenderingContext2D;
  half: number;
  accent: string;
  secondary?: string;
  isCivilian?: boolean;
  rack?: Rack;
}

export type IconPainter = (ctx: IconPaintCtx) => void;

export const ICON_LOGICAL = 64;
export const ICON_TEX_SCALE = 3;
/** How large the subject art is drawn within the logical icon (1 = edge-to-edge). */
export const ICON_SUBJECT_SCALE = 1.85;

/** Matches station renderer + HUD chrome. */
export const COL = {
  hullDark: "#12151c",
  hullMid: "#222832",
  hullLite: "#384352",
  hullEdge: "#506075",
  steelRim: "rgba(160,190,225,0.65)",
  hudGold: "#ffd84d",
  copperDark: "#4a2106",
  copperMid: "#8e4414",
  copperLite: "#d6732f",
  cyan: "0,210,255",
  cyanHex: "#00d2ff",
  amber: "255,150,30",
  amberHex: "#ffb84a",
  green: "40,245,130",
  hazard: "255,60,40",
  purple: "#8068b0",
};

export const RACK_COLORS = {
  turret: "#b07038",
  high: "#8068b0",
  med: "#3888a8",
  low: "#589858",
} as const;

export const HULL = COL;

export function energyRgb(ctx: IconPaintCtx): string {
  return ctx.isCivilian ? COL.amber : COL.cyan;
}

export function energyHex(ctx: IconPaintCtx): string {
  return ctx.isCivilian ? COL.amberHex : COL.cyanHex;
}

/** Subtle full-bleed tint — outer UI cells already provide the frame border. */
export function drawIconBackdrop(ctx: IconPaintCtx): void {
  const { cx, half } = ctx;
  const g = cx.createRadialGradient(half, half, half * 0.08, half, half, half * 0.92);
  g.addColorStop(0, "rgba(255,255,255,0.05)");
  g.addColorStop(0.55, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.38)");
  cx.fillStyle = g;
  cx.fillRect(0, 0, half * 2, half * 2);
}

export function drawSpecular(ctx: IconPaintCtx, ox = 0, oy = -8, radius = 20): void {
  const { cx, half } = ctx;
  const g = cx.createRadialGradient(half + ox, half + oy, 0, half + ox, half + oy, radius);
  g.addColorStop(0, "rgba(255,255,255,0.24)");
  g.addColorStop(0.5, "rgba(255,255,255,0.07)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  cx.fillStyle = g;
  cx.fillRect(half - radius, half - radius, radius * 2, radius * 2);
}

export function drawEmissiveGlow(
  cx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  rgb: string,
  alpha = 0.55,
): void {
  const g = cx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${alpha})`);
  g.addColorStop(0.45, `rgba(${rgb},${alpha * 0.4})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  cx.fillStyle = g;
  cx.beginPath();
  cx.arc(x, y, r, 0, Math.PI * 2);
  cx.fill();
}

export function fillPolygon(
  cx: CanvasRenderingContext2D,
  pts: [number, number][],
  fill: string | CanvasGradient,
  stroke?: string,
  lineWidth = 1,
): void {
  cx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? cx.moveTo(x, y) : cx.lineTo(x, y)));
  cx.closePath();
  cx.fillStyle = fill;
  cx.fill();
  if (stroke) {
    cx.strokeStyle = stroke;
    cx.lineWidth = lineWidth;
    cx.stroke();
  }
}

export function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgb(${r},${g},${b})`;
}

export function tintGradient(baseHex: string, y0: number, y1: number, cx: CanvasRenderingContext2D, x: number): CanvasGradient {
  const rgb = hexToRgb(baseHex);
  const g = cx.createLinearGradient(x, y0, x, y1);
  g.addColorStop(0, lightenCol(rgb, 24));
  g.addColorStop(0.42, baseHex);
  g.addColorStop(1, darkenCol(rgb, 28));
  return g;
}

export function hullGradient(cx: CanvasRenderingContext2D, x: number, y0: number, y1: number): CanvasGradient {
  const g = cx.createLinearGradient(x, y0, x, y1);
  g.addColorStop(0, COL.hullLite);
  g.addColorStop(0.48, COL.hullMid);
  g.addColorStop(1, COL.hullDark);
  return g;
}

export function copperGradient(cx: CanvasRenderingContext2D, x: number, y0: number, y1: number): CanvasGradient {
  const g = cx.createLinearGradient(x, y0, x, y1);
  g.addColorStop(0, COL.copperLite);
  g.addColorStop(0.5, COL.copperMid);
  g.addColorStop(1, COL.copperDark);
  return g;
}

export function fillRoundRect(
  cx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  if (typeof cx.roundRect === "function") {
    const rr = Math.min(r, w / 2, h / 2);
    cx.beginPath();
    cx.roundRect(x, y, w, h, rr);
    cx.fill();
    return;
  }
  cx.fillRect(x, y, w, h);
}

export function strokeRoundRect(
  cx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  if (typeof cx.roundRect === "function") {
    const rr = Math.min(r, w / 2, h / 2);
    cx.beginPath();
    cx.roundRect(x, y, w, h, rr);
    cx.stroke();
    return;
  }
  cx.strokeRect(x, y, w, h);
}

/** Station-style octagonal turret platform (matches the platform drawn on station turrets in-world). */
export function drawOctPlatform(ctx: IconPaintCtx, cx0: number, cy0: number, platR = 20): void {
  const { cx } = ctx;
  cx.save();
  cx.translate(cx0, cy0);

  const g = cx.createRadialGradient(0, 0, platR * 0.2, 0, 0, platR);
  g.addColorStop(0, COL.hullLite);
  g.addColorStop(0.55, COL.hullMid);
  g.addColorStop(1, COL.hullDark);
  cx.fillStyle = g;
  cx.strokeStyle = COL.hullEdge;
  cx.lineWidth = 1.2;
  cx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const px = Math.cos(a) * platR;
    const py = Math.sin(a) * platR;
    i === 0 ? cx.moveTo(px, py) : cx.lineTo(px, py);
  }
  cx.closePath();
  cx.fill();
  cx.stroke();

  cx.strokeStyle = `rgba(${energyRgb(ctx)},0.55)`;
  cx.lineWidth = 0.8;
  cx.beginPath();
  cx.arc(0, 0, platR * 0.42, 0, Math.PI * 2);
  cx.stroke();

  cx.fillStyle = energyHex(ctx);
  cx.beginPath();
  cx.arc(0, 0, 2.2, 0, Math.PI * 2);
  cx.fill();

  cx.restore();
}

/** Compact module chassis for high/med/low slots. */
export function drawSlotChassis(ctx: IconPaintCtx, w = 34, h = 40): void {
  const { cx, half, accent } = ctx;
  const x = half - w / 2;
  const y = half - h / 2 + 2;
  cx.fillStyle = hullGradient(cx, half, y, y + h);
  fillRoundRect(cx, x, y, w, h, 3);
  cx.strokeStyle = accent;
  cx.lineWidth = 1;
  strokeRoundRect(cx, x + 0.5, y + 0.5, w - 1, h - 1, 3);
  cx.fillStyle = "rgba(255,255,255,0.08)";
  cx.fillRect(x + 2, y + 2, w - 4, 3);
}

/** Dual rail barrels extending from turret platform. */
export function drawRailBarrels(ctx: IconPaintCtx, originX: number, barrelLen = 24): void {
  const { cx, half } = ctx;
  const e = energyHex(ctx);
  cx.fillStyle = COL.hullMid;
  cx.strokeStyle = COL.hullLite;
  cx.lineWidth = 0.8;
  for (const dy of [-4.5, 2.5]) {
    cx.fillRect(originX, half + dy, barrelLen, 3.2);
    cx.strokeRect(originX, half + dy, barrelLen, 3.2);
    cx.strokeStyle = e;
    cx.lineWidth = 1;
    cx.beginPath();
    cx.moveTo(originX + 2, half + dy + 1.6);
    cx.lineTo(originX + barrelLen - 1, half + dy + 1.6);
    cx.stroke();
    cx.strokeStyle = COL.hullLite;
  }
  drawEmissiveGlow(cx, originX + barrelLen * 0.55, half - 1, 7, energyRgb(ctx), 0.38);
}
