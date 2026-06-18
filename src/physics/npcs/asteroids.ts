import { random, resolveElasticCollision } from "../../utils/math.js";
import { getState } from "../../state-access.js";
import { spawnParticles } from "../../utils/fx.js";
import { getEnemyColRadius } from "../../utils/collision-helpers.js";
import { ORE } from "../../data/resources.js";
import { dominantOreKey } from "../../utils/ore-naming.js";
import { getAsteroidColRadius } from "../../utils/asteroid-helpers.js";
import {
  AST_SPIN_RANGE,
  ASTEROID_VEL_DECAY,
  ASTEROID_DENSITY,
  ENEMY_MASS,
  COLLISION_RESTITUTION,
} from "../../constants.js";
import type { Enemy } from "../../types/enemy.js";
import type { Asteroid } from "../../types/asteroid.js";
import { rebuildSpatialGrid, type SpatialQueryResult } from "../../utils/spatial.js";

const _asteroidQuery: SpatialQueryResult<Asteroid>[] = [];

export function updateAsteroids(dt: number, sysIdx: number) {
  const sys = getState().GALAXY[sysIdx];
  if (!sys?.asteroids) return;

  const decay = Math.pow(ASTEROID_VEL_DECAY, dt);
  for (const a of sys.asteroids) {
    // Keep track of spawn coordinates for dynamic respawning
    if (a.spawnX === undefined) {
      a.spawnX = a.x;
      a.spawnY = a.y;
    }

    if (a.depleted) {
      a.respawnTimer -= dt;
      if (a.respawnTimer <= 0) {
        a.depleted = false;
        a.hp = a.maxHp;
        a.vx = 0;
        a.vy = 0;

        // Respawn near original coordinates with slight jitter
        const ang = random() * Math.PI * 2;
        const dist = random() * 80;
        const spawnX = a.spawnX ?? a.x;
        const spawnY = a.spawnY ?? a.y;
        a.x = spawnX + Math.cos(ang) * dist;
        a.y = spawnY + Math.sin(ang) * dist;

        // Mineral dust condensation cloud
        const key = dominantOreKey(a.composition);
        const color = (ORE[key] ?? ORE.iron).color;
        spawnParticles(a.x, a.y, color, 8, 45);
      }
      continue;
    }

    a.prevSpin = a.spinAngle;
    a.spinAngle += a.spinVel * dt;
    if (random() < 0.0005) a.spinVel = (random() - 0.5) * AST_SPIN_RANGE;

    if (a.vx || a.vy) {
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.vx *= decay;
      a.vy *= decay;
      if (Math.abs(a.vx) < 0.5 && Math.abs(a.vy) < 0.5) {
        a.vx = 0;
        a.vy = 0;
      }
    }
  }
}

function resolveEnemyAsteroid(e: Enemy, a: Asteroid, dx: number, dy: number, dist: number, minDist: number) {
  const asteroidMass = a.radius * a.radius * ASTEROID_DENSITY;
  resolveElasticCollision(e, a, ENEMY_MASS, asteroidMass, dx, dy, dist, minDist, COLLISION_RESTITUTION);
}

export function resolveNpcAsteroidCollisions(sysIdx: number) {
  const sys = getState().GALAXY[sysIdx];
  if (!sys) return;
  const enemies = sys._liveEnemies;
  const asteroids = sys._liveAsteroids;
  if (!enemies || !asteroids || !asteroids.length) return;

  const grid = getState().spatialGrid;
  let maxAsteroidRadius = 0;
  for (let i = 0; i < asteroids.length; i++) {
    const ar = getAsteroidColRadius(asteroids[i]);
    if (ar > maxAsteroidRadius) maxAsteroidRadius = ar;
  }

  for (let pass = 0; pass < 3; pass++) {
    // Enemy ↔ asteroid: keep broad-phase active across relaxation passes.
    if (grid) {
      if (pass > 0) rebuildSpatialGrid(sysIdx);
      for (const e of enemies) {
        const enemyRadius = getEnemyColRadius(e.type);
        _asteroidQuery.length = 0;
        grid.query<Asteroid>(e.x, e.y, enemyRadius + maxAsteroidRadius, "asteroid", _asteroidQuery);
        for (const hit of _asteroidQuery) {
          const a = hit.data;
          const dx = a.x - e.x;
          const dy = a.y - e.y;
          const dist = Math.hypot(dx, dy);
          const minDist = enemyRadius + getAsteroidColRadius(a);
          if (dist >= minDist || dist < 0.001) continue;
          resolveEnemyAsteroid(e, a, dx, dy, dist, minDist);
        }
      }
    } else {
      for (const e of enemies) {
        const enemyRadius = getEnemyColRadius(e.type);
        for (const a of asteroids) {
          const dx = a.x - e.x;
          const dy = a.y - e.y;
          const dist = Math.hypot(dx, dy);
          const minDist = enemyRadius + getAsteroidColRadius(a);
          if (dist >= minDist || dist < 0.001) continue;
          resolveEnemyAsteroid(e, a, dx, dy, dist, minDist);
        }
      }
    }

    // Asteroid ↔ asteroid (brute force — typically small N)
    for (let i = 0; i < asteroids.length; i++) {
      const a1 = asteroids[i];
      for (let j = i + 1; j < asteroids.length; j++) {
        const a2 = asteroids[j];
        const dx = a2.x - a1.x;
        const dy = a2.y - a1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = getAsteroidColRadius(a1) + getAsteroidColRadius(a2);
        if (dist >= minDist || dist < 0.001) continue;

        const m1 = a1.radius * a1.radius * ASTEROID_DENSITY;
        const m2 = a2.radius * a2.radius * ASTEROID_DENSITY;
        resolveElasticCollision(a1, a2, m1, m2, dx, dy, dist, minDist, COLLISION_RESTITUTION);
      }
    }
  }
}
