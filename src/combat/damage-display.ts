import { Client, type Player } from "../state.js";
import { PlayerAccess, getState, WorldAccess } from "../state-access.js";
import { floatText, spawnImpactFlash, spawnParticles } from "../utils/fx.js";
import { triggerShieldHit, triggerHullHit, triggerStructureHit } from "../render/entity-visuals.js";
import { respawnPlayer } from "../utils/game.js";
import { MODULE_DAMAGE_CHANCE, MODULE_DAMAGE_RATIO, RACK_TYPES } from "../constants.js";
import { invalidate } from "../player/player-stats.js";
import { MODULES } from "../data/modules.js";
import { logEvent } from "../feedback.js";
import { t } from "../utils/i18n.js";
import { getInstance } from "../utils/items.js";

export const DMG_COLORS: Record<string, string> = {
  shield: "#44ccff",
  hull: "#ee9944",
  structure: "#ee4444",
  hit: "#ff6666",
  miss: "#ff8833",
  crit: "#ff2200",
  heal: "#66ff88",
  asteroid: "#ffaa44",
  mining: "#ffaa44",
};

export function showDamageNumber(x: number, y: number, amount: number | string, type = "hit", direction = "playerToEnemy") {
  let text: string, color: string, textColor = "#ffffff";
  if (amount === "MISS" || type === "miss") {
    text = "0";
    color = "#4488ff";
    textColor = "#000000";
  } else if (type === "crit") {
    text = `-${amount}!`;
    color = DMG_COLORS.crit;
  } else if (type === "heal") {
    text = `+${amount}`;
    color = DMG_COLORS.heal;
  } else {
    text = `-${amount}`;
    color = DMG_COLORS[type] || DMG_COLORS.hit;
  }

  const jitterX = (Math.random() - 0.5) * 18;
  const jitterY = (Math.random() - 0.5) * 8;

  WorldAccess.queueEffect({
    type: "floatText" as const,
    payload: {
      x: x + jitterX,
      y: y + jitterY - 12,
      text,
      color: textColor,
      bgColor: color,
    },
  });
}

function damageRandomModule(amount: number, p: Player) {
  const candidates: { rack: string; idx: number; uid: string }[] = [];
  for (const rack of RACK_TYPES) {
    const slots = p.fitting?.[rack];
    if (!slots) continue;
    for (let i = 0; i < slots.length; i++) {
      const uid = slots[i];
      if (!uid) continue;
      const inst = getInstance(uid, p);
      if (inst && inst.durability > 0 && (p.slotActive?.[rack]?.[i] ?? true)) {
        candidates.push({ rack, idx: i, uid });
      }
    }
  }
  if (!candidates.length) return;
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  const inst = getInstance(pick.uid, p);
  if (!inst) return;
  const dmgAmt = Math.min(inst.durability, Math.max(1, Math.ceil(amount * MODULE_DAMAGE_RATIO)));
  PlayerAccess.setModuleDurability(pick.uid, inst.durability - dmgAmt, p);
  const m = MODULES[inst.baseId];
  if (inst.durability <= 0) {
    PlayerAccess.setModuleDurability(pick.uid, 0, p);
    PlayerAccess.setSlotActive(pick.rack, pick.idx, false, p);
    if (pick.rack === "turret" && p.turretPower) {
      PlayerAccess.setTurretPower(pick.idx, false, p);
    }
    invalidate(p);
    const msg = m ? t("combat.moduleOfflineLog", { name: m.short || m.name }) : t("combat.moduleOffline");
    if (p === getState().player) {
      logEvent(msg, "warn");
      floatText(p.x, p.y - 38, t("combat.moduleOffline"), "#ff4444");
    }
  } else if (p === getState().player) {
    floatText(p.x, p.y - 38, t("combat.moduleHit"), "#ff8844");
  }
}

export function damagePlayer(
  rawDmg: number,
  sourceX: number,
  sourceY: number,
  opts: { isMiss?: boolean; isCrit?: boolean } = {},
  p = getState().player,
) {
  const isLocalPlayer = p === getState().player;
  if (opts.isMiss) {
    if (isLocalPlayer) {
      showDamageNumber(p.x, p.y - 25, "MISS", "miss", "enemyToPlayer");
      spawnParticles(sourceX, sourceY, DMG_COLORS.miss, 1, 50);
    }
    return;
  }

  let displayType = "shield";
  let overflow = 0;

  if (p.shield > 0) {
    PlayerAccess.setShield(p.shield - rawDmg, p);
    triggerShieldHit(p.netId || "__player__", Math.atan2(sourceY - p.y, sourceX - p.x));
    if (isLocalPlayer) {
      PlayerAccess.setCombatHeat(Math.min(1, (Client.combatHeat || 0) + 0.35));
      WorldAccess.queueEffect({
        type: "shieldImpact",
        payload: { vol: Math.min(1, rawDmg / 20) },
      });
    }
    if (p.shield < 0) {
      overflow = -p.shield;
      PlayerAccess.setShield(0, p);
    }
  } else {
    overflow = rawDmg;
  }

  if (overflow > 0) {
    if (p.hp > 0) {
      PlayerAccess.setHp(p.hp - Math.ceil(overflow), p);
      displayType = "hull";
      triggerHullHit(p.netId || "__player__", Math.atan2(sourceY - p.y, sourceX - p.x));
      if (isLocalPlayer) PlayerAccess.setCombatHeat(Math.min(1, (Client.combatHeat || 0) + 0.55));
      if (p.hp < 0) {
        overflow = -p.hp;
        PlayerAccess.setHp(0, p);
      } else {
        overflow = 0;
      }
    } else {
      displayType = "structure";
    }
  }

  if (overflow > 0) {
    PlayerAccess.setStructure(p.structure - Math.ceil(overflow), p);
    displayType = "structure";
    triggerStructureHit(p.netId || "__player__");
    if (p.hp <= 0 && Math.random() < MODULE_DAMAGE_CHANCE) {
      damageRandomModule(overflow, p);
    }
  }

  const displayDmg = opts.isCrit ? `${Math.round(rawDmg)}` : Math.round(rawDmg);
  const displayTypeFinal = opts.isCrit ? "crit" : displayType;
  if (isLocalPlayer) {
    showDamageNumber(p.x, p.y - 25, displayDmg, displayTypeFinal, "enemyToPlayer");
    spawnImpactFlash(sourceX, sourceY, DMG_COLORS[displayTypeFinal] || DMG_COLORS.hit);
  }

  if (isLocalPlayer && (displayType === "hull" || displayType === "structure")) {
    WorldAccess.queueEffect({
      type: "hullImpact",
      payload: { vol: Math.min(1, rawDmg / 15) },
    });
  }

  if (p.structure <= 0) {
    PlayerAccess.setStructure(0, p);
    respawnPlayer(p);
  }
}
