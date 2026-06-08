import { type Player } from "../../state.js";
import { PlayerAccess, getState } from "../../state-access.js";
import { MODULES } from "../../data/modules.js";
import { ORE_MARKET_BUY, COMPONENT_MARKET_BUY } from "../../data/marketCatalog.js";
import { getStats, invalidate } from "../../player/player-stats.js";
import { MODULE_HP_MAX } from "../../constants.js";
import { ModuleRarity, RARITY_CONFIG } from "../../data/moduleRarity.js";
import { generateModuleInstance } from "../../loot/generateModule.js";
import { getInstance, invalidateInstanceCache } from "../../utils/items.js";
import { ensureAmmoDefaults } from "../../player/player-data.js";

export interface ActionResponse {
  success: boolean;
  reason?: string;
  creditsSpent?: number;
  creditsEarned?: number;
  label?: string;
}

export function repairShipAction(p: Player = getState().player): ActionResponse {
  const st = getStats(p);
  const hullRep = Math.max(0, st.maxHp - p.hp);
  const structRep = Math.max(0, st.maxStructure - p.structure);
  const shieldRep = Math.max(0, st.maxShield - p.shield);
  let moduleDamageTotal = 0;

  for (const rack of ["turret", "high", "med", "low"] as const) {
    const slots = p.fitting?.[rack];
    if (!slots) continue;
    for (let i = 0; i < slots.length; i++) {
      const uid = slots[i];
      if (uid) {
        const inst = getInstance(uid, p);
        if (inst) {
          moduleDamageTotal += Math.max(0, inst.maxDurability - inst.durability);
        }
      }
    }
  }

  const cost = Math.max(0, Math.ceil((hullRep + structRep * 0.5 + shieldRep * 0.3 + moduleDamageTotal * 0.6) * 0.8));
  if (p.credits < cost) {
    return { success: false, reason: "Insufficient credits" };
  }

  PlayerAccess.modifyCredits(-cost, p);
  PlayerAccess.setHp(st.maxHp, p);
  PlayerAccess.setStructure(st.maxStructure, p);
  PlayerAccess.setShield(st.maxShield, p);

  for (const inst of p.moduleCargo) {
    inst.durability = inst.maxDurability;
  }

  for (const rack of ["turret", "high", "med", "low"] as const) {
    const slots = p.fitting?.[rack];
    if (!slots) continue;
    for (let i = 0; i < slots.length; i++) {
      const uid = slots[i];
      if (uid) {
        const inst = getInstance(uid, p);
        if (inst) inst.durability = inst.maxDurability;
      }
    }
  }

  invalidate(p);
  return { success: true, creditsSpent: cost };
}

export function buyModuleAction(moduleId: string, p: Player = getState().player): ActionResponse {
  const m = MODULES[moduleId];
  if (!m) {
    return { success: false, reason: "Module not found" };
  }
  if (p.credits < m.price) {
    return { success: false, reason: "Insufficient credits" };
  }

  PlayerAccess.modifyCredits(-m.price, p);
  const inst = generateModuleInstance(moduleId, p.level, 0);
  inst.rarity = ModuleRarity.Stock;
  inst.affixes = [];
  PlayerAccess.addModuleCargo(inst, p);
  invalidateInstanceCache();

  return { success: true, creditsSpent: m.price };
}

export function sellModuleAction(moduleId: string, p: Player = getState().player): ActionResponse {
  const m = MODULES[moduleId];
  if (!m) {
    return { success: false, reason: "Module not found" };
  }

  const fittedIds = new Set<string>();
  for (const r of ["turret", "high", "med", "low"] as const) {
    for (const uid of p.fitting[r]) {
      if (uid) fittedIds.add(uid);
    }
  }

  const instIdx = p.moduleCargo.findIndex(inst => inst.baseId === moduleId && !fittedIds.has(inst.uid));
  if (instIdx === -1) {
    return { success: false, reason: "No matching unfitted module found in cargo" };
  }

  const inst = p.moduleCargo[instIdx];
  const rarityMult = RARITY_CONFIG[inst.rarity].sellMult;
  const sellPrice = Math.floor(m.price * 0.6 * rarityMult);

  PlayerAccess.removeModuleCargo(instIdx, p);
  PlayerAccess.modifyCredits(sellPrice, p);
  invalidateInstanceCache();
  invalidate(p);

  return { success: true, creditsEarned: sellPrice };
}

export function buyAmmunitionAction(type: "hybrid" | "missile", p: Player = getState().player): ActionResponse {
  ensureAmmoDefaults(p);
  if (type === "hybrid") {
    if (p.credits < 40) return { success: false, reason: "Insufficient credits" };
    PlayerAccess.modifyCredits(-40, p);
    PlayerAccess.setAmmo("hybrid", (p.ammo.hybrid || 0) + 500, p);
    return { success: true, creditsSpent: 40 };
  } else {
    if (p.credits < 95) return { success: false, reason: "Insufficient credits" };
    PlayerAccess.modifyCredits(-95, p);
    PlayerAccess.setAmmo("missile", (p.ammo.missile || 0) + 24, p);
    return { success: true, creditsSpent: 95 };
  }
}

export function sellCargoResourceAction(
  category: "ore" | "loot" | "components",
  key: string,
  p: Player = getState().player,
): ActionResponse {
  if (category === "ore") {
    const qty = p.ore[key] || 0;
    if (qty <= 0) return { success: false, reason: "No ore to sell" };
    const price = ORE_MARKET_BUY[key] || 0;
    const earnings = qty * price;
    PlayerAccess.modifyCredits(earnings, p);
    PlayerAccess.setOre(key, 0, p);
    return { success: true, creditsEarned: earnings };
  } else if (category === "loot") {
    const qty = p.loot[key] || 0;
    if (qty <= 0) return { success: false, reason: "No salvage to sell" };
    const lootBuy: Record<string, number> = { scrap: 5, chip: 45, cell: 22, "intact-part": 30 };
    const earnings = qty * (lootBuy[key] || 0);
    PlayerAccess.modifyCredits(earnings, p);
    PlayerAccess.setLoot(key, 0, p);
    return { success: true, creditsEarned: earnings };
  } else {
    const qty = p.components[key] || 0;
    if (qty <= 0) return { success: false, reason: "No components to sell" };
    const earnings = qty * (COMPONENT_MARKET_BUY[key] || 100);
    PlayerAccess.modifyCredits(earnings, p);
    PlayerAccess.setComponents(key, 0, p);
    return { success: true, creditsEarned: earnings };
  }
}

export function setHomeSystemAction(p: Player = getState().player): ActionResponse {
  PlayerAccess.setHomeSysIdx(p.sysIdx, p);
  return { success: true };
}
