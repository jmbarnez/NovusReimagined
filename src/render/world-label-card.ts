/**
 * Shared world-space label card (dark panel + cyan text) for nameplates and key hints.
 * Used by Pixi entity labels and canvas overlays in `world-overlays.ts`.
 */
import { Graphics, Text, TextStyle } from "pixi.js";
import { ctx, _canvasDpr } from "../canvas.js";
import { getUIFont } from "./ui-font.js";
import { viewCenterX, viewCenterY } from "./viewport.js";

export const WORLD_LABEL_PAD_X = 6;
export const WORLD_LABEL_PAD_Y = 3.5;
export const WORLD_LABEL_RADIUS = 3.5;
export const WORLD_LABEL_FILL = "#88c8ff";
export const WORLD_LABEL_BORDER = 0x3c78c8;

let _worldLabelStyle: TextStyle | null = null;

export function getWorldLabelTextStyle(): TextStyle {
  if (!_worldLabelStyle) {
    _worldLabelStyle = new TextStyle({
      fontFamily: getUIFont(),
      fontSize: 11,
      fontWeight: "bold",
      fill: WORLD_LABEL_FILL,
      align: "center",
      stroke: { color: "#000000", width: 3 },
    });
  }
  return _worldLabelStyle;
}

export function refreshWorldLabelTextStyle(): void {
  getWorldLabelTextStyle().fontFamily = getUIFont();
}

/** Title-case label text; bracketed key hints (e.g. [F]) stay uppercase. */
export function formatWorldLabelText(text: string): string {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      if (/^\[[^\]]+\]$/i.test(token)) return token.toUpperCase();
      const lower = token.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

/** Draw a centered label card behind Pixi text (text anchor must be 0.5, 0.5). */
export function layoutWorldLabelCard(bg: Graphics, text: Text): void {
  const cardW = text.width + WORLD_LABEL_PAD_X * 2;
  const cardH = text.height + WORLD_LABEL_PAD_Y * 2;
  bg.clear();
  bg
    .roundRect(-cardW / 2, -cardH / 2, cardW, cardH, WORLD_LABEL_RADIUS)
    .fill({ color: 0x000000, alpha: 0.55 })
    .stroke({ color: WORLD_LABEL_BORDER, width: 1.0, alpha: 0.7 });
}

let _viewCX = 0;
let _viewCY = 0;
let _cx = 0;
let _cy = 0;
let _zoom = 1;

export function setWorldLabelView(Wc: number, Hc: number, camX: number, camY: number, zoom: number): void {
  _cx = camX;
  _cy = camY;
  _zoom = zoom;
  _viewCX = viewCenterX(Wc);
  _viewCY = viewCenterY(Hc);
}

export interface DrawWorldLabelCardOpts {
  fill?: string;
  alpha?: number;
  offsetX?: number;
  offsetY?: number;
}

/** Canvas 2D label card at a world position (sharp at any zoom). */
export function drawWorldLabelCard(
  wx: number,
  wy: number,
  text: string,
  opts: DrawWorldLabelCardOpts = {},
): void {
  const label = formatWorldLabelText(text);
  const sx = _viewCX + (wx - _cx) * _zoom + (opts.offsetX ?? 0);
  const sy = _viewCY + (wy - _cy) * _zoom + (opts.offsetY ?? 0);
  const ix = Math.round(sx);
  const iy = Math.round(sy);

  ctx.save();
  ctx.setTransform(_canvasDpr, 0, 0, _canvasDpr, 0, 0);
  ctx.globalAlpha = opts.alpha ?? 1;
  ctx.font = `bold 11px ${getUIFont()}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const metrics = ctx.measureText(label);
  const cardW = metrics.width + WORLD_LABEL_PAD_X * 2;
  const cardH = 14 + WORLD_LABEL_PAD_Y * 2;
  const rx = ix - cardW / 2;
  const ry = iy - cardH / 2;
  const r = WORLD_LABEL_RADIUS;

  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.beginPath();
  ctx.moveTo(rx + r, ry);
  ctx.lineTo(rx + cardW - r, ry);
  ctx.quadraticCurveTo(rx + cardW, ry, rx + cardW, ry + r);
  ctx.lineTo(rx + cardW, ry + cardH - r);
  ctx.quadraticCurveTo(rx + cardW, ry + cardH, rx + cardW - r, ry + cardH);
  ctx.lineTo(rx + r, ry + cardH);
  ctx.quadraticCurveTo(rx, ry + cardH, rx, ry + cardH - r);
  ctx.lineTo(rx, ry + r);
  ctx.quadraticCurveTo(rx, ry, rx + r, ry);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(60, 120, 200, 0.7)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.lineWidth = 3;
  ctx.strokeStyle = "#000000";
  ctx.strokeText(label, ix, iy);
  ctx.fillStyle = opts.fill ?? WORLD_LABEL_FILL;
  ctx.fillText(label, ix, iy);
  ctx.restore();
}
