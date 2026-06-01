import { liveEnemies, curSys } from "../utils/game.js";
import { spawnBeam, spawnBeamImpactSubtle, spawnParticles } from "../utils/fx.js";
import { getState } from "../state-access.js";
import type { WeaponDelivery } from "../data/skills.js";
import type { DamageProfile } from "../data/modules.js";
import type { WeaponProfile } from "../data/weaponProfiles.js";
import type { Player } from "../state.js";
import type { Enemy, Asteroid } from "../types/world.js";
import { damageEnemy } from "./damage-enemy.js";
import { damageAsteroid } from "./damage-asteroid.js";
import { asteroidSegmentPolygonHit } from "../physics/combat-physics.js";

export function fireBeamWeapon(
  ox: number,
  oy: number,
  angle: number,
  wProf: WeaponProfile,
  finalDmg: number,
  delivery: WeaponDelivery,
  p: Player,
  dmgProfile?: DamageProfile | null,
) {
  const dx = Math.cos(angle), dy = Math.sin(angle), range = wProf.range;
  let hitDist = range;
  let hitEnemy: Enemy | null = null;
  for (const e of liveEnemies(p)) {
    const ex = e.x - ox, ey = e.y - oy;
    const proj = ex * dx + ey * dy;
    if (proj < 0 || proj > range) continue;
    const hitR = (e.sigRadius || 30) * 0.6 + 8;
    const perp = Math.abs(ex * dy - ey * dx);
    if (perp < hitR) {
      const surfaceDist = proj - Math.sqrt(Math.max(0, hitR * hitR - perp * perp));
      if (surfaceDist > 0 && surfaceDist < hitDist) {
        hitDist = surfaceDist;
        hitEnemy = e;
      }
    }
  }

  let hitAsteroid: Asteroid | null = null;
  const sys = curSys(p);
  if (sys) {
    const bx = ox + dx * range;
    const by = oy + dy * range;
    for (const ast of sys.asteroids) {
      if (ast.depleted || ast.hp <= 0) continue;
      const hit = asteroidSegmentPolygonHit(ox, oy, bx, by, ast, 0);
      if (hit && hit.t * range <= hitDist) {
        hitDist = hit.t * range;
        hitEnemy = null;
        hitAsteroid = ast;
      }
    }
  }

  const ex2 = ox + dx * hitDist, ey2 = oy + dy * hitDist;
  spawnBeam(ox, oy, ex2, ey2, wProf.color, 3);
  if (hitEnemy) {
    damageEnemy(hitEnemy, finalDmg, ex2, ey2, p, delivery, dmgProfile);
    spawnBeamImpactSubtle(ex2, ey2, wProf.color);
    getState().pendingEffects.push({
      type: "impact",
      payload: { x: ex2, y: ey2, color: wProf.color, delivery: "beam" },
    });
  } else if (hitAsteroid) {
    damageAsteroid(hitAsteroid, finalDmg, ex2, ey2, p);
    spawnBeamImpactSubtle(ex2, ey2, wProf.color);
    getState().pendingEffects.push({
      type: "impact",
      payload: { x: ex2, y: ey2, color: wProf.color, delivery: "beam" },
    });
  } else {
    spawnParticles(ex2, ey2, wProf.trail, 1, 50);
  }
}
