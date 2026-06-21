import type { Player } from "../state.js";
import { PlayerAccess, WorldAccess } from "../state-access.js";
import { RESPAWN_S } from "../constants.js";
import { C } from "../config/index.js";
import { addXp, addSkillXp } from "../player/player-data.js";
import { WEAPON_SKILL, type WeaponDelivery } from "../data/skills.js";
import { floatText, spawnExplosion } from "../utils/fx.js";
import { logEvent } from "../feedback.js";
import { t } from "../utils/i18n.js";
import { progressMissions } from "../data/missions.js";

import { spawnWreck } from "../wreck/index.js";
import { ENEMY_DEFS } from "../data/enemies.js";
import { addSalvagePickup } from "../utils/entities.js";
import { removeVisualState } from "../render/entity-visuals.js";
import { removeAiState } from "../physics/npcs/ai-state.js";
import { removeTaskState } from "../physics/npcs/task-state.js";
import { removeNpcSpeech } from "../render/npc-speech.js";
import type { Enemy } from "../types/enemy.js";

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
  removeVisualState(e.id);
  removeAiState(e.id);
  removeTaskState(e.id);
  removeNpcSpeech(e.id);
  e.respawnTimer = RESPAWN_S;
  const exScale = e.type === "raider" ? C.COMBAT.EXPLOSION_SCALE.raider : e.type === "pirate" ? C.COMBAT.EXPLOSION_SCALE.pirate : C.COMBAT.EXPLOSION_SCALE.default;
  const exTier: "small" | "medium" | "large" = e.type === "raider" ? "large" : e.type === "pirate" ? "medium" : "small";
  spawnExplosion(e.x, e.y, "#ff4422", exScale, exTier);
  WorldAccess.queueEffect({
    type: "explosion",
    payload: {
      x: e.x,
      y: e.y,
      color: "#ff4422",
      scale: exScale,
      tier: exTier,
    },
  });

  const playerParticipated = e.lastPlayerHitAt && (performance.now() - e.lastPlayerHitAt) < C.COMBAT.PLAYER_PARTICIPATION_WINDOW_MS;
  const isTutorialEnemy = TUTORIAL_ENEMY_TYPES.has(e.type);
  const killer: Player | undefined = e.lastHitByPlayer ?? undefined;

  if (playerParticipated && killer) {
    if (isTutorialEnemy) {
      PlayerAccess.setKills(killer.kills + 1, killer);
      logEvent(t("combat.destroyedTargetDummy", { name: e.name }), "combat");
      if (e.type === "target_dummy") dropTargetDummyRewards(e);
      if ((ENEMY_DEFS[e.type]?.wreckChance ?? 0) > 0) spawnWreck(e, killer);
    } else if (e.faction !== "neutral") {
      PlayerAccess.setKills(killer.kills + 1, killer);
      progressMissions("bounty", 1, e.type, killer);
      addXp(C.COMBAT.XP.perKill, killer);
      const kind: WeaponDelivery = (e.lastPlayerHitKind as WeaponDelivery) ?? "projectile";
      const skillId = WEAPON_SKILL[kind];
      addSkillXp(skillId, C.COMBAT.XP.weaponSkillPerKill, killer);
      floatText(e.x, e.y - 35, t("combat.xpGain", { xp: C.COMBAT.XP.perKill }), "#aaddff");
      logEvent(t("combat.destroyed", { name: e.name, xp: C.COMBAT.XP.perKill, credits: e.credits }), "combat");
      spawnWreck(e, killer);
    } else {
      logEvent(t("combat.destroyedAmbient", { name: e.name }), "combat");
      spawnWreck(e, killer);
    }
  } else {
    if (e.faction === "neutral") {
      logEvent(t("combat.ambientDestroyed", { name: e.name }), "combat");
    } else {
      floatText(e.x, e.y - 35, t("combat.turretKill"), "#88aacc");
    }
    spawnWreck(e, killer);
  }
}
