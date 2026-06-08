import { hudState } from "./state.js";
import { HUD_CRITICAL_COLOR, HUD_BOOST_COLOR, themeColor } from "./constants.js";

export function updateSpeedArc(
  cx: number,
  cy: number,
  z: number,
  r: number,
  span: number,
  arcLineWidth: number,
  spdPct: number,
  boostFx: boolean,
  boostPulse: number,
  isCritical: boolean,
  themeTextFaint: string,
  themeAccent: string,
  gx: number,
  gy: number,
  zoomChanged: boolean,
  spdPctChanged: boolean,
  boostFxChanged: boolean,
  boostPulseChanged: boolean,
  criticalChanged: boolean,
): void {
  if (!hudState.speedArcBg || !hudState.speedArcFill) return;

  if (zoomChanged || boostFxChanged || boostPulseChanged) {
    hudState.speedArcBg.clear();
    hudState.speedArcBg.arc(0, 0, r, Math.PI - span, Math.PI + span);
    hudState.speedArcBg.stroke({
      color: themeColor(themeTextFaint),
      width: arcLineWidth + boostPulse * 1.4,
      alpha: 0.12,
    });
  }
  hudState.speedArcBg.position.set(cx + gx, cy + gy);

  if (zoomChanged || spdPctChanged || boostFxChanged || boostPulseChanged || criticalChanged) {
    hudState.speedArcFill.clear();
    hudState.speedArcFill.arc(0, 0, r, Math.PI + span, Math.PI + span - spdPct * (span * 2), true);
    hudState.speedArcFill.stroke({
      color: isCritical ? HUD_CRITICAL_COLOR : boostFx ? HUD_BOOST_COLOR : themeColor(themeAccent),
      width: arcLineWidth + boostPulse * 1.1,
      alpha: Math.min(1, 0.85 + boostPulse * 0.15),
    });
  }
  hudState.speedArcFill.position.set(cx + gx, cy + gy);
}

export function updateShieldArc(
  cx: number,
  cy: number,
  z: number,
  r: number,
  span: number,
  arcLineWidth: number,
  shieldFrac: number,
  maxShield: number,
  isLowShield: boolean,
  isCritical: boolean,
  themeTextFaint: string,
  themeShield: string,
  gx: number,
  gy: number,
  zoomChanged: boolean,
  shieldFracChanged: boolean,
  criticalChanged: boolean,
): void {
  if (!hudState.shieldArcBg || !hudState.shieldArcFill) return;

  if (maxShield > 0) {
    if (zoomChanged || criticalChanged) {
      hudState.shieldArcBg.clear();
      hudState.shieldArcBg.arc(0, 0, r, -span, span);
      hudState.shieldArcBg.stroke({
        color: themeColor(themeTextFaint),
        width: arcLineWidth,
        alpha: 0.12,
      });
    }
    hudState.shieldArcBg.position.set(cx + gx, cy + gy);

    if (zoomChanged || shieldFracChanged || criticalChanged) {
      hudState.shieldArcFill.clear();
      hudState.shieldArcFill.arc(0, 0, r, span, span - shieldFrac * (span * 2), true);
      hudState.shieldArcFill.stroke({
        color: (isLowShield || isCritical) ? HUD_CRITICAL_COLOR : themeColor(themeShield),
        width: arcLineWidth,
        alpha: 0.85,
      });
    }
    hudState.shieldArcFill.position.set(cx + gx, cy + gy);
  } else {
    hudState.shieldArcBg.clear();
    hudState.shieldArcBg.position.set(cx + gx, cy + gy);
    hudState.shieldArcFill.clear();
    hudState.shieldArcFill.position.set(cx + gx, cy + gy);
  }
}
