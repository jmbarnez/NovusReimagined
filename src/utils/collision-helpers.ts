import { SHIPS } from "../data/ships.js";
import { ENEMY_DEFS } from "../data/enemies.js";

const _shipRadiusCache = new Map<string, number>();
const _enemyRadiusCache = new Map<string, number>();
const _enemyMassCache = new Map<string, number>();

/** Density constant for mass derivation: mass = colRadius² × density. */
const ENEMY_DENSITY = 1.2;

function computePathMaxRadius(path: number[][] | undefined): number {
  if (!path || path.length === 0) return 0;
  let maxSq = 0;
  for (const [x, y] of path) {
    const d = x * x + y * y;
    if (d > maxSq) maxSq = d;
  }
  return Math.sqrt(maxSq);
}

/** Physical collision radius derived from the ship's actual hull path. */
export function getPlayerColRadius(shipId: string): number {
  let r = _shipRadiusCache.get(shipId);
  if (r === undefined) {
    const path = SHIPS[shipId]?.render.path;
    r = Math.ceil(computePathMaxRadius(path));
    _shipRadiusCache.set(shipId, r);
  }
  return r;
}

/** Physical collision radius derived from the enemy's actual hull path. */
export function getEnemyColRadius(type: string): number {
  let r = _enemyRadiusCache.get(type);
  if (r === undefined) {
    const path = ENEMY_DEFS[type]?.render.path;
    r = Math.ceil(computePathMaxRadius(path));
    _enemyRadiusCache.set(type, r);
  }
  return r;
}

/** Mass derived from collision radius: mass = colRadius² × density.
 *  Larger ships are heavier and harder to knock around. */
export function getEnemyMass(type: string): number {
  let m = _enemyMassCache.get(type);
  if (m === undefined) {
    const r = getEnemyColRadius(type);
    m = r * r * ENEMY_DENSITY;
    _enemyMassCache.set(type, m);
  }
  return m;
}

/** Moment of inertia for a disc approximation: I = ½ * m * r².
 *  Used for angular impulse from off-center collisions. */
export function getMomentOfInertia(mass: number, radius: number): number {
  return 0.5 * mass * radius * radius;
}
