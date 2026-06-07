import { C } from "../config/index.js";
import { ENEMY_DEFS } from "../data/enemies.js";
import { SHIPS } from "../data/ships.js";
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

const PATH_ORIGIN_EPSILON = 0.001;
const FORWARD_ORIGIN_OVERHANG_PX = 3;
const UNDER_HULL_OFFSET_PX = 2;
const NOSE_ORIGIN_BACKSET_PX = 4;
const _shipOriginCache = new Map<string, TurretOriginConfig>();
const _enemyOriginCache = new Map<string, TurretOriginConfig>();

function deriveNoseOriginFromPath(path: number[][] | undefined): TurretOriginConfig | null {
  if (!path || path.length === 0) return null;

  let forwardPx = -Infinity;
  let localDownTotal = 0;
  let matchCount = 0;

  for (const point of path) {
    const [x, y] = point;
    if (x > forwardPx + PATH_ORIGIN_EPSILON) {
      forwardPx = x;
      localDownTotal = y;
      matchCount = 1;
    } else if (Math.abs(x - forwardPx) <= PATH_ORIGIN_EPSILON) {
      localDownTotal += y;
      matchCount++;
    }
  }

  if (!Number.isFinite(forwardPx) || matchCount === 0) return null;
  return {
    forwardPx: forwardPx - NOSE_ORIGIN_BACKSET_PX + FORWARD_ORIGIN_OVERHANG_PX,
    localDownPx: localDownTotal / matchCount + UNDER_HULL_OFFSET_PX,
  };
}

function cachedOrigin(cache: Map<string, TurretOriginConfig>, key: string, path: number[][] | undefined): TurretOriginConfig {
  const cached = cache.get(key);
  if (cached) return cached;

  const derived = deriveNoseOriginFromPath(path) ?? C.COMBAT.TURRET_ORIGIN;
  cache.set(key, derived);
  return derived;
}

export function getShipNoseTurretOrigin(shipId: string | undefined): TurretOriginConfig {
  if (!shipId) return C.COMBAT.TURRET_ORIGIN;
  return cachedOrigin(_shipOriginCache, shipId, SHIPS[shipId]?.render.path);
}

export function getEnemyNoseTurretOrigin(enemyType: string | undefined): TurretOriginConfig {
  if (!enemyType) return C.COMBAT.TURRET_ORIGIN;
  return cachedOrigin(_enemyOriginCache, enemyType, ENEMY_DEFS[enemyType]?.render.path);
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
  return turretOriginToWorld(p.x, p.y, p.angle, getShipNoseTurretOrigin(p.shipId));
}

/** Render-step turret origin (interpolated position + heading). */
export function getRenderedPlayerTurretOrigin(alpha: number, p: Player): Vec2 {
  return getRenderedTurretOrigin(p, alpha, getShipNoseTurretOrigin(p.shipId));
}

export function getEnemyTurretOrigin(e: ShipPose & { type?: string }): Vec2 {
  return turretOriginToWorld(e.x, e.y, e.angle, getEnemyNoseTurretOrigin(e.type));
}

export function getRenderedEnemyTurretOrigin(e: ShipPose & { type?: string }, alpha: number): Vec2 {
  return getRenderedTurretOrigin(e, alpha, getEnemyNoseTurretOrigin(e.type));
}
