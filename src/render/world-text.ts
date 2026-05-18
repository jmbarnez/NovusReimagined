/**
 * Crisp world-space text rendering.
 *
 * Text drawn through the world transform (after ctx.scale(zoom)) gets bilinearly
 * resampled and looks soft, especially when zoomed out. These helpers project
 * the world position to screen pixels, reset the transform, and draw the glyphs
 * at a fixed pixel size on integer coordinates — sharp at any zoom.
 *
 * Call setWorldView() once per frame after the camera is computed, then use
 * worldText() / worldPath() inside renderers.
 */
import { ctx, _canvasDpr } from "../canvas.js";
import { viewCenterX, viewCenterY } from "./viewport.js";

let _Wc = 0, _Hc = 0, _cx = 0, _cy = 0, _zoom = 1;
let _viewCX = 0, _viewCY = 0;

export function setWorldView(Wc: number, Hc: number, camX: number, camY: number, zoom: number) {
  _Wc = Wc; _Hc = Hc; _cx = camX; _cy = camY; _zoom = zoom;
  _viewCX = viewCenterX(Wc);
  _viewCY = viewCenterY(Hc);
}

export interface WorldTextOpts {
  font?: string;
  fill?: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  alpha?: number;
  shadow?: boolean;
  offsetX?: number;
  offsetY?: number;
}

export interface WorldCardTextOpts {
  font?: string;
  textColor?: string;
  bgColor?: string;
  alpha?: number;
  offsetX?: number;
  offsetY?: number;
}

export function worldText(wx: number, wy: number, text: string, opts: WorldTextOpts = {}) {
  const sx = _viewCX + (wx - _cx) * _zoom + (opts.offsetX ?? 0);
  const sy = _viewCY + (wy - _cy) * _zoom + (opts.offsetY ?? 0);
  const ix = Math.round(sx);
  const iy = Math.round(sy);
  ctx.save();
  ctx.setTransform(_canvasDpr, 0, 0, _canvasDpr, 0, 0);
  ctx.font = opts.font ?? "bold 12px monospace";
  ctx.textAlign = opts.align ?? "center";
  ctx.textBaseline = opts.baseline ?? "alphabetic";
  if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
  if (opts.shadow) {
    ctx.fillStyle = "rgba(0,0,0,0.78)";
    ctx.fillText(text, ix + 1, iy + 1);
  }
  ctx.fillStyle = opts.fill ?? "#ffffff";
  ctx.fillText(text, ix, iy);
  ctx.restore();
}

export function worldCardText(wx: number, wy: number, text: string, opts: WorldCardTextOpts = {}) {
  const sx = _viewCX + (wx - _cx) * _zoom + (opts.offsetX ?? 0);
  const sy = _viewCY + (wy - _cy) * _zoom + (opts.offsetY ?? 0);
  const ix = Math.round(sx);
  const iy = Math.round(sy);

  ctx.save();
  ctx.setTransform(_canvasDpr, 0, 0, _canvasDpr, 0, 0);
  ctx.globalAlpha = opts.alpha ?? 1;
  ctx.font = opts.font ?? "bold 12px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  const metrics = ctx.measureText(text);
  const padX = 6;
  const padY = 3;
  const w = metrics.width + padX * 2;
  const h = 16;
  const rx = ix - w / 2;
  const ry = iy - h + 2;
  const radius = 3;

  ctx.fillStyle = opts.bgColor ?? "#333333";
  ctx.beginPath();
  ctx.moveTo(rx + radius, ry);
  ctx.lineTo(rx + w - radius, ry);
  ctx.quadraticCurveTo(rx + w, ry, rx + w, ry + radius);
  ctx.lineTo(rx + w, ry + h - radius);
  ctx.quadraticCurveTo(rx + w, ry + h, rx + w - radius, ry + h);
  ctx.lineTo(rx + radius, ry + h);
  ctx.quadraticCurveTo(rx, ry + h, rx, ry + h - radius);
  ctx.lineTo(rx, ry + radius);
  ctx.quadraticCurveTo(rx, ry, rx + radius, ry);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 0.5;
  ctx.stroke();

  ctx.fillStyle = opts.textColor ?? "#ffffff";
  ctx.fillText(text, ix, iy);
  ctx.restore();
}

/** Project a world point to screen pixels (e.g. for HUD lines pointing at a world entity). */
export function worldToScreen(wx: number, wy: number): { x: number; y: number } {
  return {
    x: _viewCX + (wx - _cx) * _zoom,
    y: _viewCY + (wy - _cy) * _zoom,
  };
}
