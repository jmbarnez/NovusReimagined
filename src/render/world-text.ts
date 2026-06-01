/**
 * World-space projection helpers.
 *
 * The Canvas 2D `worldText` / `worldCardText` helpers that used to live here
 * have been replaced by Pixi `Text` renderers (see `pixi-chat-bubbles.ts` and
 * `pixi-entities.ts`). The projection utilities are still useful for HUD layers
 * (target arrows, tutorial track arrows) that draw into Pixi with absolute
 * screen positions.
 *
 * Call setWorldView() once per frame after the camera is computed, then use
 * worldToScreen() inside renderers.
 */
import { viewCenterX, viewCenterY } from "./viewport.js";

let _Wc = 0, _Hc = 0, _cx = 0, _cy = 0, _zoom = 1;
let _viewCX = 0, _viewCY = 0;

export function setWorldView(Wc: number, Hc: number, camX: number, camY: number, zoom: number) {
  _Wc = Wc; _Hc = Hc; _cx = camX; _cy = camY; _zoom = zoom;
  _viewCX = viewCenterX(Wc);
  _viewCY = viewCenterY(Hc);
}

/** Project a world point to screen pixels (e.g. for HUD lines pointing at a world entity). */
export function worldToScreen(wx: number, wy: number): { x: number; y: number } {
  return {
    x: _viewCX + (wx - _cx) * _zoom,
    y: _viewCY + (wy - _cy) * _zoom,
  };
}
