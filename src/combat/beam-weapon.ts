import { liveEnemies } from "../utils/game.js";
import { spawnBeam, spawnBeamImpactSubtle, spawnParticles } from "../utils/fx.js";
import { sfxProjectileImpact } from "../audio/procedural.js";
import type { WeaponDelivery } from "../data/skills.js";
import type { DamageProfile } from "../data/modules.js";
import type { WeaponProfile } from "../data/weaponProfiles.js";
import type { Player } from "../state.js";
import type { Enemy } from "../types/world.js";
import { damageEnemy } from "./damage-enemy.js";

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
  const ex2 = ox + dx * hitDist, ey2 = oy + dy * hitDist;
  spawnBeam(ox, oy, ex2, ey2, wProf.color, 3);
  if (hitEnemy) {
    damageEnemy(hitEnemy, finalDmg, ex2, ey2, p, delivery, dmgProfile);
    spawnBeamImpactSubtle(ex2, ey2, wProf.color);
    sfxProjectileImpact(ex2, ey2, "beam");
  } else {
    spawnParticles(ex2, ey2, wProf.trail, 1, 50);
  }
}
