import { G } from "../state.js";
import { getStats } from "../player/player-stats.js";
import { showDamageNumber } from "../combat/damage-display.js";
import { damageEnemy, damageAsteroid } from "../combat.js";
import { updateSensorLocks } from "../targeting.js";
import { spawnImpactFlash } from "../utils/fx.js";
import { floatText } from "../utils/fx.js";
import { removeBullet, updateBeams, updateParticles, updateShockwaves, updateFloatTexts, isTargetDestroyed } from "../utils/entities.js";
import { MODULES, MODULE_FLAGS } from "../data/modules.js";
import { sfxProjectileImpact, sfxBeamImpact } from "../audio/procedural.js";
import type { SpatialQueryResult } from "../utils/spatial.js";
import type { Enemy, Asteroid } from "../types/world.js";

export function updateCombat(dt: number) {
  const st = getStats();
  if (G.P.shootCd > 0) G.P.shootCd -= dt;
  if (G.P.targetLock) {
    const tl = G.P.targetLock;
    const lost = isTargetDestroyed(tl) || Math.hypot(G.P.x - tl.x, G.P.y - tl.y) > 3500;
    if (lost) G.P.targetLock = null;
  }
  updateSensorLocks(dt, st);
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

export function updateProjectiles(dt: number) {
  const grid = G.spatialGrid;

  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i]; b.px = b.x; b.py = b.y; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;

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
        const isMining = b.owner === G.P && b.weaponId && MODULE_FLAGS.isMiningTurret(MODULES[b.weaponId]);
        if (isMining) {
          damageAsteroid(astTarget.data, b.dmg, hitX, hitY);
          sfxBeamImpact("mining", hitX, hitY);
        } else {
          sfxProjectileImpact(hitX, hitY, b.weaponId || b.kind || "projectile");
        }
        spawnImpactFlash(hitX, hitY, b.color || "#ff4422");
        b.life = 0;
      } else if (enemyTarget && enemyTarget.data) {
        spawnImpactFlash(b.x, b.y, b.color || "#ff4422");
        if (b.owner === G.P) sfxProjectileImpact(b.x, b.y, b.weaponId || b.kind || "projectile");
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
