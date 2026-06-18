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
  PLAYER_MASS, ASTEROID_DENSITY, ENEMY_MASS,
  COLLISION_RESTITUTION, COLLISION_DMG_THRESHOLD,
  COLLISION_DMG_SCALE, COLLISION_COOLDOWN,
} from "../constants.js";
import { damagePlayer } from "../combat/damage-display.js";
import { getCollisionCooldown, setCollisionCooldown } from "../player/collision-state.js";
import { resolveElasticCollision, polygonCollisionInfo } from "../utils/math.js";
import { SHIPS } from "../data/ships.js";
import { ENEMY_DEFS } from "../data/enemies.js";
import { getEnemyColRadius, getPlayerColRadius } from "../utils/collision-helpers.js";


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

/** Narrow-phase: precise ship polygon vs asteroid polygon. Returns collision normal (asteroid → ship) and depth. */
function shipAsteroidCollisionInfo(p: Player, ast: Asteroid): { nx: number; ny: number; depth: number } | null {
  const shipPath = SHIPS[p.shipId]?.render.path;
  if (!shipPath || shipPath.length < 2) return null;
  transformPolygonToWorld(p.x, p.y, p.angle, shipPath, _worldPolyA);
  _worldPolyB.length = ast.shape.length;
  for (let i = 0; i < ast.shape.length; i++) {
    if (!_worldPolyB[i]) _worldPolyB[i] = [0, 0];
    _worldPolyB[i][0] = ast.x + ast.shape[i][0];
    _worldPolyB[i][1] = ast.y + ast.shape[i][1];
  }
  return polygonCollisionInfo(_worldPolyA, _worldPolyB);
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

/** Narrow-phase: precise ship polygon vs enemy polygon. Returns collision normal (enemy → ship) and depth. */
function shipEnemyCollisionInfo(p: Player, e: Enemy): { nx: number; ny: number; depth: number } | null {
  const shipPath = SHIPS[p.shipId]?.render.path;
  const enemyPath = ENEMY_DEFS[e.type]?.render.path;
  if (!shipPath || !enemyPath) return null;
  transformPolygonToWorld(p.x, p.y, p.angle, shipPath, _worldPolyA);
  transformPolygonToWorld(e.x, e.y, e.angle, enemyPath, _worldPolyB);
  return polygonCollisionInfo(_worldPolyA, _worldPolyB);
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
      const info = shipAsteroidCollisionInfo(p, ast);
      if (!info) continue;
      const mA = ast.radius * ast.radius * ASTEROID_DENSITY;
      const closing = resolveElasticCollision(p, ast, PLAYER_MASS, mA, h.dx, h.dy, h.dist, playerR + h.radius, COLLISION_RESTITUTION, info.nx, info.ny);

      const id = p.netId ?? p.shipId;
      if (closing > COLLISION_DMG_THRESHOLD && getCollisionCooldown(id) <= 0) {
        const dmg = (closing - COLLISION_DMG_THRESHOLD) * COLLISION_DMG_SCALE;
        const contactX = p.x - info.nx * (playerR * 0.5);
        const contactY = p.y - info.ny * (playerR * 0.5);
        damagePlayer(dmg, contactX, contactY, {}, p);
        setCollisionCooldown(id, COLLISION_COOLDOWN);
      }

    } else if (h.type === "enemy") {
      const en = h.data as Enemy;
      if (!en) continue;
      const info = shipEnemyCollisionInfo(p, en);
      if (!info) continue;
      const enR = getEnemyColRadius(en.type);
      const closing = resolveElasticCollision(p, en, PLAYER_MASS, ENEMY_MASS, h.dx, h.dy, h.dist, playerR + enR, COLLISION_RESTITUTION, info.nx, info.ny);

      const id = p.netId ?? p.shipId;
      if (closing > COLLISION_DMG_THRESHOLD && getCollisionCooldown(id) <= 0) {
        const dmg = (closing - COLLISION_DMG_THRESHOLD) * COLLISION_DMG_SCALE * 0.5;
        const contactX = p.x - info.nx * (playerR * 0.5);
        const contactY = p.y - info.ny * (playerR * 0.5);
        damagePlayer(dmg, contactX, contactY, {}, p);
        setCollisionCooldown(id, COLLISION_COOLDOWN);
      }

    } else if (h.type === "wreckpiece") {
      const piece = h.data as WreckPiece;
      if (!piece || piece.hp <= 0) continue;
      if (!shipPolygonCollidesWithCircle(p, piece.x, piece.y, piece.radius)) continue;
      const pieceMass = piece.radius * piece.radius * 0.8;
      const closing = resolveElasticCollision(p, piece, PLAYER_MASS, pieceMass, h.dx, h.dy, h.dist, playerR + piece.radius, COLLISION_RESTITUTION);

      const id = p.netId ?? p.shipId;
      if (closing > COLLISION_DMG_THRESHOLD && getCollisionCooldown(id) <= 0) {
        const dmg = (closing - COLLISION_DMG_THRESHOLD) * COLLISION_DMG_SCALE * 0.4;
        damagePlayer(dmg, piece.x, piece.y, {}, p);
        setCollisionCooldown(id, COLLISION_COOLDOWN);
      }
    }
  }
}
