/**
 * Unified collision resolution for all entity pairs.
 *
 * Replaces the split between physics/collisions.ts (player-vs-solids) and
 * physics/npcs/asteroids.ts (enemy-vs-asteroid, asteroid-vs-asteroid) with a
 * single system that handles every pair in one pass, using a consistent mass
 * model and rigid-body angular impulse.
 *
 * Entity pairs handled:
 *   player ↔ asteroid, player ↔ enemy, player ↔ wreck piece
 *   enemy ↔ asteroid, asteroid ↔ asteroid
 *
 * Multi-pass relaxation (3 passes) reduces tunneling and stacking jitter.
 * The spatial grid is rebuilt between passes so position corrections are
 * reflected in the broad-phase.
 */
import { getState, PlayerAccess, WorldAccess } from "../state-access.js";
import { curSys, allActivePlayers } from "../utils/game.js";
import { rebuildSpatialGrid, type SpatialQueryResult } from "../utils/spatial.js";
import {
  PLAYER_MASS, ASTEROID_DENSITY,
  COLLISION_RESTITUTION, COLLISION_DMG_THRESHOLD,
  COLLISION_DMG_SCALE, COLLISION_COOLDOWN,
} from "../constants.js";
import { damagePlayer } from "../combat/damage-display.js";
import { getCollisionCooldown, setCollisionCooldown } from "../player/collision-state.js";
import {
  resolveRigidCollision,
  polygonCollisionInfo,
  pointInPolygon,
  closestPointOnPolygon,
} from "../utils/math.js";
import { SHIPS } from "../data/ships.js";
import { ENEMY_DEFS } from "../data/enemies.js";
import {
  getEnemyColRadius,
  getEnemyMass,
  getPlayerColRadius,
  getMomentOfInertia,
} from "../utils/collision-helpers.js";
import { getAsteroidColRadius } from "../utils/asteroid-helpers.js";
import { spawnCollisionFx } from "../utils/fx.js";
import { isPointInAsteroid } from "./combat-physics.js";
import type { Player } from "../state.js";
import type { Enemy } from "../types/enemy.js";
import type { Asteroid } from "../types/asteroid.js";
import type { WreckPiece } from "../types/system.js";

const COLLISION_PASSES = 3;
const COLLISION_FRICTION = 0.15;
const WRECK_DENSITY = 2.0;

// Reusable buffers
const _hits: SpatialQueryResult<unknown>[] = [];
const _worldPolyA: number[][] = [];
const _worldPolyB: number[][] = [];

// ── Polygon helpers ──────────────────────────────────────────────────────────

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

function shipPathToWorld(p: Player, out: number[][]): number[][] {
  const path = SHIPS[p.shipId]?.render.path;
  if (!path) return out;
  transformPolygonToWorld(p.x, p.y, p.angle, path, out);
  return out;
}

function asteroidShapeToWorld(ast: Asteroid, out: number[][]): number[][] {
  const cos = Math.cos(ast.spinAngle || 0);
  const sin = Math.sin(ast.spinAngle || 0);
  const r = ast.radius;
  out.length = ast.shape.length;
  for (let i = 0; i < ast.shape.length; i++) {
    if (!out[i]) out[i] = [0, 0];
    const lx = ast.shape[i][0] * r;
    const ly = ast.shape[i][1] * r;
    out[i][0] = ast.x + lx * cos - ly * sin;
    out[i][1] = ast.y + lx * sin + ly * cos;
  }
  return out;
}

// ── Narrow-phase: overlap detection ──────────────────────────────────────────

function shipOverlapsAsteroid(p: Player, ast: Asteroid): boolean {
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
  // Asteroid center inside ship polygon?
  shipPathToWorld(p, _worldPolyA);
  return pointInPolygon(ast.x, ast.y, _worldPolyA);
}

