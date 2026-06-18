import { SHIPS } from "../data/ships.js";
import { ENEMY_DEFS } from "../data/enemies.js";

const _shipRadiusCache = new Map<string, number>();
const _enemyRadiusCache = new Map<string, number>();

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
