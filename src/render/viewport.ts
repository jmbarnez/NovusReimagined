/**
 * Playable viewport.
 *
 * In-game the render surfaces are inset to the rect between the top lock-rail
 * and the bottom HUD bar (see canvas.ts / pixi.ts), so the canvas centre IS the
 * centre of the open playable area and the camera lock can use it directly.
 */

import { HUD_SIDE_W, HUD_BOTTOM_H } from "../constants.js";
import { Client } from "../state.js";

export const HUD_INSETS = {
  /** Reserved on the right edge for the side panel. Mirrors hud-side-panel CSS width. */
  get right() { return HUD_SIDE_W; },
  /** Reserved on the bottom edge for the status/slot bar. Mirrors hud-bottom-right CSS height. */
  get bottom() { return HUD_BOTTOM_H; },
};

let _w = 0;
let _h = 0;
let _left = 0;
let _top = 0;

export function setViewportSize(w: number, h: number): void {
  _w = w;
  _h = h;
}

/**
 * Set the on-screen offset of the play surface. Most layers are positioned
 * at the window origin so this is 0/0; the bottom HUD sits over the Pixi
 * canvas, but is rendered above it via DOM, so the playable area is
 * anchored to (0,0) and the inset comes from `playRect` instead.
 */
export function setViewportOffset(left: number, top: number): void {
  _left = left;
  _top = top;
}

export function viewportW(): number { return _w; }
export function viewportH(): number { return _h; }
export function viewportLeft(): number { return _left; }
export function viewportTop(): number { return _top; }

/** Centre of the playable rectangle in screen pixels. */
export function viewCenterX(Wc: number): number {
  return Wc / 2;
}
export function viewCenterY(Hc: number): number {
  return Hc / 2;
}

/** Compute the playable rect (between the HUD bars in-game, full window on the title screen). */
export function playRect() {
  const uiTop = 0;
  const uiBottom = Client.gameStarted ? HUD_BOTTOM_H : 0;
  const uiRight = Client.gameStarted ? HUD_SIDE_W : 0;
  return {
    top: uiTop,
    width: Math.max(1, window.innerWidth - uiRight),
    height: Math.max(1, window.innerHeight - uiTop - uiBottom),
  };
}