function shipOverlapsEnemy(p: Player, e: Enemy): boolean {
  const shipPath = SHIPS[p.shipId]?.render.path;
  const enemyPath = ENEMY_DEFS[e.type]?.render.path;
  if (!shipPath || !enemyPath) return true;
  transformPolygonToWorld(p.x, p.y, p.angle, shipPath, _worldPolyA);
  transformPolygonToWorld(e.x, e.y, e.angle, enemyPath, _worldPolyB);
  for (let i = 0; i < _worldPolyA.length; i++) {
    if (pointInPolygon(_worldPolyA[i][0], _worldPolyA[i][1], _worldPolyB)) return true;
  }
  for (let i = 0; i < _worldPolyB.length; i++) {
    if (pointInPolygon(_worldPolyB[i][0], _worldPolyB[i][1], _worldPolyA)) return true;
  }
  return false;
}

function shipOverlapsCircle(p: Player, cx: number, cy: number, radius: number): boolean {
  const path = SHIPS[p.shipId]?.render.path;
  if (!path || path.length < 2) return true;
  const cos = Math.cos(p.angle);
  const sin = Math.sin(p.angle);
  const rSq = radius * radius;
  for (let i = 0; i < path.length; i++) {
    const [vx, vy] = path[i];
    const wx = p.x + vx * cos - vy * sin;
    const wy = p.y + vx * sin + vy * cos;
    const ddx = wx - cx, ddy = wy - cy;
    if (ddx * ddx + ddy * ddy <= rSq) return true;
    const j = (i - 1 + path.length) % path.length;
    const [vx2, vy2] = path[j];
    const wx2 = p.x + vx2 * cos - vy2 * sin;
    const wy2 = p.y + vx2 * sin + vy2 * cos;
    const segDx = wx - wx2, segDy = wy - wy2;
    const lenSq = segDx * segDx + segDy * segDy;
    if (lenSq === 0) continue;
    const t = Math.max(0, Math.min(1, ((cx - wx2) * segDx + (cy - wy2) * segDy) / lenSq));
    const closestX = wx2 + t * segDx;
    const closestY = wy2 + t * segDy;
    const cdx = closestX - cx, cdy = closestY - cy;
    if (cdx * cdx + cdy * cdy <= rSq) return true;
  }
  return false;
}

// ── Contact normal computation ───────────────────────────────────────────────

function asteroidContactNormal(
  p: Player, ast: Asteroid,
  fallbackDx: number, fallbackDy: number, dist: number, broadOverlap: number,
): { nx: number; ny: number; depth: number } {
  const shipPath = SHIPS[p.shipId]?.render.path;
  if (shipPath && shipPath.length >= 3) {
    shipPathToWorld(p, _worldPolyA);
    asteroidShapeToWorld(ast, _worldPolyB);
    const info = polygonCollisionInfo(_worldPolyA, _worldPolyB);
    if (info) return { nx: info.nx, ny: info.ny, depth: info.depth };
  }
  asteroidShapeToWorld(ast, _worldPolyB);
  const cp = closestPointOnPolygon(p.x, p.y, _worldPolyB);
  if (cp.dist > 0.001) {
    const nx = (p.x - cp.x) / cp.dist;
    const ny = (p.y - cp.y) / cp.dist;
    const depth = pointInPolygon(p.x, p.y, _worldPolyB)
      ? cp.dist + getPlayerColRadius(p.shipId)
      : broadOverlap;
    return { nx, ny, depth };
  }
  if (dist > 0.001) return { nx: -fallbackDx / dist, ny: -fallbackDy / dist, depth: broadOverlap };
  return { nx: 1, ny: 0, depth: broadOverlap };
}

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
  if (dist > 0.001) return { nx: -fallbackDx / dist, ny: -fallbackDy / dist, depth: broadOverlap };
  return { nx: 1, ny: 0, depth: broadOverlap };
}

// ── Contact point computation ────────────────────────────────────────────────

/** Midpoint of the overlap region along the normal — used as the contact point
 *  for torque computation. Off-center contacts induce spin.
 *  n points from e2 → e1, so e1's surface toward e2 is at e1 - n*r1,
 *  and e2's surface toward e1 is at e2 + n*r2. */
