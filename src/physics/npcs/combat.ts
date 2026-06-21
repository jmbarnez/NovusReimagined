import { random } from "../../utils/math.js";
import { Client, type Player } from "../../state.js";
import { PlayerAccess, getState, WorldAccess } from "../../state-access.js";
import { getStats } from "../../player/player-stats.js";
import { spawnCollisionFx } from "../../utils/fx.js";
import { removeEnemyBullet } from "../../utils/entities.js";
import { nearestPlayerInSys } from "../../utils/game.js";
import { getPlayerColRadius, getEnemyColRadius } from "../../utils/collision-helpers.js";
import { damagePlayer, showDamageNumber } from "../../combat/damage-display.js";
import { C } from "../../config/index.js";
import type { Enemy } from "../../types/enemy.js";
import type { Asteroid } from "../../types/asteroid.js";
import { type SpatialQueryResult } from "../../utils/spatial.js";
import { asteroidSegmentPolygonHit } from "../combat-physics.js";
import { isHostile } from "../../combat/factions.js";
import { damageEnemy } from "../../combat.js";

const _enemyHits: SpatialQueryResult<Enemy>[] = [];
const _asteroidHits: SpatialQueryResult<Asteroid>[] = [];

function getSegmentCircleHitT(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  cx: number,
  cy: number,
  hitDist: number,
): number | null {
  if (Math.hypot(cx - x1, cy - y1) < hitDist) return 1;
  const pdx = x1 - x0;
  const pdy = y1 - y0;
  const segLenSq = pdx * pdx + pdy * pdy;
  if (segLenSq <= 0) return null;
  const t = Math.max(0, Math.min(1, ((cx - x0) * pdx + (cy - y0) * pdy) / segLenSq));
  const closestX = x0 + t * pdx;
  const closestY = y0 + t * pdy;
  return Math.hypot(cx - closestX, cy - closestY) < hitDist ? t : null;
}

