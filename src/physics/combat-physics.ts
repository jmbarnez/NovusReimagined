
import { PlayerAccess, getState, WorldAccess } from "../state-access.js";
import { getStats } from "../player/player-stats.js";
import { showDamageNumber } from "../combat/damage-display.js";
import { damageEnemy, damageAsteroid } from "../combat.js";
import { updateSensorLocks } from "../targeting.js";
import { spawnImpactFlash } from "../utils/fx.js";
import { floatText } from "../utils/fx.js";
import { removeBullet, updateBeams, updateParticles, updateShockwaves, updateFloatTexts, isTargetDestroyed } from "../utils/entities.js";
import { MODULES, MODULE_FLAGS } from "../data/modules.js";
import type { SpatialQueryResult } from "../utils/spatial.js";
import type { Enemy, Asteroid } from "../types/world.js";
import type { Player } from "../state.js";

export function updateCombat(dt: number, p: Player = getState().player, opts?: { lockPredictionOnly?: boolean }) {
  const st = getStats(p);
  if (p.shootCd > 0) PlayerAccess.setShootCd(p.shootCd - dt, p);
  if (p.targetLock) {
    const tl = p.targetLock;
    const lost = !tl || isTargetDestroyed(tl) || Math.hypot(p.x - tl.x, p.y - tl.y) > 3500;
    if (lost) PlayerAccess.setTargetLock(null, p);
  }
  updateSensorLocks(dt, st, p);
  void opts;
}

const _bHits: SpatialQueryResult<Enemy | Asteroid>[] = [];

export function isPointInAsteroid(bx: number, by: number, ast: Asteroid, bSz: number): boolean {
  const dx = bx - ast.x;
  const dy = by - ast.y;
  
  // Quick bounds check
  const distSq = dx * dx + dy * dy;
  const maxR = ast.radius + bSz;
  if (distSq > maxR * maxR) return false;

  const cos = Math.cos(ast.spinAngle || 0);
  const sin = Math.sin(ast.spinAngle || 0);
  const lx = dx * cos + dy * sin;
  const ly = -dx * sin + dy * cos;

  let inside = false;
  const shape = ast.shape;
  if (!shape) return distSq <= maxR * maxR;

  const r = ast.radius;
  for (let i = 0, j = shape.length - 1; i < shape.length; j = i++) {
    const xi = shape[i][0] * r, yi = shape[i][1] * r;
    const xj = shape[j][0] * r, yj = shape[j][1] * r;
    const intersect = ((yi > ly) !== (yj > ly)) && (lx < (xj - xi) * (ly - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function asteroidSegmentPolygonHit(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  ast: Asteroid,
  bSz = 0,
): { t: number; x: number; y: number } | null {
  const moveDist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(moveDist / 5));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    if (isPointInAsteroid(x, y, ast, bSz)) return { t, x, y };
  }
  return null;
}

export function updateProjectiles(dt: number) {
  const grid = getState().spatialGrid;

  for (let i = getState().bullets.length - 1; i >= 0; i--) {
    const b = getState().bullets[i];
    b.px = b.x;
    b.py = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.age = (b.age ?? 0) + 1;
    if (b.age <= 1) {
      continue;
    }
    b.life -= dt;

    if (grid) {
      const bRad = b.sz || 2;
      const moveDist = Math.max(0, Math.hypot(b.x - b.px, b.y - b.py));

      // --- Candidate enemy hit (point check at current position) ---
      let enemyTarget: SpatialQueryResult<Enemy> | null = null;
      let enemyHitDist = Infinity; // distance from b.px along the path
      _bHits.length = 0;
      grid.query<Enemy>(b.x, b.y, bRad + 5, "enemy", _bHits as SpatialQueryResult<Enemy>[]);
      if (_bHits.length) {
        let minDist = Infinity;
        for (let idx = 0; idx < _bHits.length; idx++) {
          const h = _bHits[idx] as SpatialQueryResult<Enemy>;
          if (h.data && h.data.alive && h.data !== b.owner) {
            if (h.dist < minDist) {
              minDist = h.dist;
              enemyTarget = h;
            }
          }
        }
        // Enemy collision is a point test at the end of this step's movement.
        if (enemyTarget) enemyHitDist = moveDist;
      }

      // --- Candidate asteroid hit (CCD raycast along the path) ---
      let astTarget: SpatialQueryResult<Asteroid> | null = null;
      let astHitDist = Infinity; // distance from b.px along the path
      let hitX = b.x, hitY = b.y;
      _bHits.length = 0;
      grid.query<Asteroid>(b.x, b.y, bRad + moveDist, "asteroid", _bHits as SpatialQueryResult<Asteroid>[]);
      if (_bHits.length) {
        const steps = Math.ceil(moveDist / 5);
        for (let idx = 0; idx < _bHits.length; idx++) {
          const h = _bHits[idx] as SpatialQueryResult<Asteroid>;
          const ast = h.data;
          if (!ast || ast.depleted || ast.hp <= 0) continue;

          for (let s = 0; s <= steps; s++) {
            const t = steps === 0 ? 1 : s / steps;
            const tx = b.px + (b.x - b.px) * t;
            const ty = b.py + (b.y - b.py) * t;
            if (isPointInAsteroid(tx, ty, ast, bRad)) {
              const pathDist = moveDist * t;
              if (pathDist < astHitDist) {
                astHitDist = pathDist;
                astTarget = h;
                hitX = tx; hitY = ty;
              }
              break;
            }
          }
        }
      }

      // --- Resolve whichever hit comes first along the path ---
      if (astTarget && astTarget.data && astHitDist <= enemyHitDist) {
        const isMining = b.owner === getState().player && b.weaponId && MODULE_FLAGS.isMiningTurret(MODULES[b.weaponId]);
        if (isMining) {
          damageAsteroid(astTarget.data, b.dmg, hitX, hitY);
        }
        WorldAccess.queueEffect({
          type: "impact",
          payload: {
            x: hitX,
            y: hitY,
            color: b.color || "#ff4422",
            delivery: isMining ? "mining" : (b.weaponId || b.kind || "projectile"),
          },
        });
        spawnImpactFlash(hitX, hitY, b.color || "#ff4422");
        b.life = 0;
      } else if (enemyTarget && enemyTarget.data) {
        spawnImpactFlash(b.x, b.y, b.color || "#ff4422");
        if (b.owner === getState().player) {
          WorldAccess.queueEffect({
            type: "impact",
            payload: {
              x: b.x,
              y: b.y,
              color: b.color || "#ff4422",
              delivery: b.weaponId || b.kind || "projectile",
            },
          });
        }
        damageEnemy(enemyTarget.data, b.dmg, b.x, b.y, b.owner, b.kind);
        b.life = 0;
      }
    }

    if (b.life <= 0) removeBullet(i);
  }

  updateBeams(dt);
  updateParticles(dt);
  updateShockwaves(dt);
  updateFloatTexts(dt);
}
