import { random } from "../utils/math.js";
import { spawnHitImpactVisuals } from "./hit-impact.js";
import { destroyAsteroid } from "../utils/mining.js";
import type { Asteroid } from "../types/world.js";
import type { Player } from "../state.js";
import { getState } from "../state-access.js";

export function damageAsteroid(a: Asteroid, dmg: number, px: number, py: number, p: Player = getState().player) {
  if (dmg <= 0) return;
  a.hp -= dmg;
  spawnHitImpactVisuals({
    labelX: a.x,
    labelY: a.y - a.radius * 0.4,
    impactX: px || a.x,
    impactY: py || a.y,
    amount: Math.max(1, Math.round(dmg)),
    layer: "asteroid",
  });
  if (a.hp <= 0) {
    a.depleted = true;
    a.respawnTimer = 60 + random() * 60;
    destroyAsteroid(a, false, 1, p);
  }
}
