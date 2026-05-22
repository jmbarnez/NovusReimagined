/**
 * Playable viewport.
 *
 * In-game the render surfaces are inset to the rect between the top lock-rail
 * and the bottom HUD bar (see canvas.ts / pixi.ts), so the canvas centre IS the
 * centre of the open playable area and the camera lock can use it directly.
 */

import { HUD_SIDE_W, HUD_BOTTOM_H } from "../constants.js";

export const HUD_INSETS = {
  /** Reserved on the right edge for the side panel. Mirrors hud-side-panel CSS width. */
  get right() { return HUD_SIDE_W; },
  /** Reserved on the bottom edge for the status/slot bar. Mirrors hud-bottom-right CSS height. */
  get bottom() { return HUD_BOTTOM_H; },
};

/** Centre of the playable rectangle in screen pixels. */
export function viewCenterX(Wc: number): number {
  return Wc / 2;
}
export function viewCenterY(Hc: number): number {
  return Hc / 2;
}
