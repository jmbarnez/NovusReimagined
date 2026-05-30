import { Graphics } from "pixi.js";
import { getState } from "../state-access.js";
import { effectLayer } from "../pixi.js";
import { isVisible } from "../utils/game.js";
import { getCurrentTutorialStep } from "../data/tutorial.js";
import {
  trackTotalArcLength,
  getTutorialTrackForNav,
  type TutorialTrackSegment,
} from "../data/tutorial-layout.js";

const TAU = Math.PI * 2;
const CHEVRON_SPACING = 140;

let _trackGfx: Graphics | null = null;

function pointAtArcLengthLocal(track: TutorialTrackSegment, arcLen: number): { x: number; y: number } {
  let acc = 0;
  for (let i = 0; i < track.points.length - 1; i++) {
    const a = track.points[i];
    const b = track.points[i + 1];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    if (acc + segLen >= arcLen) {
      const t = segLen > 0 ? (arcLen - acc) / segLen : 0;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    acc += segLen;
  }
  return track.points[track.points.length - 1];
}

function tangentAtArcLengthLocal(track: TutorialTrackSegment, arcLen: number): number {
  let acc = 0;
  for (let i = 0; i < track.points.length - 1; i++) {
    const a = track.points[i];
    const b = track.points[i + 1];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    if (acc + segLen >= arcLen) {
      return Math.atan2(b.y - a.y, b.x - a.x);
    }
    acc += segLen;
  }
  const last = track.points[track.points.length - 1];
  const prev = track.points[track.points.length - 2];
  return Math.atan2(last.y - prev.y, last.x - prev.x);
}

function drawCenterline(gfx: Graphics, track: TutorialTrackSegment): void {
  for (let i = 0; i < track.points.length - 1; i++) {
    const a = track.points[i];
    const b = track.points[i + 1];
    if (!isVisible((a.x + b.x) / 2, (a.y + b.y) / 2, 120)) continue;
    gfx.moveTo(a.x, a.y);
    gfx.lineTo(b.x, b.y);
  }
  gfx.stroke({ color: 0x55aaff, width: 1.5, alpha: 0.3 });
}

function drawChevrons(gfx: Graphics, track: TutorialTrackSegment, now: number): void {
  const total = trackTotalArcLength(track);
  for (let arc = CHEVRON_SPACING * 0.5; arc < total; arc += CHEVRON_SPACING) {
    const pt = pointAtArcLengthLocal(track, arc);
    if (!isVisible(pt.x, pt.y, 80)) continue;
    const ang = tangentAtArcLengthLocal(track, arc);
    const blink = 0.3 + 0.6 * Math.abs(Math.sin(now * 0.006 + arc * 0.02));
    const alpha = 0.65 * blink;
    const sz = 16;
    const cx = pt.x;
    const cy = pt.y;
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    const tipX = cx + cos * sz;
    const tipY = cy + sin * sz;
    const lx = cx + Math.cos(ang + 2.4) * sz * 0.55;
    const ly = cy + Math.sin(ang + 2.4) * sz * 0.55;
    const rx = cx + Math.cos(ang - 2.4) * sz * 0.55;
    const ry = cy + Math.sin(ang - 2.4) * sz * 0.55;
    gfx.moveTo(tipX, tipY);
    gfx.lineTo(lx, ly);
    gfx.lineTo(rx, ry);
    gfx.closePath();
    gfx.fill({ color: 0x55aaff, alpha });
  }
}

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
  const track = getTutorialTrackForNav(activeStep?.nav?.trackId);
  if (!track) {
    _trackGfx.visible = false;
    return;
  }

  drawCenterline(_trackGfx, track);
  drawChevrons(_trackGfx, track, now);

  _trackGfx.visible = true;
}

export function destroyPixiTutorialTrack(): void {
  _trackGfx?.destroy();
  _trackGfx = null;
}

/** Draw the active goal track on the system map (canvas). */
export function drawTutorialTracksOnMap(
  ctx: CanvasRenderingContext2D,
  worldToScreen: (wx: number, wy: number) => { x: number; y: number },
  trackId?: string,
): void {
  if (!getState().player?.tutorial?.active || getState().player.sysIdx !== 0 || !trackId) return;

  const track = getTutorialTrackForNav(trackId);
  if (!track) return;

  ctx.save();
  ctx.setLineDash([6, 8]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(85, 170, 255, 0.6)";
  ctx.beginPath();
  for (let i = 0; i < track.points.length; i++) {
    const p = worldToScreen(track.points[i].x, track.points[i].y);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  ctx.restore();
}
