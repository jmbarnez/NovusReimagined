import { HUD_SIDE_W, HUD_BOTTOM_H, LOCK_RAIL_H } from "./constants.js";
import { Client } from "./state.js";
import { getState } from "./state-access.js";

const canvas = document.getElementById("c") as HTMLCanvasElement;
const _ctx = canvas.getContext("2d", { alpha: true });
if (!_ctx) throw new Error("Failed to get 2D canvas context");
const ctx: CanvasRenderingContext2D = _ctx;

let _canvasDpr = 1;
let _canvasW = 0, _canvasH = 0;
let _canvasLeft = 0, _canvasTop = 0;

export const W = () => _canvasW;
export const H = () => _canvasH;
/** Screen-space offset of the canvas top-left (0,0 on the title screen; inset below the lock-rail in-game). */
export const canvasLeft = () => _canvasLeft;
export const canvasTop = () => _canvasTop;
export { canvas, ctx, _canvasDpr };

export function resize() {
  const cap = Client.settings?.renderScale ?? 2.5;
  _canvasDpr = Math.min(window.devicePixelRatio || 1, cap);
  // Canvas always spans from the top of the screen (behind lock-rail and minimap)
  // to the bottom HUD bar. The lock rail and minimap overlay transparently on top.
  const uiTop = 0;
  const uiBottom = Client.gameStarted ? HUD_BOTTOM_H : 0;
  const uiRight = Client.gameStarted ? HUD_SIDE_W : 0;
  _canvasLeft = 0;
  _canvasTop = uiTop;
  _canvasW = Math.max(1, window.innerWidth - uiRight);
  _canvasH = Math.max(1, window.innerHeight - uiTop - uiBottom);
  const bw = Math.max(1, Math.round(_canvasW * _canvasDpr));
  const bh = Math.max(1, Math.round(_canvasH * _canvasDpr));
  canvas.width = bw;
  canvas.height = bh;
  canvas.style.width = `${_canvasW}px`;
  canvas.style.height = `${_canvasH}px`;
  canvas.style.position = "fixed";
  canvas.style.top = `${uiTop}px`;
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
