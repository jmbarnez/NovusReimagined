import { C } from "../config/index.js";
import type { Player } from "../state.js";
import { lerp } from "../utils/math.js";

export interface Vec2 {
  x: number;
  y: number;
}

export interface TurretOriginConfig {
  /** Ship-path +X toward the nose (same space as `nozzleOffsets` / hull `path`). */
  forwardPx: number;
  /** Ship-path +Y toward the hull bottom on screen when the nose points right. */
  localDownPx: number;
}

export interface ShipPose {
  x: number;
  y: number;
  angle: number;
  px?: number;
  py?: number;
  prevAngle?: number;
}

/**
 * Rotate a ship-path local offset into world space.
 * Uses the same transform as thrust nozzles in `pixi-thrust.ts`.
 */
export function shipLocalToWorld(
  shipX: number,
  shipY: number,
  shipAngle: number,
  localX: number,
  localY: number,
): Vec2 {
  const ca = Math.cos(shipAngle);
  const sa = Math.sin(shipAngle);
  return {
    x: shipX + ca * localX - sa * localY,
    y: shipY + sa * localX + ca * localY,
  };
}

/** World-space belly turret origin from ship pose + global config offset. */
export function turretOriginToWorld(
  shipX: number,
  shipY: number,
  shipAngle: number,
  origin: TurretOriginConfig = C.COMBAT.TURRET_ORIGIN,
): Vec2 {
  return shipLocalToWorld(shipX, shipY, shipAngle, origin.forwardPx, origin.localDownPx);
}

export function getRenderedTurretOrigin(
  ship: ShipPose,
  alpha: number,
  origin: TurretOriginConfig = C.COMBAT.TURRET_ORIGIN,
): Vec2 {
  const px = lerp(ship.px ?? ship.x, ship.x, alpha);
  const py = lerp(ship.py ?? ship.y, ship.y, alpha);
  const ang = lerp(ship.prevAngle ?? ship.angle, ship.angle, alpha);
  return turretOriginToWorld(px, py, ang, origin);
}

/** Physics-step turret origin (simulation / hit detection). */
export function getPlayerTurretOrigin(p: Player): Vec2 {
  return turretOriginToWorld(p.x, p.y, p.angle);
}

/** Render-step turret origin (interpolated position + heading). */
export function getRenderedPlayerTurretOrigin(alpha: number, p: Player): Vec2 {
  return getRenderedTurretOrigin(p, alpha);
}

export function getEnemyTurretOrigin(e: ShipPose): Vec2 {
  return turretOriginToWorld(e.x, e.y, e.angle);
}

export function getRenderedEnemyTurretOrigin(e: ShipPose, alpha: number): Vec2 {
  return getRenderedTurretOrigin(e, alpha);
}
