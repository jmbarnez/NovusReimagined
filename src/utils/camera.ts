/**
 * Camera follow — lock the camera to the interpolated player position.
 *
 * Called at render time with the fixed-tick interpolation alpha. The camera
 * uses the same interpolated coordinates as the player sprite, so the ship
 * sits at a fixed screen position with zero relative jitter regardless of
 * framerate, FP drift, or HUD layout changes.
 */
import { G, Client } from "../state.js";
import { lerp } from "./math.js";

export function updateCamera(alpha: number) {
  Client.camx = lerp(G.P.px, G.P.x, alpha);
  Client.camy = lerp(G.P.py, G.P.y, alpha);
}
