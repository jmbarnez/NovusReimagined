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


