import { G, Client } from "../state.js";
import { floatText, spawnImpactFlash, spawnParticles } from "../utils/fx.js";
import { respawnPlayer } from "../utils/game.js";
import { sfxShieldImpact, sfxHullImpact } from "../audio/procedural.js";
import { MODULE_DAMAGE_CHANCE, MODULE_DAMAGE_RATIO, MODULE_HP_MAX, RACK_TYPES } from "../constants.js";
import { invalidate } from "../player/player-stats.js";
import { MODULES } from "../data/modules.js";
import { logEvent } from "../ui/hud-overlay.js";
import { getInstance } from "../utils/items.js";

export const DMG_COLORS: Record<string, string> = {
  shield: "#44ccff",
  hull: "#ee9944",
  structure: "#ee4444",
  hit: "#ff6666",
  miss: "#ff8833",
  crit: "#ff2200",
  heal: "#66ff88",
};

export function showDamageNumber(x: number, y: number, amount: number | string, type = "hit", direction = "playerToEnemy") {
  let text: string, color: string;
  if (amount === "MISS" || type === "miss") {
    text = "MISS";
    color = DMG_COLORS.miss;
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
  
  // Create color card effect
  floatText(x + jitterX, y + jitterY - 12, text, "#ffffff", color);
}

function damageRandomModule(amount: number) {
  const candidates: { rack: string; idx: number; uid: string }[] = [];
  for (const rack of RACK_TYPES) {
    const slots = G.P.fitting?.[rack];
    if (!slots) continue;
    for (let i = 0; i < slots.length; i++) {
      const uid = slots[i];
      if (!uid) continue;
      const inst = getInstance(uid);
      if (inst && inst.durability > 0 && (G.P.slotActive?.[rack]?.[i] ?? true)) {
        candidates.push({ rack, idx: i, uid });
      }
    }
  }
  if (!candidates.length) return;
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  const inst = getInstance(pick.uid);
  if (!inst) return;
  const dmgAmt = Math.min(inst.durability, Math.max(1, Math.ceil(amount * MODULE_DAMAGE_RATIO)));
  inst.durability -= dmgAmt;
  const m = MODULES[inst.baseId];
  if (inst.durability <= 0) {
    inst.durability = 0;
    G.P.slotActive[pick.rack][pick.idx] = false;
    if (pick.rack === "turret" && G.P.turretPower) {
      G.P.turretPower[pick.idx] = false;
    }
    invalidate();
    const msg = m ? `${m.short || m.name} OFFLINE — critically damaged` : "Module OFFLINE";
    logEvent(msg, "warn");
    floatText(G.P.x, G.P.y - 38, "MODULE OFFLINE", "#ff4444");
  } else {
    floatText(G.P.x, G.P.y - 38, "MODULE HIT", "#ff8844");
  }
}

export function damagePlayer(rawDmg: number, sourceX: number, sourceY: number, opts: { isMiss?: boolean; isCrit?: boolean } = {}) {
  if (opts.isMiss) {
    showDamageNumber(G.P.x, G.P.y - 25, "MISS", "miss", "enemyToPlayer");
    spawnParticles(sourceX, sourceY, DMG_COLORS.miss, 1, 50);
    return;
  }

  let displayType = "shield";
  let overflow = 0;

  if (G.P.shield > 0) {
    G.P.shield -= rawDmg;
    G.P.shieldHitGlow = 1;
    G.P.shieldHitAngle = Math.atan2(sourceY - G.P.y, sourceX - G.P.x);
    Client.combatHeat = Math.min(1, (Client.combatHeat || 0) + 0.35);
    sfxShieldImpact(Math.min(1, rawDmg / 20));
    if (G.P.shield < 0) {
      overflow = -G.P.shield;
      G.P.shield = 0;
    }
  } else {
    overflow = rawDmg;
  }

  if (overflow > 0) {
    if (G.P.hp > 0) {
      G.P.hp -= Math.ceil(overflow);
      displayType = "hull";
      G.P.hullHitGlow = 1;
      G.P.hullHitAngle = Math.atan2(sourceY - G.P.y, sourceX - G.P.x);
      Client.combatHeat = Math.min(1, (Client.combatHeat || 0) + 0.55);
      if (G.P.hp < 0) {
        overflow = -G.P.hp;
        G.P.hp = 0;
      } else {
        overflow = 0;
      }
    } else {
      displayType = "structure";
    }
  }

  if (overflow > 0) {
    G.P.structure -= Math.ceil(overflow);
    displayType = "structure";
    G.P.structureHitGlow = 1;
    G.P.structureHitAngle = Math.atan2(sourceY - G.P.y, sourceX - G.P.x);
    if (G.P.hp <= 0 && Math.random() < MODULE_DAMAGE_CHANCE) {
      damageRandomModule(overflow);
    }
  }

  const displayDmg = opts.isCrit ? `${Math.round(rawDmg)}` : Math.round(rawDmg);
  const displayTypeFinal = opts.isCrit ? "crit" : displayType;
  showDamageNumber(G.P.x, G.P.y - 25, displayDmg, displayTypeFinal, "enemyToPlayer");
  spawnImpactFlash(sourceX, sourceY, DMG_COLORS[displayTypeFinal] || DMG_COLORS.hit);

  if (displayType === "hull" || displayType === "structure") {
    sfxHullImpact(Math.min(1, rawDmg / 15));
  }

  if (G.P.structure <= 0) {
    G.P.structure = 0;
    respawnPlayer();
  }
}
