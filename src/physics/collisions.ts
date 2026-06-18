/**
 * Player-vs-solid collision resolution (asteroids, enemies, wreck pieces).
 */
import type { Player } from "../state.js";
import type { Asteroid } from "../types/asteroid.js";
import type { Enemy } from "../types/enemy.js";
import type { WreckPiece } from "../types/system.js";
import type { SpatialQueryResult } from "../utils/spatial.js";
import { PlayerAccess, getState } from "../state-access.js";
import {
  PLAYER_MASS, ENEMY_MASS,
  COLLISION_RESTITUTION, COLLISION_DMG_THRESHOLD,
  COLLISION_DMG_SCALE, COLLISION_COOLDOWN,
} from "../constants.js";
import { damagePlayer } from "../combat/damage-display.js";
import { getCollisionCooldown, setCollisionCooldown } from "../player/collision-state.js";
import { resolveElasticCollision, resolveCollisionVsImmovable, polygonCollisionInfo, pointInPolygon, closestPointOnPolygon } from "../utils/math.js";
import { SHIPS } from "../data/ships.js";
import { ENEMY_DEFS } from "../data/enemies.js";
import { getEnemyColRadius, getPlayerColRadius } from "../utils/collision-helpers.js";
import { spawnCollisionSparks } from "../utils/fx.js";
import { isPointInAsteroid } from "./combat-physics.js";


const _colHits: SpatialQueryResult<unknown>[] = [];

const _worldPolyA: number[][] = [];
const _worldPolyB: number[][] = [];

function transformPolygonToWorld(
  cx: number, cy: number, angle: number,
  path: number[][], out: number[][],
): void {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  out.length = path.length;
  for (let i = 0; i < path.length; i++) {
    const [vx, vy] = path[i];
    if (!out[i]) out[i] = [0, 0];
    out[i][0] = cx + vx * cos - vy * sin;
    out[i][1] = cy + vx * sin + vy * cos;
  }
}

/** Check if any vertex of the ship's rotated hull lies inside the asteroid polygon. */
function shipPolygonVsAsteroid(p: Player, ast: Asteroid): boolean {
  const path = SHIPS[p.shipId]?.render.path;
  if (!path || path.length < 2) return true;
  const cos = Math.cos(p.angle);
  const sin = Math.sin(p.angle);
  for (let i = 0; i < path.length; i++) {
    const [vx, vy] = path[i];
    const wx = p.x + vx * cos - vy * sin;
    const wy = p.y + vx * sin + vy * cos;
    if (isPointInAsteroid(wx, wy, ast, 0)) return true;
  }
  return false;
}

/** Check if the asteroid center is inside the ship's rotated hull polygon. */
function asteroidCenterInShipPolygon(p: Player, ast: Asteroid): boolean {
  const path = SHIPS[p.shipId]?.render.path;
  if (!path || path.length < 2) return true;
  const cos = Math.cos(p.angle);
  const sin = Math.sin(p.angle);
  const px = ast.x;
  const py = ast.y;
  return pointInPolygon(px, py, transformShipPath(p, path));
}

function transformShipPath(p: Player, path: number[][]): number[][] {
  const cos = Math.cos(p.angle);
  const sin = Math.sin(p.angle);
  _worldPolyA.length = path.length;
  for (let i = 0; i < path.length; i++) {
    const [vx, vy] = path[i];
    if (!_worldPolyA[i]) _worldPolyA[i] = [0, 0];
    _worldPolyA[i][0] = p.x + vx * cos - vy * sin;
    _worldPolyA[i][1] = p.y + vx * sin + vy * cos;
  }
  return _worldPolyA;
}

/** Returns true if the ship hull overlaps the asteroid polygon. */
function shipCollidesWithAsteroid(p: Player, ast: Asteroid): boolean {
  return shipPolygonVsAsteroid(p, ast) || asteroidCenterInShipPolygon(p, ast);
}

/** Build the asteroid's world-space polygon (for normal estimation only). */
function asteroidWorldPolygon(ast: Asteroid): number[][] {
  const cos = Math.cos(ast.spinAngle || 0);
  const sin = Math.sin(ast.spinAngle || 0);
  const r = ast.radius;
  _worldPolyB.length = ast.shape.length;
  for (let i = 0; i < ast.shape.length; i++) {
    if (!_worldPolyB[i]) _worldPolyB[i] = [0, 0];
    const lx = ast.shape[i][0] * r;
    const ly = ast.shape[i][1] * r;
    _worldPolyB[i][0] = ast.x + lx * cos - ly * sin;
    _worldPolyB[i][1] = ast.y + lx * sin + ly * cos;
  }
  return _worldPolyB;
}

/** Compute a stable push-out normal (asteroid → ship) and penetration depth.
 *  Tries SAT first (shallow convex overlaps), then falls back to
 *  closest-point-on-asteroid-edge which is stable for deep/concave penetrations. */
