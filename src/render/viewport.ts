/**
 * Playable viewport — the rectangle on screen NOT covered by persistent HUD.
 *
 * The camera centers in this rectangle instead of the canvas centre so the
 * player's ship sits visually balanced in the open area (à la RuneScape), not
 * pushed leftward behind the right-side panel.
 *
 * Insets default to the bundled HUD layout but can be updated at runtime if
 * the HUD ever resizes (e.g. collapsing the side panel).
 */

import { HUD_SIDE_W, HUD_BOTTOM_H } from "../constants.js";
import { Client } from "../state.js";

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
