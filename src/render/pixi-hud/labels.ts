import { Client } from "../../state.js";
import { getState } from "../../state-access.js";
import { targetByLockId } from "../../targeting.js";
import { dst } from "../../utils/math.js";
import { hudState } from "./state.js";
import { HUD_CRITICAL_COLOR, themeColor } from "./constants.js";

export function updateSpeedLabel(
  cx: number,
  cy: number,
  z: number,
  speed: number,
  r: number,
  isCritical: boolean,
  themeTextMain: string,
  gx: number,
  gy: number,
): void {
  if (!hudState.speedLabel) return;
  const speedText = `${Math.round(speed)} m/s`;
  if (hudState.speedLabel.text !== speedText) hudState.speedLabel.text = speedText;
  hudState.speedLabel.position.set(Math.round(cx - (r + 7) + gx), Math.round(cy + gy));
  const fontSize = Math.max(7, Math.min(10, 8 * z));
  if (hudState.speedLabel.style.fontSize !== fontSize) hudState.speedLabel.style.fontSize = fontSize;
  const labelColor = isCritical ? HUD_CRITICAL_COLOR : themeColor(themeTextMain);
  if ((hudState.speedLabel.style.fill as string | number) !== labelColor) hudState.speedLabel.style.fill = labelColor;
}

export function updateShieldLabel(
  cx: number,
  cy: number,
  z: number,
  r: number,
  shieldFrac: number,
  maxShield: number,
  isLowShield: boolean,
  isCritical: boolean,
  themeTextMain: string,
  gx: number,
  gy: number,
): void {
  if (!hudState.shieldLabel || maxShield <= 0) return;
  const shieldText = `${Math.round(shieldFrac * 100)}% SHD`;
  if (hudState.shieldLabel.text !== shieldText) hudState.shieldLabel.text = shieldText;
  hudState.shieldLabel.position.set(Math.round(cx + (r + 7) + gx), Math.round(cy + gy));
  const fontSize = Math.max(7, Math.min(10, 8 * z));
  if (hudState.shieldLabel.style.fontSize !== fontSize) hudState.shieldLabel.style.fontSize = fontSize;
  const shieldLabelColor = (isLowShield || isCritical) ? HUD_CRITICAL_COLOR : themeColor(themeTextMain);
  if ((hudState.shieldLabel.style.fill as string | number) !== shieldLabelColor) hudState.shieldLabel.style.fill = shieldLabelColor;
}

export function updateWarningBanner(
  cx: number,
  cy: number,
  r: number,
  isLowStruct: boolean,
  now: number,
): void {
  if (!hudState.warningBanner) return;
  if (isLowStruct) {
    const alarmBlink = Math.floor(now / 150) % 2 === 0;
    hudState.warningBanner.visible = alarmBlink;
    hudState.warningBanner.text = "CRITICAL: STRUCTURE COMPROMISED";
    hudState.warningBanner.position.set(Math.round(cx), Math.round(cy - (r + 20)));
  } else {
    hudState.warningBanner.visible = false;
  }
}

export function updateTargetLabel(
  cx: number,
  cy: number,
  isCritical: boolean,
  themeTextMain: string,
): void {
  if (!hudState.targetLabel) return;
  const primaryId = getState().player?.targetLock?.id;
  if (primaryId) {
    const target = targetByLockId(primaryId, getState().player);
    if (target && target.hp > 0) {
      const player = getState().player;
      const targetSx = cx + (target.x - Client.camx) * Client.zoom;
      const targetSy = cy + (target.y - Client.camy) * Client.zoom;
      const targetRad = target.radius || 18;
      const bracketOffset = (targetRad + 9) * Client.zoom;
      const targetDist = Math.round(dst(player.x, player.y, target.x, target.y));

      const distText = `[${targetDist}m]`;
      if (hudState.targetLabel.text !== distText) hudState.targetLabel.text = distText;
      hudState.targetLabel.position.set(Math.round(targetSx + bracketOffset + 5), Math.round(targetSy));
      const labelColor = isCritical ? HUD_CRITICAL_COLOR : themeColor(themeTextMain);
      if ((hudState.targetLabel.style.fill as string | number) !== labelColor) hudState.targetLabel.style.fill = labelColor;
      hudState.targetLabel.visible = true;
    } else {
      hudState.targetLabel.visible = false;
    }
  } else {
    hudState.targetLabel.visible = false;
  }
}