function contactPoint(
  e1x: number, e1y: number, r1: number,
  e2x: number, e2y: number, r2: number,
  nx: number, ny: number,
): [number, number] {
  const surf1x = e1x - nx * r1;
  const surf1y = e1y - ny * r1;
  const surf2x = e2x + nx * r2;
  const surf2y = e2y + ny * r2;
  return [(surf1x + surf2x) * 0.5, (surf1y + surf2y) * 0.5];
}

// ── Player vs solids ─────────────────────────────────────────────────────────

function resolvePlayerCollisions(p: Player): void {
  const grid = getState().spatialGrid;
  if (!grid) return;
  const playerR = getPlayerColRadius(p.shipId);
  const playerMass = PLAYER_MASS;
  const playerI = getMomentOfInertia(playerMass, playerR);

  _hits.length = 0;
  grid.query(p.x, p.y, playerR, null, _hits);

  for (let i = 0; i < _hits.length; i++) {
    const h = _hits[i];
    if (h.type === "player" || h.type === "station") continue;
    if (h.dist < 0.001) continue;

    const overlap = playerR + h.radius - h.dist;
    if (overlap <= 0) continue;

    if (h.type === "asteroid") {
      const ast = h.data as Asteroid;
      if (!ast) continue;
      if (!shipOverlapsAsteroid(p, ast)) continue;
      const { nx, ny, depth } = asteroidContactNormal(p, ast, h.dx, h.dy, h.dist, overlap);
      const mA = ast.radius * ast.radius * ASTEROID_DENSITY;
      const iA = getMomentOfInertia(mA, ast.radius);
      const [cx, cy] = contactPoint(p.x, p.y, playerR, ast.x, ast.y, h.radius, nx, ny);
      // Sparks on every contact
      const sparkIntensity = Math.max(50, Math.hypot(p.vx || 0, p.vy || 0));
      spawnCollisionFx({ x: cx, y: cy, nx, ny, intensity: sparkIntensity });
      WorldAccess.queueEffect({
        type: "impact",
        payload: { x: cx, y: cy, color: "#ffcc66", delivery: "projectile" },
      });
      const res = resolveRigidCollision(p, ast, playerMass, mA, playerI, iA, nx, ny, depth, COLLISION_RESTITUTION, COLLISION_FRICTION, cx, cy, p.va, ast.spinVel);
      if (res.dav1) PlayerAccess.updatePhysics({ va: p.va + res.dav1 }, p);
      ast.spinVel += res.dav2;

      const id = p.netId ?? p.shipId;
      if (res.closing > COLLISION_DMG_THRESHOLD && getCollisionCooldown(id) <= 0) {
        const dmg = (res.closing - COLLISION_DMG_THRESHOLD) * COLLISION_DMG_SCALE;
        damagePlayer(dmg, cx, cy, {}, p);
        setCollisionCooldown(id, COLLISION_COOLDOWN);
      }

    } else if (h.type === "enemy") {
      const en = h.data as Enemy;
      if (!en) continue;
      if (!shipOverlapsEnemy(p, en)) continue;
      const { nx, ny } = enemyContactNormal(p, en, h.dx, h.dy, h.dist, overlap);
      const enR = getEnemyColRadius(en.type);
      const enMass = getEnemyMass(en.type);
      const enI = getMomentOfInertia(enMass, enR);
      const [cx, cy] = contactPoint(p.x, p.y, playerR, en.x, en.y, enR, nx, ny);
      // Sparks on every contact
      const sparkIntensity = Math.max(50, Math.hypot(p.vx || 0, p.vy || 0));
      spawnCollisionFx({ x: cx, y: cy, nx, ny, intensity: sparkIntensity });
      WorldAccess.queueEffect({
        type: "impact",
        payload: { x: cx, y: cy, color: "#ffcc66", delivery: "projectile" },
      });
      const res = resolveRigidCollision(p, en, playerMass, enMass, playerI, enI, nx, ny, overlap, COLLISION_RESTITUTION, COLLISION_FRICTION, cx, cy, p.va, en.angularVel);
      if (res.dav1) PlayerAccess.updatePhysics({ va: p.va + res.dav1 }, p);
      en.angularVel += res.dav2;
      const id = p.netId ?? p.shipId;
      if (res.closing > COLLISION_DMG_THRESHOLD && getCollisionCooldown(id) <= 0) {
        const dmg = (res.closing - COLLISION_DMG_THRESHOLD) * COLLISION_DMG_SCALE * 0.5;
        damagePlayer(dmg, cx, cy, {}, p);
        setCollisionCooldown(id, COLLISION_COOLDOWN);
      }

    } else if (h.type === "wreckpiece") {
      const piece = h.data as WreckPiece;
      if (!piece || piece.hp <= 0) continue;
      if (!shipOverlapsCircle(p, piece.x, piece.y, piece.radius)) continue;
      // Normal points from wreck → player (e2 → e1)
      const wnx = h.dist > 0.001 ? -h.dx / h.dist : 1;
      const wny = h.dist > 0.001 ? -h.dy / h.dist : 0;
      const pieceMass = piece.radius * piece.radius * WRECK_DENSITY;
      const pieceI = getMomentOfInertia(pieceMass, piece.radius);
      const [cx, cy] = contactPoint(p.x, p.y, playerR, piece.x, piece.y, piece.radius, wnx, wny);
      // Sparks on every contact
      const sparkIntensity = Math.max(50, Math.hypot(p.vx || 0, p.vy || 0));
      spawnCollisionFx({ x: cx, y: cy, nx: wnx, ny: wny, intensity: sparkIntensity });
      WorldAccess.queueEffect({
        type: "impact",
        payload: { x: cx, y: cy, color: "#ffcc66", delivery: "projectile" },
      });
      const res = resolveRigidCollision(p, piece, playerMass, pieceMass, playerI, pieceI, wnx, wny, overlap, COLLISION_RESTITUTION, COLLISION_FRICTION, cx, cy, p.va, piece.angularVel);
      if (res.dav1) PlayerAccess.updatePhysics({ va: p.va + res.dav1 }, p);
      piece.angularVel += res.dav2;

      const id = p.netId ?? p.shipId;
      if (res.closing > COLLISION_DMG_THRESHOLD && getCollisionCooldown(id) <= 0) {
        const dmg = (res.closing - COLLISION_DMG_THRESHOLD) * COLLISION_DMG_SCALE * 0.4;
        damagePlayer(dmg, cx, cy, {}, p);
        setCollisionCooldown(id, COLLISION_COOLDOWN);
      }
    }
  }
}

