import { random, rayCircleSurfaceHit } from "../../utils/math.js";
import { Client, isGameplayPaused, type Player } from "../../state.js";
import { MiningAccess, PlayerAccess, getState, WorldAccess } from "../../state-access.js";
import { getStats } from "../../player/player-stats.js";
import { spawnImpactFlash, spawnMiningSparks } from "../../utils/fx.js";
import { removeEnemyBullet } from "../../utils/entities.js";
import { nearestPlayerInSys } from "../../utils/game.js";
import { MODULES, MODULE_FLAGS } from "../../data/modules.js";
import {
  forEachFittedModuleSlot,
  getModuleSlotTargetId,
  isModuleSlotPowered,
  type ModuleSlotRef,
} from "../../utils/module-slots.js";
import { SHIPS } from "../../data/ships.js";
import { ENEMY_DEFS } from "../../data/enemies.js";
import { ORE } from "../../data/resources.js";
import { damagePlayer, showDamageNumber } from "../../combat/damage-display.js";
import { getPlayerTurretOrigin } from "../../combat/turret-origin.js";
import { harvestAsteroid, destroyAsteroid } from "../../utils/mining.js";
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
          const playerColRadius = SHIPS[p.shipId]?.colRadius ?? 20;
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
          const playerColRadius = SHIPS[fallback.shipId]?.colRadius ?? 20;
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

          const oeColRadius = ENEMY_DEFS[oe.type]?.colRadius ?? oe.sigRadius ?? 18;
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
      spawnImpactFlash(astHitX, astHitY, b.color || "#ff6644");
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

let _miningHumTimer = 0;
let _miningSparkTimer = 0;

export function updateMining(dt: number, p: Player) {
  const st = getStats(p);
  if (!st.hasMiner) {
    MiningAccess.update({ active: false }, p);
    return;
  }
  if (p === getState().player && (isGameplayPaused() || Client.showMap || Client.bridgeOpen)) {
    MiningAccess.update({ active: false }, p);
    return;
  }

  const sys = getState().GALAXY[p.sysIdx];
  let beamSet = false;

  const processMiner = (ref: ModuleSlotRef, m: typeof MODULES[string]) => {
    if (beamSet) return;
    if (!isModuleSlotPowered(ref.rack, ref.idx, p)) return;

    const assignedId = getModuleSlotTargetId(ref.rack, ref.idx, p);
    if (!assignedId) return;
    const lockSlot = p.lockQueue?.find((s) => s.id === assignedId);
    if (!lockSlot || lockSlot.resolving) return;
    const ast = sys?._asteroidMap?.get(assignedId);
    if (!ast || ast.depleted || ast.hp <= 0) return;

    const origin = getPlayerTurretOrigin(p);
    const dx = ast.x - p.x;
    const dy = ast.y - p.y;
    const dist = Math.hypot(dx, dy);
    const maxRange = m.optimalRange != null ? m.optimalRange : st.mineRange;
    if (dist > maxRange) return;

    const energyCost = 10 * dt;
    if (p.energy < energyCost) return;
    PlayerAccess.setEnergy(p.energy - energyCost, p);

    const surface = rayCircleSurfaceHit(origin.x, origin.y, ast.x, ast.y, ast.radius);
    MiningAccess.update({
      active: true,
      x1: origin.x,
      y1: origin.y,
      x2: surface.x,
      y2: surface.y,
      hitR: ast.radius,
      hitNx: surface.nx,
      hitNy: surface.ny,
      phase: (p.miningLaser?.phase || 0) + dt * 18,
    }, p);
    beamSet = true;

    if (p === getState().player) {
      _miningHumTimer -= dt;
      if (_miningHumTimer <= 0) {
        WorldAccess.queueEffect({
          type: "industrialBeam",
          payload: { delivery: "mining", x: surface.x, y: surface.y },
        });
        _miningHumTimer = 0.5;
      }
      _miningSparkTimer -= dt;
      if (_miningSparkTimer <= 0) {
        _miningSparkTimer = 0.11 + random() * 0.07;
        const sparkColor = p.miningLaser?.oreColor || "#c8a060";
        spawnMiningSparks(surface.x, surface.y, surface.nx, surface.ny, sparkColor, 1.0);
      }
    }

    if (p.mineCd > 0) {
      PlayerAccess.setMineCd(p.mineCd - dt, p);
      return;
    }

    const result = harvestAsteroid(ast, st.miningMult);
    if (result.dmg > 0) {
      showDamageNumber(surface.x, surface.y, Math.round(result.dmg), "mining");
    }
    if (p === getState().player) {
      WorldAccess.queueEffect({
        type: "impact",
        payload: { x: surface.x, y: surface.y, color: "#ff8822", delivery: "mining" },
      });
    }
    PlayerAccess.setMineCd(0.45, p);
    if (result.oreKey) {
      MiningAccess.update({
        oreKey: result.oreKey,
        oreColor: (ORE[result.oreKey] ?? ORE.iron).color,
      }, p);
    }
    if (p === getState().player) {
      const oreColor = p.miningLaser?.oreColor || "#a0a5aa";
      spawnMiningSparks(surface.x, surface.y, surface.nx, surface.ny, oreColor, 1.4);
    }
    if (!result.depleted) return;

    MiningAccess.update({ hitR: 0, active: false }, p);
    ast.respawnTimer = 60 + random() * 60;
    destroyAsteroid(ast, true, st.miningMult, p);
  };

  forEachFittedModuleSlot(MODULE_FLAGS.isMiningTurret, processMiner, p);
  if (!beamSet) {
    MiningAccess.update({ active: false, phase: 0, oreKey: "", oreColor: "" }, p);
  }
}
