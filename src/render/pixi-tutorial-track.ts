import { Graphics } from "pixi.js";
import { getState } from "../state-access.js";
import { effectLayer } from "../pixi.js";
import { getCurrentTutorialStep } from "../data/tutorial.js";
import { getTutorialTrackForNav } from "../data/tutorial-layout.js";

let _trackGfx: Graphics | null = null;

export function initPixiTutorialTrack(): void {
  if (!effectLayer) return;
  if (!_trackGfx) {
    _trackGfx = new Graphics();
    _trackGfx.label = "tutorial-track-guide";
    effectLayer.addChild(_trackGfx);
  }
}

export function syncPixiTutorialTrack(now: number): void {
  initPixiTutorialTrack();
  if (!_trackGfx) return;

  _trackGfx.clear();

  if (!getState().player?.tutorial?.active || getState().player.sysIdx !== 0) {
    _trackGfx.visible = false;
    return;
  }

  const activeStep = getCurrentTutorialStep(getState().player);
  if (!activeStep) {
    _trackGfx.visible = false;
    return;
  }

  // World-space chevrons are disabled; tutorial direction is handled by the
  // off-screen guide arrow in pixi-target-arrows.ts.
  _trackGfx.visible = false;
}

/** Draw the active goal track on the system map (Pixi Graphics). */
export function drawTutorialTracksOnMap(
  g: Graphics,
  worldToScreen: (wx: number, wy: number) => { x: number; y: number },
  trackId?: string,
): void {
  if (!getState().player?.tutorial?.active || getState().player.sysIdx !== 0 || !trackId) return;

  const track = getTutorialTrackForNav(trackId);
  if (!track) return;

  for (let i = 0; i < track.points.length - 1; i++) {
    const a = worldToScreen(track.points[i].x, track.points[i].y);
    const b = worldToScreen(track.points[i + 1].x, track.points[i + 1].y);
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
  }
  g.stroke({ color: 0x55aaff, width: 2, alpha: 0.6 });
}
