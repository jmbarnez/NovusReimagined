import { hudState } from "./state.js";
import { HUD_CRITICAL_COLOR, themeColor } from "./constants.js";

export function updateDriftVectors(
  cx: number,
  cy: number,
  z: number,
  r: number,
  player: { vx: number; vy: number },
  isCritical: boolean,
  themeShield: string,
  themeTextDim: string,
  gx: number,
  gy: number,
  zoomChanged: boolean,
  criticalChanged: boolean,
  driftDirty: boolean,
): void {
  if (!hudState.driftVectors) return;

  const speedMag = Math.hypot(player.vx, player.vy);
  const driftVisible = speedMag > 5;

  if (driftVisible && driftDirty) {
    hudState.driftVectors.clear();
    const vAngle = Math.atan2(player.vy, player.vx);
    const offsetDist = r + (12 + Math.min(speedMag * 0.04, 10)) * z;
    const cosA = Math.cos(vAngle);
    const sinA = Math.sin(vAngle);
    const mR = Math.max(1.8, Math.min(4, 2.5 * z));

    const rot = (lcx: number, lcy: number, dx: number, dy: number) => ({
      x: lcx + dx * cosA - dy * sinA,
      y: lcy + dx * sinA + dy * cosA,
    });

    // Prograde marker
    const px = cosA * offsetDist;
    const py = sinA * offsetDist;
    hudState.driftVectors.circle(px, py, mR);
    const pL1 = rot(px, py, -mR, 0);
    const pL2 = rot(px, py, -mR * 2, 0);
    hudState.driftVectors.moveTo(pL1.x, pL1.y);
    hudState.driftVectors.lineTo(pL2.x, pL2.y);
    const pR1 = rot(px, py, mR, 0);
    const pR2 = rot(px, py, mR * 2, 0);
    hudState.driftVectors.moveTo(pR1.x, pR1.y);
    hudState.driftVectors.lineTo(pR2.x, pR2.y);
    const pU1 = rot(px, py, 0, -mR);
    const pU2 = rot(px, py, 0, -mR * 2);
    hudState.driftVectors.moveTo(pU1.x, pU1.y);
    hudState.driftVectors.lineTo(pU2.x, pU2.y);
    hudState.driftVectors.stroke({
      color: isCritical ? HUD_CRITICAL_COLOR : themeColor(themeShield),
      width: Math.max(1, 1.2 * z),
      alpha: isCritical ? 0.6 : 0.7,
    });

    // Retrograde marker
    const rx = -cosA * offsetDist;
    const ry = -sinA * offsetDist;
    hudState.driftVectors.circle(rx, ry, mR);
    const rA1 = rot(rx, ry, -mR * 0.7, -mR * 0.7);
    const rA2 = rot(rx, ry, mR * 0.7, mR * 0.7);
    hudState.driftVectors.moveTo(rA1.x, rA1.y);
    hudState.driftVectors.lineTo(rA2.x, rA2.y);
    const rB1 = rot(rx, ry, -mR * 0.7, mR * 0.7);
    const rB2 = rot(rx, ry, mR * 0.7, -mR * 0.7);
    hudState.driftVectors.moveTo(rB1.x, rB1.y);
    hudState.driftVectors.lineTo(rB2.x, rB2.y);
    hudState.driftVectors.stroke({
      color: isCritical ? HUD_CRITICAL_COLOR : themeColor(themeTextDim),
      width: Math.max(1, 1.2 * z),
      alpha: isCritical ? 0.4 : 0.45,
    });
  } else if (!driftVisible && hudState.lastDriftVisible) {
    hudState.driftVectors.clear();
  }
  hudState.driftVectors.position.set(cx + gx, cy + gy);
}