export function updateEnemyBullets(dt: number, sysIdx: number) {
  const grid = getState().spatialGrid;
  for (let i = getState().enemyBullets.length - 1; i >= 0; i--) {
    const b = getState().enemyBullets[i];
    b.px = b.x;
    b.py = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.age = (b.age ?? 0) + 1;
    if (b.age <= 1) {
      continue;
    }
    b.life -= dt;

    const moveDist = Math.max(0, Math.hypot(b.x - b.px, b.y - b.py));

    // Player hit check: closest-approach segment parameters (if hostile to player)
    let playerHit = false;
    let playerHitT = 1;
    let hitPlayer: Player | null = null;
    if (isHostile(b.ownerFaction, "player")) {
      if (grid) {
        const bRad = b.sz || 2;
        const queryRange = bRad + moveDist + 20; // max player colRadius is ~20
        const playerHits: SpatialQueryResult<Player>[] = [];
        grid.query<Player>(b.x, b.y, queryRange, "player", playerHits);
        for (const h of playerHits) {
          const p = h.data;
          if (!p) continue;
          const playerColRadius = getPlayerColRadius(p.shipId);
          const hitDist = playerColRadius + C.ENEMIES.AI.HIT_CHECK_RADIUS;
          const t = getSegmentCircleHitT(b.px, b.py, b.x, b.y, p.x, p.y, hitDist);
          if (t == null) continue;
          playerHit = true;
          hitPlayer = p;
          playerHitT = t;
          break;
        }
      } else {
        const fallback = nearestPlayerInSys(sysIdx, b.x, b.y);
        if (fallback) {
          const playerColRadius = getPlayerColRadius(fallback.shipId);
          const hitDist = playerColRadius + C.ENEMIES.AI.HIT_CHECK_RADIUS;
          const t = getSegmentCircleHitT(b.px, b.py, b.x, b.y, fallback.x, fallback.y, hitDist);
          if (t != null) {
            playerHit = true;
            hitPlayer = fallback;
            playerHitT = t;
          }
        }
      }
    }

    // NPC hit: CCD raycast along path segment querying enemies
    let npcHit = false;
    let npcHitT = Infinity;
    let npcHitX = b.x;
    let npcHitY = b.y;
    let hitNpc: Enemy | null = null;
    if (grid) {
      const bRad = b.sz || 2;
      _enemyHits.length = 0;
      grid.query<Enemy>(b.x, b.y, bRad + moveDist, "enemy", _enemyHits);
      if (_enemyHits.length) {
        const steps = Math.ceil(moveDist / 5);
        for (let idx = 0; idx < _enemyHits.length; idx++) {
          const oe = _enemyHits[idx].data;
          if (!oe || !oe.alive || oe.id === b.ownerId) continue;
          if (!isHostile(b.ownerFaction, oe.faction)) continue;

          const oeColRadius = getEnemyColRadius(oe.type);
          const oeHitDist = oeColRadius + C.ENEMIES.AI.HIT_CHECK_RADIUS;
          for (let s = 0; s <= steps; s++) {
            const t = steps === 0 ? 1 : s / steps;
            const tx = b.px + (b.x - b.px) * t;
            const ty = b.py + (b.y - b.py) * t;
            if (Math.hypot(oe.x - tx, oe.y - ty) >= oeHitDist) continue;
            if (t < npcHitT) {
              npcHitT = t;
              npcHitX = tx;
              npcHitY = ty;
              npcHit = true;
              hitNpc = oe;
            }
            break;
          }
        }
      }
    }

    // Asteroid hit check: CCD raycast
    let astHit = false;
    let astHitT = Infinity;
    let astHitX = b.x;
    let astHitY = b.y;
    if (grid) {
      const bRad = b.sz || 2;
      _asteroidHits.length = 0;
      grid.query<Asteroid>(b.x, b.y, bRad + moveDist, "asteroid", _asteroidHits);
      if (_asteroidHits.length) {
        for (let idx = 0; idx < _asteroidHits.length; idx++) {
          const ast = _asteroidHits[idx].data;
          if (!ast || ast.depleted || ast.hp <= 0) continue;
          const hit = asteroidSegmentPolygonHit(b.px, b.py, b.x, b.y, ast, bRad);
          if (!hit || hit.t >= astHitT) continue;
          astHitT = hit.t;
          astHitX = hit.x;
          astHitY = hit.y;
          astHit = true;
        }
      }
    }

    // Earliest collision wins
    const earliestT = Math.min(
      playerHit ? playerHitT : Infinity,
      astHit ? astHitT : Infinity,
      npcHit ? npcHitT : Infinity,
    );

    if (earliestT === Infinity) {
      if (b.life <= 0) removeEnemyBullet(i);
      continue;
    }

    if (astHit && astHitT === earliestT) {
      spawnCollisionFx({ x: astHitX, y: astHitY, nx: 0, ny: 0, intensity: 55, material: "rock", tint: b.color || "#ff6644" });
      WorldAccess.queueEffect({
        type: "impact",
        payload: { x: astHitX, y: astHitY, color: b.color || "#ff6644", delivery: b.kind || "projectile" },
      });
      removeEnemyBullet(i);
      continue;
    }

    if (playerHit && playerHitT === earliestT && hitPlayer) {
      const variance = 0.5 + random() * 0.7;
      const finalDmg = Math.max(1, Math.floor((b.dmg || (2 + random() * 2)) * variance));
      damagePlayer(finalDmg, b.x, b.y, {}, hitPlayer);
      WorldAccess.queueEffect({
        type: "impact",
        payload: { x: b.x, y: b.y, color: b.color || "#ff6644", delivery: b.kind || "projectile" },
      });
      removeEnemyBullet(i);
      continue;
    }

    if (npcHit && npcHitT === earliestT && hitNpc) {
      const variance = 0.5 + random() * 0.7;
      const finalDmg = Math.max(1, Math.floor((b.dmg || (2 + random() * 2)) * variance));
      damageEnemy(hitNpc, finalDmg, npcHitX, npcHitY, undefined, b.kind || "projectile");
      WorldAccess.queueEffect({
        type: "impact",
        payload: { x: npcHitX, y: npcHitY, color: b.color || "#ff6644", delivery: b.kind || "projectile" },
      });
      removeEnemyBullet(i);
      continue;
    }

    if (b.life <= 0) removeEnemyBullet(i);
  }
}
