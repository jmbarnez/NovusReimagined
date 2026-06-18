import { C } from "../config/index.js";
import { WEAPON_PROFILES } from "../data/weaponProfiles.js";
import type { Enemy } from "../types/enemy.js";

export function enemyClassLabel(type: string): string {
  return ({ rat: "MITE", rat_drone: "MITE", drone: "DSENT", pirate: "HAC", raider: "BLITZ" } as Record<string, string>)[type] || "UNK";
}

export function computeEnemyLevel(enemy: Enemy): number {
  const hpScore = Math.min(1, (enemy.maxHp - C.TARGETING.ENEMY_LEVEL.hpScoreMin) / C.TARGETING.ENEMY_LEVEL.hpScoreRange);

  let maxDmg = 0;
  if (enemy.fitting?.turret) {
    for (const uid of enemy.fitting.turret) {
      if (!uid) continue;
      const inst = enemy.fitting.tempInstances?.find(inst => inst.uid === uid);
      const baseId = inst ? inst.baseId : uid;
      const wProf = WEAPON_PROFILES[baseId];
      if (wProf && wProf.dmg > maxDmg) maxDmg = wProf.dmg;
    }
  }
  const dmgScore = Math.min(1, (maxDmg - C.TARGETING.ENEMY_LEVEL.dmgScoreMin) / C.TARGETING.ENEMY_LEVEL.dmgScoreRange);

  const accScore   = Math.min(1, ((enemy.accuracy ?? 1.0) - C.TARGETING.ENEMY_LEVEL.accScoreMin) / C.TARGETING.ENEMY_LEVEL.accScoreRange);
  const aggroScore = Math.min(1, (enemy.aggroRange - C.TARGETING.ENEMY_LEVEL.aggroScoreMin) / C.TARGETING.ENEMY_LEVEL.aggroScoreRange);
  const spdScore   = Math.min(1, (enemy.speed ?? 0) / C.TARGETING.ENEMY_LEVEL.spdScoreMax);
  const raw = hpScore * C.TARGETING.ENEMY_LEVEL.hpWeight + dmgScore * C.TARGETING.ENEMY_LEVEL.dmgWeight + accScore * C.TARGETING.ENEMY_LEVEL.accWeight + aggroScore * C.TARGETING.ENEMY_LEVEL.aggroWeight + spdScore * C.TARGETING.ENEMY_LEVEL.spdWeight;
  return Math.max(C.TARGETING.ENEMY_LEVEL.levelMin, Math.min(C.TARGETING.ENEMY_LEVEL.levelMax, Math.round(raw * C.TARGETING.ENEMY_LEVEL.levelScale) + C.TARGETING.ENEMY_LEVEL.levelOffset));
}