// ── NPC vs environment ───────────────────────────────────────────────────────

const _astHits: SpatialQueryResult<Asteroid>[] = [];

function resolveNpcCollisions(): void {
  const sys = curSys();
  if (!sys) return;
  const enemies = sys.liveEnemies;
  const asteroids = sys.liveAsteroids;
  if (!enemies || !asteroids) return;
  const grid = getState().spatialGrid;
  if (!grid) return;

  let maxAsteroidRadius = 0;
  for (let i = 0; i < asteroids.length; i++) {
    const ar = getAsteroidColRadius(asteroids[i]);
    if (ar > maxAsteroidRadius) maxAsteroidRadius = ar;
  }

  // Enemy ↔ asteroid
  for (const e of enemies) {
    const enemyR = getEnemyColRadius(e.type);
    const enemyMass = getEnemyMass(e.type);
    const enemyI = getMomentOfInertia(enemyMass, enemyR);
    _astHits.length = 0;
    grid.query<Asteroid>(e.x, e.y, enemyR + maxAsteroidRadius, "asteroid", _astHits);
    for (const hit of _astHits) {
      const a = hit.data;
      if (!a) continue;
      const dx = a.x - e.x;
      const dy = a.y - e.y;
      const dist = Math.hypot(dx, dy);
      const aR = getAsteroidColRadius(a);
      const minDist = enemyR + aR;
      if (dist >= minDist || dist < 0.001) continue;
      const overlap = minDist - dist;
      // Normal points from asteroid → enemy (e2 → e1)
      const nx = -dx / dist;
      const ny = -dy / dist;
      const mA = a.radius * a.radius * ASTEROID_DENSITY;
      const iA = getMomentOfInertia(mA, a.radius);
      const [cx, cy] = contactPoint(e.x, e.y, enemyR, a.x, a.y, aR, nx, ny);
      const npcIntensity = Math.max(50, Math.hypot(e.vx || 0, e.vy || 0));
      spawnCollisionFx({ x: cx, y: cy, nx, ny, intensity: npcIntensity });
      WorldAccess.queueEffect({
        type: "impact",
        payload: { x: cx, y: cy, color: "#ffcc66", delivery: "projectile" },
      });
      const res = resolveRigidCollision(e, a, enemyMass, mA, enemyI, iA, nx, ny, overlap, COLLISION_RESTITUTION, COLLISION_FRICTION, cx, cy, e.angularVel, a.spinVel);
      e.angularVel += res.dav1;
      a.spinVel += res.dav2;
    }
  }

  // Asteroid ↔ asteroid (brute force — typically small N)
  // Uses polygon-based SAT collision for precision, matching the visual shape.
  for (let i = 0; i < asteroids.length; i++) {
    const a1 = asteroids[i];
    const r1 = getAsteroidColRadius(a1);
    const m1 = a1.radius * a1.radius * ASTEROID_DENSITY;
    const i1 = getMomentOfInertia(m1, a1.radius);
    for (let j = i + 1; j < asteroids.length; j++) {
      const a2 = asteroids[j];
      const dx = a2.x - a1.x;
      const dy = a2.y - a1.y;
      const dist = Math.hypot(dx, dy);
      const r2 = getAsteroidColRadius(a2);
      const minDist = r1 + r2;
      // Broad-phase: skip if bounding circles don't overlap
      if (dist >= minDist || dist < 0.001) continue;
      // Narrow-phase: polygon SAT collision
      asteroidShapeToWorld(a1, _worldPolyA);
      asteroidShapeToWorld(a2, _worldPolyB);
      const info = polygonCollisionInfo(_worldPolyA, _worldPolyB);
      if (!info) continue;
      // Normal points from a2 → a1 (e2 → e1), matching polygonCollisionInfo convention
      const nx = info.nx;
      const ny = info.ny;
      const overlap = info.depth;
      const m2 = a2.radius * a2.radius * ASTEROID_DENSITY;
      const i2 = getMomentOfInertia(m2, a2.radius);
      const [cx, cy] = contactPoint(a1.x, a1.y, r1, a2.x, a2.y, r2, nx, ny);
      const relVx = (a2.vx || 0) - (a1.vx || 0);
      const relVy = (a2.vy || 0) - (a1.vy || 0);
      const astIntensity = Math.max(50, Math.hypot(relVx, relVy));
      spawnCollisionFx({ x: cx, y: cy, nx, ny, intensity: astIntensity });
      WorldAccess.queueEffect({
        type: "impact",
        payload: { x: cx, y: cy, color: "#ffcc66", delivery: "projectile" },
      });
      const res = resolveRigidCollision(a1, a2, m1, m2, i1, i2, nx, ny, overlap, COLLISION_RESTITUTION, COLLISION_FRICTION, cx, cy, a1.spinVel, a2.spinVel);
      a1.spinVel += res.dav1;
      a2.spinVel += res.dav2;
    }
  }
}

// ── Public entry point ───────────────────────────────────────────────────────

export function resolveAllCollisions(): void {
  const grid = getState().spatialGrid;
  if (!grid) return;

  for (let pass = 0; pass < COLLISION_PASSES; pass++) {
    if (pass > 0) rebuildSpatialGrid();

    for (const p of allActivePlayers()) {
      resolvePlayerCollisions(p);
    }

    resolveNpcCollisions();
  }
}
