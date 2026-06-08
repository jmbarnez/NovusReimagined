import { hudState } from "./state.js";
import { HUD_CRITICAL_COLOR, themeColor } from "./constants.js";

export function updateHorizon(
  cx: number,
  cy: number,
  z: number,
  playerAngle: number,
  isCritical: boolean,
  themeTextMain: string,
  gx: number,
  gy: number,
  zoomChanged: boolean,
  angleChanged: boolean,
  criticalChanged: boolean,
): void {
  if (!hudState.horizonLine) return;
  if (zoomChanged || angleChanged || criticalChanged) {
    hudState.horizonLine.clear();
    hudState.horizonLine.rotation = playerAngle;
    // Left wing bracket
    hudState.horizonLine.moveTo(-25 * z, 0);
    hudState.horizonLine.lineTo(-15 * z, 0);
    hudState.horizonLine.lineTo(-18 * z, 4 * z);
    // Right wing bracket
    hudState.horizonLine.moveTo(15 * z, 0);
    hudState.horizonLine.lineTo(25 * z, 0);
    hudState.horizonLine.lineTo(18 * z, 4 * z);
    // Central flight box
    hudState.horizonLine.rect(-3 * z, -3 * z, 6 * z, 6 * z);
    hudState.horizonLine.stroke({
      width: Math.max(1, 1.2 * z),
      color: isCritical ? HUD_CRITICAL_COLOR : themeColor(themeTextMain),
      alpha: isCritical ? 0.45 : 0.35,
    });
  }
  hudState.horizonLine.position.set(cx + gx, cy + gy);
}
