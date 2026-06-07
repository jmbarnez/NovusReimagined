/**
 * Camera follow — lock the camera to the interpolated player position.
 *
 * Called at render time with the fixed-tick interpolation alpha. The camera
 * uses the same interpolated coordinates as the player sprite, so the ship
 * sits at a fixed screen position with zero relative jitter regardless of
 * framerate, FP drift, or HUD layout changes.
 */
import { Client } from "../state.js";
import { getState } from "../state-access.js";
import { lerp } from "./math.js";

export function updateCamera(alpha: number) {
  Client.camx = lerp(getState().player.px, getState().player.x, alpha);
  Client.camy = lerp(getState().player.py, getState().player.y, alpha);
  Client.zoom = 1.0; // locked to base to prevent subpixel blur at non-integer scales
}
