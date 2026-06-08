import type { Player } from "../state.js";
import { PlayerAccess } from "../state-access.js";
import { RESPAWN_S } from "../constants.js";
import { C } from "../config/index.js";
import { addXp, addSkillXp } from "../player/player-data.js";
import { WEAPON_SKILL, type WeaponDelivery } from "../data/skills.js";
import { floatText, spawnExplosion } from "../utils/fx.js";
import { removeSensorLock } from "../targeting.js";
import { logEvent } from "../feedback.js";
import { progressMissions } from "../data/missions.js";
import { getState } from "../state-access.js";
import { spawnWreck } from "../wreck/index.js";
import { ENEMY_DEFS } from "../data/enemies.js";
import { addSalvagePickup } from "../utils/entities.js";
import type { Enemy } from "../types/world.js";

const TUTORIAL_ENEMY_TYPES = new Set(["target_dummy", "training_drone"]);

function dropTargetDummyRewards(e: Enemy): void {
  addSalvagePickup({
    x: e.x,
    y: e.y,
    vx: (e.vx || 0) + 18,
    vy: (e.vy || 0) - 10,
    life: 20,
    bob: 0,
    kind: "credits",
    payload: "credits",
    qty: 1,
  });
  addSalvagePickup({
    x: e.x,
    y: e.y,
    vx: (e.vx || 0) - 18,
    vy: (e.vy || 0) + 10,
    life: 20,
    bob: Math.PI,
    kind: "ore",
    payload: "iron",
    qty: 1,
  });
}

export function killEnemy(e: Enemy) {
  e.alive = false;
  e.respawnTimer = RESPAWN_S;
  const exScale = e.type === "raider" ? C.COMBAT.EXPLOSION_SCALE.raider : e.type === "pirate" ? C.COMBAT.EXPLOSION_SCALE.pirate : C.COMBAT.EXPLOSION_SCALE.default;
  const exTier: "small" | "medium" | "large" = e.type === "raider" ? "large" : e.type === "pirate" ? "medium" : "small";
  spawnExplosion(e.x, e.y, "#ff4422", exScale, exTier);
  getState().pendingEffects.push({
    type: "explosion",
    payload: {
      x: e.x,
      y: e.y,
      color: "#ff4422",
      scale: exScale,
      tier: exTier,
    },
  });

  const playerParticipated = e._lastPlayerHitAt && (performance.now() - e._lastPlayerHitAt) < C.COMBAT.PLAYER_PARTICIPATION_WINDOW_MS;
  const isTutorialEnemy = TUTORIAL_ENEMY_TYPES.has(e.type);
  const killer: Player | undefined = e._lastHitByPlayer ?? undefined;

  if (playerParticipated && killer) {
    removeSensorLock(e.id, killer);
    if (isTutorialEnemy) {
      PlayerAccess.setKills(killer.kills + 1, killer);
      logEvent(`Destroyed ${e.name}`, "combat");
      if (e.type === "target_dummy") dropTargetDummyRewards(e);
      if ((ENEMY_DEFS[e.type]?.wreckChance ?? 0) > 0) spawnWreck(e, killer);
    } else if (e.faction !== "neutral") {
      PlayerAccess.setKills(killer.kills + 1, killer);
      progressMissions("bounty", 1, e.type, killer);
      addXp(C.COMBAT.XP.perKill, killer);
      const kind: WeaponDelivery = (e._lastPlayerHitKind as WeaponDelivery) ?? "projectile";
      const skillId = WEAPON_SKILL[kind];
      addSkillXp(skillId, C.COMBAT.XP.weaponSkillPerKill, killer);
      floatText(e.x, e.y - 35, `+${C.COMBAT.XP.perKill} XP`, "#aaddff");
      logEvent(`Destroyed ${e.name} — +${C.COMBAT.XP.perKill} XP · ~${e.credits} CR loot`, "combat");
      spawnWreck(e, killer);
    } else {
      logEvent(`Destroyed ambient ship: ${e.name}`, "combat");
      spawnWreck(e, killer);
    }
  } else {
    if (e.faction === "neutral") {
      logEvent(`Ambient ship destroyed: ${e.name}`, "combat");
    } else {
      floatText(e.x, e.y - 35, "Turret Kill", "#88aacc");
    }
    spawnWreck(e, killer);
  }
}
