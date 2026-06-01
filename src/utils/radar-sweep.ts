import { TAU } from "../constants.js";

const PASSIVE_SWEEP_SPEED = 0.0014;
const PASSIVE_DECAY_EXPONENT = 4.8;
const BASE_SIGNATURE_RADIUS = 45;

/** Continuous passive radar sweep angle (radians). */
export function radarSweepAngle(now: number): number {
  return (now * PASSIVE_SWEEP_SPEED) % TAU;
}

export function radarPingDecayExponent(): number {
  return PASSIVE_DECAY_EXPONENT;
}

export function radarSignatureDecayExponent(signatureRadius = BASE_SIGNATURE_RADIUS): number {
  const radius = Math.max(8, signatureRadius);
  const scaled = PASSIVE_DECAY_EXPONENT / Math.pow(radius / BASE_SIGNATURE_RADIUS, 0.65);
  return Math.max(0.12, Math.min(8, scaled));
}

/**
 * Phosphor-style opacity: full brightness just after the sweep passes, decaying behind it.
 */
export function radarPingOpacity(
  px: number,
  py: number,
  originX: number,
  originY: number,
  sweepAngle: number,
  decayExponent = radarPingDecayExponent(),
): number {
  const dx = px - originX;
  const dy = py - originY;
  if (Math.hypot(dx, dy) < 4) return 1;
  const targetAngle = Math.atan2(dy, dx);
  const targetNormAngle = (targetAngle + TAU) % TAU;
  let diff = sweepAngle - targetNormAngle;
  if (diff < 0) diff += TAU;
  const fraction = diff / TAU;
  return 0.1 + 0.9 * Math.exp(-fraction * decayExponent);
}
