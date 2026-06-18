import { getState, PlayerAccess, WorldAccess } from "./state-access.js";
import { t } from "./utils/i18n.js";
import { addXp, addSkillXp } from "./player/player-data.js";
import { WEAPON_SKILL, type WeaponDelivery } from "./data/skills.js";
import { XP_PER_KILL, RESPAWN_S, PLAYER_PARTICIPATION_WINDOW_MS } from "./constants.js";
import { floatText, spawnImpactFlash, spawnExplosion } from "./utils/fx.js";
import { removeSensorLock } from "./targeting.js";
import { logEvent } from "./feedback.js";
import { progressMissions } from "./data/missions.js";
import { showDamageNumber } from "./combat/damage-display.js";
import { spawnWreck } from "./wreck/index.js";
import { C } from "./config/index.js";
import type { Enemy } from "./types/enemy.js";
import type { BulletOwner } from "./utils/entities.js";
import { triggerShieldHit, triggerStructureHit, removeVisualState } from "./render/entity-visuals.js";
import { removeAiState } from "./physics/npcs/ai-state.js";
import { removeTaskState } from "./physics/npcs/task-state.js";
import { removeNpcSpeech } from "./render/npc-speech.js";

export function damageEnemy(e: Enemy, dmg: number, px: number, py: number, owner?: BulletOwner, weaponKind?: WeaponDelivery | string | null) {
  if (dmg <= 0) return;

  let displayType = "hit";
  let overflow = dmg;

  if (e.shield !== undefined && e.shield > 0) {
    displayType = "shield";
    triggerShieldHit(e.id, Math.atan2(py - e.y, px - e.x));
    if (overflow >= e.shield) {
      overflow -= e.shield;
      e.shield = 0;
    } else {
      e.shield -= overflow;
      overflow = 0;
    }
  }

  if (overflow > 0) {
    displayType = "hull";
    if (overflow >= e.hp) {
      overflow -= e.hp;
      e.hp = 0;
    } else {
      e.hp -= overflow;
      overflow = 0;
    }
  }

  // Structure absorbs whatever overflows past hull (only ships with a structure layer)
  if (overflow > 0 && (e.maxStructure ?? 0) > 0) {
    displayType = "structure";
    triggerStructureHit(e.id);
    e.structure = (e.structure ?? 0) - overflow;
    if (e.structure < 0) e.structure = 0;
  }

  if (!owner || owner === getState().player) {
    e.lastPlayerHitAt = performance.now();
    if (weaponKind === "projectile" || weaponKind === "beam" || weaponKind === "missile") {
      e.lastPlayerHitKind = weaponKind;
    }
  }
  
  showDamageNumber(e.x, e.y - 14, dmg, displayType, "playerToEnemy");
  spawnImpactFlash(px || e.x, py || e.y, displayType === "shield" ? "#44ccff" : "#ff4422");
  if (e.hp <= 0 && (e.structure ?? 0) <= 0) killEnemy(e);
}


export function killEnemy(e: Enemy) {
  removeSensorLock(e.id);
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

  const playerParticipated = e.lastPlayerHitAt && (performance.now() - e.lastPlayerHitAt) < PLAYER_PARTICIPATION_WINDOW_MS;
  if (playerParticipated) {
    if (e.faction !== "neutral") {
      PlayerAccess.setKills(getState().player.kills + 1);
      progressMissions("bounty", 1, e.type);
      addXp(XP_PER_KILL);
      const kind: WeaponDelivery = (e.lastPlayerHitKind as WeaponDelivery) ?? "projectile";
      const skillId = WEAPON_SKILL[kind];
      addSkillXp(skillId, 25);
      floatText(e.x, e.y - 35, t("combat.xpGain", { xp: XP_PER_KILL }), "#aaddff");
      logEvent(t("combat.destroyed", { name: e.name, xp: XP_PER_KILL, credits: e.credits }), "combat");
      spawnWreck(e);
    } else {
      logEvent(t("combat.destroyedAmbient", { name: e.name }), "combat");
      spawnWreck(e);
    }
  } else {
    if (e.faction === "neutral") {
      logEvent(t("combat.ambientDestroyed", { name: e.name }), "combat");
    } else {
      floatText(e.x, e.y - 35, t("combat.turretKill"), "#88aacc");
    }
    spawnWreck(e);
  }
}

export { normalizeProfile, applyResists } from "./combat/resists.js";
export { computeHitQuality } from "./combat/hit-quality.js";
export { damageAsteroid } from "./combat/damage-asteroid.js";
