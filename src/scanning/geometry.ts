export const TRIANGULATION_PROGRESS_MULT = 1.2;
export const PROGRESS_CAP_UNTIL_TRIANG = 0.55;

export function normalizeAngleDeg(deg: number): number {
  const out = deg % 360;
  return out < 0 ? out + 360 : out;
}

export function angularDistanceDeg(a: number, b: number): number {
  let diff = Math.abs(normalizeAngleDeg(a) - normalizeAngleDeg(b));
  if (diff > 180) diff = 360 - diff;
  return diff;
}

/** True when site bearing lies inside the scan cone centered on scanAngleDeg. */
export function isInScanCone(siteBearingDeg: number, scanAngleDeg: number, coneDeg: number): boolean {
  return angularDistanceDeg(siteBearingDeg, scanAngleDeg) <= coneDeg / 2;
}

export function bearingToPointDeg(fromX: number, fromY: number, toX: number, toY: number): number {
  return normalizeAngleDeg(Math.atan2(toY - fromY, toX - fromX) * 180 / Math.PI);
}

/** Clamp resolve progress until a second in-cone pulse (tutorial sites exempt). */
export function applyProgressCap(
  progress: number,
  pulseSamples: number,
  isTutorialSite?: boolean,
): number {
  if (isTutorialSite || pulseSamples >= 2) return progress;
  return Math.min(PROGRESS_CAP_UNTIL_TRIANG, progress);
}

export function lerpAngleDeg(a: number, b: number, t: number): number {
  const diff = ((b - a + 540) % 360) - 180;
  return normalizeAngleDeg(a + diff * t);
}
