/**
 * Shared corner lock-bracket drawing and styling for PixiJS v8.
 * Enemies use hostile orange/red/yellow; asteroids & wrecks use neutral blue.
 */
import type { Graphics } from "pixi.js";
import type { LockSlot } from "../types/world.js";

export type LockBracketTargetKind = "enemy" | "neutral";

export interface LockBracketStyle {
  color: number;
  alpha: number;
  lineWidth: number;
}

export interface EnemyLockBracketContext {
  hasLockOnPlayer?: boolean;
  targetingPlayer?: boolean;
}

export function resolveLockBracketStyle(
  slot: LockSlot,
  isPrimary: boolean,
  now: number,
  kind: LockBracketTargetKind,
  enemy?: EnemyLockBracketContext,
  alphaScale = 1,
): LockBracketStyle {
  if (kind === "enemy") {
    let color = 0xff5522;
    let alpha = isPrimary ? 0.90 : 0.70;
    let lineWidth = isPrimary ? 1.7 : 1.3;

    if (enemy?.hasLockOnPlayer) {
      color = 0xff3b30;
      alpha = isPrimary ? 0.95 : 0.75;
      lineWidth = isPrimary ? 1.8 : 1.4;
    } else if (enemy?.targetingPlayer) {
      const blink = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(now * 0.024));
      color = 0xffcc00;
      alpha = blink * (isPrimary ? 0.95 : 0.75);
    } else if (slot.resolving) {
      const blink = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(now * 0.014));
      color = 0xff8800;
      alpha = blink * (isPrimary ? 0.85 : 0.65);
      lineWidth = isPrimary ? 1.4 : 1.1;
    }

    return { color, alpha: alpha * alphaScale, lineWidth };
  }

  // Neutral targets: asteroids, wreck pieces, etc.
  let color = 0x0077ff;
  let alpha = isPrimary ? 0.90 : 0.70;
  let lineWidth = isPrimary ? 1.7 : 1.3;

  if (slot.resolving) {
    const blink = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(now * 0.014));
    color = 0x00d2ff;
    alpha = blink * (isPrimary ? 0.85 : 0.65);
    lineWidth = isPrimary ? 1.4 : 1.1;
  }

  return { color, alpha: alpha * alphaScale, lineWidth };
}

export function drawLockBracketsGfx(
  g: Graphics,
  cx: number,
  cy: number,
  radius: number,
  isPrimary: boolean,
  color: number,
  alpha: number,
  lw: number,
): void {
  const sz = isPrimary ? radius + 9 : radius + 6;
  const arm = isPrimary ? 7 : 5;

  g.moveTo(cx - sz + arm, cy - sz).lineTo(cx - sz, cy - sz).lineTo(cx - sz, cy - sz + arm)
    .moveTo(cx + sz - arm, cy - sz).lineTo(cx + sz, cy - sz).lineTo(cx + sz, cy - sz + arm)
    .moveTo(cx + sz - arm, cy + sz).lineTo(cx + sz, cy + sz).lineTo(cx + sz, cy + sz - arm)
    .moveTo(cx - sz + arm, cy + sz).lineTo(cx - sz, cy + sz).lineTo(cx - sz, cy + sz - arm)
    .stroke({ color, width: lw, alpha, cap: "square", join: "miter" });
}

export function drawTargetLockBrackets(
  g: Graphics,
  cx: number,
  cy: number,
  radius: number,
  slot: LockSlot,
  isPrimary: boolean,
  now: number,
  kind: LockBracketTargetKind,
  enemy?: EnemyLockBracketContext,
  alphaScale = 1,
): void {
  const style = resolveLockBracketStyle(slot, isPrimary, now, kind, enemy, alphaScale);
  drawLockBracketsGfx(g, cx, cy, radius, isPrimary, style.color, style.alpha, style.lineWidth);
}

/** Pulsing white outer brackets — shown on the lock-card selection (_assignTargetId). */
export function drawSelectedTargetIndicator(
  g: Graphics,
  cx: number,
  cy: number,
  radius: number,
  now: number,
): void {
  const pulse = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(now * 0.007));
  const sz = radius + 15;
  const arm = 10;

  g.moveTo(cx - sz + arm, cy - sz).lineTo(cx - sz, cy - sz).lineTo(cx - sz, cy - sz + arm)
    .moveTo(cx + sz - arm, cy - sz).lineTo(cx + sz, cy - sz).lineTo(cx + sz, cy - sz + arm)
    .moveTo(cx + sz - arm, cy + sz).lineTo(cx + sz, cy + sz).lineTo(cx + sz, cy + sz - arm)
    .moveTo(cx - sz + arm, cy + sz).lineTo(cx - sz, cy + sz).lineTo(cx - sz, cy + sz - arm)
    .stroke({ color: 0xffffff, width: 2.0, alpha: pulse * 0.9, cap: "square", join: "miter" });
}
