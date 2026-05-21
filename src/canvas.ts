import { HUD_SIDE_W, HUD_BOTTOM_H } from "./constants.js";
import { G, Client } from "./state.js";

const canvas = document.getElementById("c") as HTMLCanvasElement;
const _ctx = canvas.getContext("2d", { alpha: true });
if (!_ctx) throw new Error("Failed to get 2D canvas context");
const ctx: CanvasRenderingContext2D = _ctx;

let _canvasDpr = 1;
let _canvasW = 0, _canvasH = 0;

export const W = () => _canvasW;
export const H = () => _canvasH;
export { canvas, ctx, _canvasDpr };

export function resize() {
  const cap = Client.settings?.renderScale ?? 2.5;
  _canvasDpr = Math.min(window.devicePixelRatio || 1, cap);
  const uiRight = Client.gameStarted ? HUD_SIDE_W : 0;
  const uiBottom = Client.gameStarted ? HUD_BOTTOM_H : 0;
  _canvasW = Math.max(1, window.innerWidth - uiRight);
  _canvasH = Math.max(1, window.innerHeight - uiBottom);
  const bw = Math.max(1, Math.round(_canvasW * _canvasDpr));
  const bh = Math.max(1, Math.round(_canvasH * _canvasDpr));
  canvas.width = bw;
  canvas.height = bh;
  canvas.style.width = `${_canvasW}px`;
  canvas.style.height = `${_canvasH}px`;
  canvas.style.position = "fixed";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.zIndex = "1";
  canvas.style.pointerEvents = "none";
  ctx.setTransform(_canvasDpr, 0, 0, _canvasDpr, 0, 0);
  if ("imageSmoothingEnabled" in ctx) ctx.imageSmoothingEnabled = true;
  if ("imageSmoothingQuality" in ctx) ctx.imageSmoothingQuality = "high";
}

resize();
window.addEventListener("resize", resize);

export function disposeCanvas() {
  window.removeEventListener("resize", resize);
}