function asteroidContactNormal(
  p: Player, ast: Asteroid,
  fallbackDx: number, fallbackDy: number, dist: number, broadOverlap: number,
): { nx: number; ny: number; depth: number } {
  const shipPath = SHIPS[p.shipId]?.render.path;

  // Try SAT for a proper contact normal (works for shallow convex overlaps)
  if (shipPath && shipPath.length >= 3) {
    transformShipPath(p, shipPath);
    asteroidWorldPolygon(ast);
    const info = polygonCollisionInfo(_worldPolyA, _worldPolyB);
    if (info) return { nx: info.nx, ny: info.ny, depth: info.depth };
  }

  // Fallback: find closest point on asteroid polygon to ship center.
  // Direction from closest point → ship center is the push-out direction.
  asteroidWorldPolygon(ast);
  const cp = closestPointOnPolygon(p.x, p.y, _worldPolyB);
  let nx: number, ny: number, depth: number;

  if (cp.dist > 0.001) {
    nx = (p.x - cp.x) / cp.dist;
    ny = (p.y - cp.y) / cp.dist;
    // If ship center is outside the asteroid, penetration = broad overlap.
    // If inside, penetration = distance to nearest edge + ship radius.
    if (pointInPolygon(p.x, p.y, _worldPolyB)) {
      depth = cp.dist + getPlayerColRadius(p.shipId);
    } else {
      depth = broadOverlap;
    }
  } else {
    // Ship center is exactly on an edge — use center-to-center
    if (dist > 0.001) {
      nx = fallbackDx / dist;
      ny = fallbackDy / dist;
    } else {
      nx = 1; ny = 0;
    }
    depth = broadOverlap;
  }

  return { nx, ny, depth };
}

/** Narrow-phase: ship polygon vs circle (wreck pieces). */
function shipPolygonCollidesWithCircle(p: Player, cx: number, cy: number, radius: number): boolean {
  const path = SHIPS[p.shipId]?.render.path;
  if (!path || path.length < 2) return true;
  const cos = Math.cos(p.angle);
  const sin = Math.sin(p.angle);
  const rSq = radius * radius;

  for (let i = 0; i < path.length; i++) {
    const [vx, vy] = path[i];
    const wx = p.x + vx * cos - vy * sin;
    const wy = p.y + vx * sin + vy * cos;

    const ddx = wx - cx;
    const ddy = wy - cy;
    if (ddx * ddx + ddy * ddy <= rSq) return true;

    const j = (i - 1 + path.length) % path.length;
    const [vx2, vy2] = path[j];
    const wx2 = p.x + vx2 * cos - vy2 * sin;
    const wy2 = p.y + vx2 * sin + vy2 * cos;

    const segDx = wx - wx2;
    const segDy = wy - wy2;
    const lenSq = segDx * segDx + segDy * segDy;
    if (lenSq === 0) continue;

    const t = Math.max(0, Math.min(1, ((cx - wx2) * segDx + (cy - wy2) * segDy) / lenSq));
    const closestX = wx2 + t * segDx;
    const closestY = wy2 + t * segDy;

    const cdx = closestX - cx;
    const cdy = closestY - cy;
    if (cdx * cdx + cdy * cdy <= rSq) return true;
  }
  return false;
}

/** Returns true if the ship hull overlaps the enemy polygon. */
function shipCollidesWithEnemy(p: Player, e: Enemy): boolean {
  const shipPath = SHIPS[p.shipId]?.render.path;
  const enemyPath = ENEMY_DEFS[e.type]?.render.path;
  if (!shipPath || !enemyPath) return true;
  transformPolygonToWorld(p.x, p.y, p.angle, shipPath, _worldPolyA);
  transformPolygonToWorld(e.x, e.y, e.angle, enemyPath, _worldPolyB);
  // Vertex-in-polygon check (works for concave shapes)
  for (let i = 0; i < _worldPolyA.length; i++) {
    if (pointInPolygon(_worldPolyA[i][0], _worldPolyA[i][1], _worldPolyB)) return true;
  }
  for (let i = 0; i < _worldPolyB.length; i++) {
    if (pointInPolygon(_worldPolyB[i][0], _worldPolyB[i][1], _worldPolyA)) return true;
  }
  return false;
}

/** Compute a stable push-out normal (enemy → ship) and penetration depth. */
function enemyContactNormal(
  p: Player, e: Enemy,
  fallbackDx: number, fallbackDy: number, dist: number, broadOverlap: number,
): { nx: number; ny: number; depth: number } {
  const shipPath = SHIPS[p.shipId]?.render.path;
  const enemyPath = ENEMY_DEFS[e.type]?.render.path;

  if (shipPath && enemyPath && shipPath.length >= 3 && enemyPath.length >= 3) {
    transformPolygonToWorld(p.x, p.y, p.angle, shipPath, _worldPolyA);
    transformPolygonToWorld(e.x, e.y, e.angle, enemyPath, _worldPolyB);
    const info = polygonCollisionInfo(_worldPolyA, _worldPolyB);
    if (info) return { nx: info.nx, ny: info.ny, depth: info.depth };
  }

  // Fallback: closest point on enemy polygon to ship center
  if (enemyPath && enemyPath.length >= 3) {
    transformPolygonToWorld(e.x, e.y, e.angle, enemyPath, _worldPolyB);
    const cp = closestPointOnPolygon(p.x, p.y, _worldPolyB);
    if (cp.dist > 0.001) {
      const nx = (p.x - cp.x) / cp.dist;
      const ny = (p.y - cp.y) / cp.dist;
      const depth = pointInPolygon(p.x, p.y, _worldPolyB)
        ? cp.dist + getPlayerColRadius(p.shipId)
        : broadOverlap;
      return { nx, ny, depth };
    }
  }

  if (dist > 0.001) return { nx: fallbackDx / dist, ny: fallbackDy / dist, depth: broadOverlap };
  return { nx: 1, ny: 0, depth: broadOverlap };
}

export function resolveSolidCollisions(p: Player) {
  const grid = getState().spatialGrid;
  if (!grid) return;
  const playerR = getPlayerColRadius(p.shipId);

  _colHits.length = 0;
  grid.query(p.x, p.y, playerR, null, _colHits);

  for (let i = 0; i < _colHits.length; i++) {
    const h = _colHits[i];
    if (h.type === "player" || h.type === "station") continue;
    if (h.dist < 0.001) continue;

    const overlap = playerR + h.radius - h.dist;
    if (overlap <= 0) continue;

    if (h.type === "asteroid") {
      const ast = h.data as Asteroid;
      if (!ast) continue;
      if (!shipCollidesWithAsteroid(p, ast)) continue;
      const { nx, ny, depth } = asteroidContactNormal(p, ast, h.dx, h.dy, h.dist, overlap);
      // Asteroids are effectively immovable — push player fully out + buffer in one frame
      const closing = resolveCollisionVsImmovable(p, nx, ny, depth, COLLISION_RESTITUTION);

      // Procedural sparks at the contact point
      if (closing > 30) {
        const contactX = p.x - nx * (playerR * 0.5);
        const contactY = p.y - ny * (playerR * 0.5);
        spawnCollisionSparks(contactX, contactY, nx, ny, closing, "#ffcc66");
      }

      const id = p.netId ?? p.shipId;
      if (closing > COLLISION_DMG_THRESHOLD && getCollisionCooldown(id) <= 0) {
        const dmg = (closing - COLLISION_DMG_THRESHOLD) * COLLISION_DMG_SCALE;
        const contactX = p.x - nx * (playerR * 0.5);
        const contactY = p.y - ny * (playerR * 0.5);
        damagePlayer(dmg, contactX, contactY, {}, p);
        setCollisionCooldown(id, COLLISION_COOLDOWN);
      }

    } else if (h.type === "enemy") {
      const en = h.data as Enemy;
      if (!en) continue;
      if (!shipCollidesWithEnemy(p, en)) continue;
      const { nx, ny } = enemyContactNormal(p, en, h.dx, h.dy, h.dist, overlap);
      const enR = getEnemyColRadius(en.type);
      const closing = resolveElasticCollision(p, en, PLAYER_MASS, ENEMY_MASS, h.dx, h.dy, h.dist, playerR + enR, COLLISION_RESTITUTION, nx, ny);

      // Procedural sparks at the contact point
      if (closing > 30) {
        const contactX = p.x - nx * (playerR * 0.5);
        const contactY = p.y - ny * (playerR * 0.5);
        spawnCollisionSparks(contactX, contactY, nx, ny, closing, "#ff8844");
      }

      const id = p.netId ?? p.shipId;
      if (closing > COLLISION_DMG_THRESHOLD && getCollisionCooldown(id) <= 0) {
        const dmg = (closing - COLLISION_DMG_THRESHOLD) * COLLISION_DMG_SCALE * 0.5;
        const contactX = p.x - nx * (playerR * 0.5);
        const contactY = p.y - ny * (playerR * 0.5);
        damagePlayer(dmg, contactX, contactY, {}, p);
        setCollisionCooldown(id, COLLISION_COOLDOWN);
      }

    } else if (h.type === "wreckpiece") {
      const piece = h.data as WreckPiece;
      if (!piece || piece.hp <= 0) continue;
      if (!shipPolygonCollidesWithCircle(p, piece.x, piece.y, piece.radius)) continue;
      // Wreck pieces are heavy debris — push player fully out
      const wnx = h.dist > 0.001 ? h.dx / h.dist : 1;
      const wny = h.dist > 0.001 ? h.dy / h.dist : 0;
      const closing = resolveCollisionVsImmovable(p, wnx, wny, overlap, COLLISION_RESTITUTION);

      // Procedural sparks at the contact point
      if (closing > 30) {
        const contactX = p.x - wnx * (playerR * 0.5);
        const contactY = p.y - wny * (playerR * 0.5);
        spawnCollisionSparks(contactX, contactY, wnx, wny, closing, "#aa88ff");
      }

      const id = p.netId ?? p.shipId;
      if (closing > COLLISION_DMG_THRESHOLD && getCollisionCooldown(id) <= 0) {
        const dmg = (closing - COLLISION_DMG_THRESHOLD) * COLLISION_DMG_SCALE * 0.4;
        damagePlayer(dmg, piece.x, piece.y, {}, p);
        setCollisionCooldown(id, COLLISION_COOLDOWN);
      }
    }
  }
}
