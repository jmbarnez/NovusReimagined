import { G, Client } from "../state.js";
import { PlayerAccess } from "../state-access.js";
import { MODULES } from "../data/modules.js";
import { ORE_MARKET_BUY, COMPONENT_MARKET_BUY } from "../data/marketCatalog.js";
import { getStats, invalidate } from "../player/player-stats.js";
import { syncSlotHeat } from "../player/player-fitting.js";
import { ensureAmmoDefaults } from "../player/player-data.js";
import { MODULE_HP_MAX } from "../constants.js";
import { emit } from "../events.js";
import { getRecipe, createCraftJob, type IndustryPool } from "../data/industryRecipes.js";
import { ModuleRarity, RARITY_CONFIG } from "../data/moduleRarity.js";
import { generateModuleInstance } from "../loot/generateModule.js";
import { getInstance, invalidateInstanceCache } from "../utils/items.js";
import type { MissionContract } from "../data/missions.js";

export interface ActionResponse {
  success: boolean;
  reason?: string;
  creditsSpent?: number;
  creditsEarned?: number;
  label?: string;
}

export function repairShipAction(): ActionResponse {
  const st = getStats();
  const hullRep = Math.max(0, st.maxHp - G.P.hp);
  const structRep = Math.max(0, st.maxStructure - G.P.structure);
  const shieldRep = Math.max(0, st.maxShield - G.P.shield);
  let moduleDamageTotal = 0;

  for (const rack of ["turret", "high", "med", "low"] as const) {
    const slots = G.P.fitting?.[rack];
    if (!slots) continue;
    for (let i = 0; i < slots.length; i++) {
      const uid = slots[i];
      if (uid) {
        const inst = getInstance(uid);
        if (inst) {
          moduleDamageTotal += Math.max(0, inst.maxDurability - inst.durability);
        }
      }
    }
  }

  const cost = Math.max(0, Math.ceil((hullRep + structRep * 0.5 + shieldRep * 0.3 + moduleDamageTotal * 0.6) * 0.8));
  if (G.P.credits < cost) {
    return { success: false, reason: "Insufficient credits" };
  }

  PlayerAccess.modifyCredits(-cost);
  PlayerAccess.setHp(st.maxHp);
  PlayerAccess.setStructure(st.maxStructure);
  PlayerAccess.setShield(st.maxShield);

  for (const inst of G.P.moduleCargo) {
    inst.durability = inst.maxDurability;
  }

  for (const rack of ["turret", "high", "med", "low"] as const) {
    const slots = G.P.fitting?.[rack];
    if (!slots) continue;
    for (let i = 0; i < slots.length; i++) {
      const uid = slots[i];
      if (uid) {
        const inst = getInstance(uid);
        if (inst) inst.durability = inst.maxDurability;
      }
    }
  }

  invalidate();
  return { success: true, creditsSpent: cost };
}

export function buyModuleAction(moduleId: string): ActionResponse {
  const m = MODULES[moduleId];
  if (!m) {
    return { success: false, reason: "Module not found" };
  }
  if (G.P.credits < m.price) {
    return { success: false, reason: "Insufficient credits" };
  }

  PlayerAccess.modifyCredits(-m.price);
  const inst = generateModuleInstance(moduleId, G.P.level, 0);
  inst.rarity = ModuleRarity.Stock;
  inst.affixes = [];
  PlayerAccess.addModuleCargo(inst);
  invalidateInstanceCache();

  return { success: true, creditsSpent: m.price };
}

export function sellModuleAction(moduleId: string): ActionResponse {
  const m = MODULES[moduleId];
  if (!m) {
    return { success: false, reason: "Module not found" };
  }

  const fittedIds = new Set<string>();
  for (const r of ["turret", "high", "med", "low"] as const) {
    for (const uid of G.P.fitting[r]) {
      if (uid) fittedIds.add(uid);
    }
  }

  const instIdx = G.P.moduleCargo.findIndex(inst => inst.baseId === moduleId && !fittedIds.has(inst.uid));
  if (instIdx === -1) {
    return { success: false, reason: "No matching unfitted module found in cargo" };
  }

  const inst = G.P.moduleCargo[instIdx];
  const rarityMult = RARITY_CONFIG[inst.rarity].sellMult;
  const sellPrice = Math.floor(m.price * 0.6 * rarityMult);

  PlayerAccess.removeModuleCargo(instIdx);
  PlayerAccess.modifyCredits(sellPrice);
  invalidateInstanceCache();
  invalidate();

  return { success: true, creditsEarned: sellPrice };
}

export function buyAmmunitionAction(type: "hybrid" | "missile"): ActionResponse {
  ensureAmmoDefaults();
  if (type === "hybrid") {
    if (G.P.credits < 40) return { success: false, reason: "Insufficient credits" };
    PlayerAccess.modifyCredits(-40);
    PlayerAccess.setAmmo("hybrid", (G.P.ammo.hybrid || 0) + 500);
    return { success: true, creditsSpent: 40 };
  } else {
    if (G.P.credits < 95) return { success: false, reason: "Insufficient credits" };
    PlayerAccess.modifyCredits(-95);
    PlayerAccess.setAmmo("missile", (G.P.ammo.missile || 0) + 24);
    return { success: true, creditsSpent: 95 };
  }
}

export function sellCargoResourceAction(
  category: "ore" | "refined" | "loot" | "components",
  key: string
): ActionResponse {
  if (category === "ore") {
    const qty = G.P.ore[key] || 0;
    if (qty <= 0) return { success: false, reason: "No ore to sell" };
    const price = ORE_MARKET_BUY[key] || 0;
    const earnings = qty * price;
    PlayerAccess.modifyCredits(earnings);
    PlayerAccess.setOre(key, 0);
    return { success: true, creditsEarned: earnings };
  } else if (category === "loot") {
    const qty = G.P.loot[key] || 0;
    if (qty <= 0) return { success: false, reason: "No salvage to sell" };
    const lootBuy: Record<string, number> = { scrap: 5, chip: 45, cell: 22, "intact-part": 30 };
    const earnings = qty * (lootBuy[key] || 0);
    PlayerAccess.modifyCredits(earnings);
    PlayerAccess.setLoot(key, 0);
    return { success: true, creditsEarned: earnings };
  } else {
    const qty = G.P.components[key] || 0;
    if (qty <= 0) return { success: false, reason: "No components to sell" };
    const earnings = qty * (COMPONENT_MARKET_BUY[key] || 100);
    PlayerAccess.modifyCredits(earnings);
    PlayerAccess.setComponents(key, 0);
    return { success: true, creditsEarned: earnings };
  }
}

export function fitModuleAction(rack: "turret" | "high" | "med" | "low", slotIdx: number, instanceId: string): ActionResponse {
  if (!instanceId) return { success: false, reason: "No module selected" };
  const inst = getInstance(instanceId);
  if (!inst) return { success: false, reason: "Module instance not found" };
  const m = MODULES[inst.baseId];
  if (!m) return { success: false, reason: "Module base definition not found" };

  PlayerAccess.setFittingSlot(rack, slotIdx, instanceId);
  PlayerAccess.setModuleHp(rack, slotIdx, Math.round((inst.durability / inst.maxDurability) * MODULE_HP_MAX));
  syncSlotHeat();
  invalidate();

  return { success: true };
}

export function unfitModuleAction(rack: "turret" | "high" | "med" | "low", slotIdx: number): ActionResponse {
  const uid = G.P.fitting[rack][slotIdx];
  if (!uid) return { success: false, reason: "Slot is empty" };
  const inst = getInstance(uid);
  if (!inst) return { success: false, reason: "Module instance not found" };

  const slotHp = G.P.moduleHp?.[rack]?.[slotIdx] ?? MODULE_HP_MAX;
  inst.durability = Math.round((slotHp / MODULE_HP_MAX) * inst.maxDurability);
  PlayerAccess.setFittingSlot(rack, slotIdx, null);
  syncSlotHeat();
  invalidate();

  return { success: true };
}

export function swapModuleAction(rack: "turret" | "high" | "med" | "low", slotIdx: number, newInstanceId: string): ActionResponse {
  if (!newInstanceId) return { success: false, reason: "No module selected" };
  const newInst = getInstance(newInstanceId);
  if (!newInst) return { success: false, reason: "New module instance not found" };

  const oldUid = G.P.fitting[rack][slotIdx];
  if (!oldUid) return { success: false, reason: "No module to swap from" };
  const oldInst = getInstance(oldUid);
  if (!oldInst) return { success: false, reason: "Old module instance not found" };

  const slotHp = G.P.moduleHp?.[rack]?.[slotIdx] ?? MODULE_HP_MAX;
  oldInst.durability = Math.round((slotHp / MODULE_HP_MAX) * oldInst.maxDurability);
  PlayerAccess.setFittingSlot(rack, slotIdx, newInstanceId);
  PlayerAccess.setModuleHp(rack, slotIdx, Math.round((newInst.durability / newInst.maxDurability) * MODULE_HP_MAX));
  syncSlotHeat();
  invalidate();

  return { success: true };
}

export function queueIndustryJobAction(recipeId: string, craftQty: number): ActionResponse {
  const r = getRecipe(recipeId);
  if (!r) return { success: false, reason: "Recipe not found" };
  if (r.requiresBlueprint && !G.P.blueprints[recipeId]) {
    return { success: false, reason: "Blueprint required" };
  }

  const pool = (p: IndustryPool) =>
    p === "ore" ? G.P.ore : p === "refined" ? G.P.refined : p === "loot" ? G.P.loot : G.P.components;

  for (const inp of r.inputs) {
    if ((pool(inp.pool)[inp.key] || 0) < inp.qty * craftQty) {
      return { success: false, reason: `Insufficient ${inp.key}` };
    }
  }

  for (const inp of r.inputs) {
    const cur = pool(inp.pool)[inp.key] || 0;
    const setter = inp.pool === "ore" ? PlayerAccess.setOre
      : inp.pool === "refined" ? PlayerAccess.setRefined
      : inp.pool === "loot" ? PlayerAccess.setLoot
      : PlayerAccess.setComponents;
    setter(inp.key, cur - inp.qty * craftQty);
  }

  const job = createCraftJob(recipeId, craftQty);
  PlayerAccess.addCraftJob(job);

  return { success: true, label: `${r.label} ×${craftQty} (${job.duration / 1000}s)` };
}

export function cancelIndustryJobAction(jobId: string): ActionResponse {
  const idx = G.P.craftQueue.findIndex(j => j.id === jobId);
  if (idx === -1) return { success: false, reason: "Job not found" };
  const job = G.P.craftQueue[idx];
  const r = getRecipe(job.recipeId);

  if (r) {
    const pool = (p: IndustryPool) =>
      p === "ore" ? G.P.ore : p === "refined" ? G.P.refined : p === "loot" ? G.P.loot : G.P.components;
    for (const inp of r.inputs) {
      const cur = pool(inp.pool)[inp.key] || 0;
      const setter = inp.pool === "ore" ? PlayerAccess.setOre
        : inp.pool === "refined" ? PlayerAccess.setRefined
        : inp.pool === "loot" ? PlayerAccess.setLoot
        : PlayerAccess.setComponents;
      setter(inp.key, cur + inp.qty * job.qty);
    }
  }

  PlayerAccess.removeCraftJob(idx);
  return { success: true, label: r?.label || "job" };
}

export function buyBlueprintAction(recipeId: string): ActionResponse {
  const r = getRecipe(recipeId);
  const cost = r?.blueprintCost ?? 0;
  if (!r || !cost) return { success: false, reason: "Blueprint not purchasable" };
  if (G.P.credits < cost) return { success: false, reason: "Insufficient credits" };

  PlayerAccess.modifyCredits(-cost);
  PlayerAccess.setBlueprint(recipeId, true);
  return { success: true, creditsSpent: cost };
}

export function setHomeSystemAction(): ActionResponse {
  PlayerAccess.setHomeSysIdx(G.P.sysIdx);
  return { success: true };
}

export function acceptContractAction(contractId: string, stationContracts: MissionContract[]): ActionResponse {
  const contract = stationContracts.find(c => c.id === contractId);
  if (!contract) return { success: false, reason: "Contract not found" };
  if (G.P.contracts.length >= 3) {
    return { success: false, reason: "Contract limit reached" };
  }

  const accepted = { ...contract, status: "active" as const };
  PlayerAccess.addContract(accepted);
  emit("mission:accepted", { contract: accepted });

  return { success: true, label: accepted.title };
}

export function turnInContractAction(contractId: string): ActionResponse {
  const idx = G.P.contracts.findIndex(c => c.id === contractId && c.status === "complete");
  if (idx === -1) return { success: false, reason: "Complete contract not found" };
  const contract = G.P.contracts[idx];

  if (contract.stationId !== Client.activeStation?.id) {
    return { success: false, reason: "Must turn in at correct station" };
  }

  PlayerAccess.modifyCredits(contract.reward);
  PlayerAccess.removeContract(idx);

  return { success: true, creditsEarned: contract.reward, label: contract.title };
}

export function abandonContractAction(contractId: string): ActionResponse {
  const idx = G.P.contracts.findIndex(c => c.id === contractId);
  if (idx === -1) return { success: false, reason: "Contract not found" };

  PlayerAccess.removeContract(idx);
  return { success: true };
}

export function jettisonItemAction(itemId: string, qty: number | null = null): ActionResponse {
  // Parsing standard IDs like: "ore_iron", "ammo_hybrid", "ref_bar", "loot_scrap", "comp_gear", "mod_uid"
  let type = "";
  let key = "";
  if (itemId.startsWith("ore_")) {
    type = "ore";
    key = itemId.replace("ore_", "");
  } else if (itemId.startsWith("ammo_")) {
    type = "ammo";
    key = itemId.replace("ammo_", "");
  } else if (itemId.startsWith("ref_")) {
    type = "refined";
    key = itemId.replace("ref_", "");
  } else if (itemId.startsWith("loot_")) {
    type = "loot";
    key = itemId.replace("loot_", "");
  } else if (itemId.startsWith("comp_")) {
    type = "component";
    key = itemId.replace("comp_", "");
  } else if (itemId.startsWith("mod_")) {
    type = "module";
    key = itemId.replace("mod_", "");
  }

  if (!type) return { success: false, reason: "Invalid item ID format" };

  if (type === "ore") {
    const cur = G.P.ore[key] || 0;
    const drop = qty === null ? cur : Math.min(qty, cur);
    if (drop <= 0) return { success: false, reason: "No items to jettison" };
    PlayerAccess.setOre(key, Math.max(0, cur - drop));
    return { success: true, label: `${drop}× iron` }; // Generic display, or caller handles
  } else if (type === "ammo") {
    const cur = G.P.ammo[key as keyof typeof G.P.ammo] || 0;
    const drop = qty === null ? cur : Math.min(qty, cur);
    if (drop <= 0) return { success: false, reason: "No items to jettison" };
    PlayerAccess.setAmmo(key as "hybrid" | "missile", Math.max(0, cur - drop));
    return { success: true };
  } else if (type === "refined") {
    const cur = G.P.refined[key] || 0;
    const drop = qty === null ? cur : Math.min(qty, cur);
    if (drop <= 0) return { success: false, reason: "No items to jettison" };
    PlayerAccess.setRefined(key, Math.max(0, cur - drop));
    return { success: true };
  } else if (type === "loot") {
    const cur = G.P.loot[key] || 0;
    const drop = qty === null ? cur : Math.min(qty, cur);
    if (drop <= 0) return { success: false, reason: "No items to jettison" };
    PlayerAccess.setLoot(key, Math.max(0, cur - drop));
    return { success: true };
  } else if (type === "component") {
    const cur = G.P.components[key] || 0;
    const drop = qty === null ? cur : Math.min(qty, cur);
    if (drop <= 0) return { success: false, reason: "No items to jettison" };
    PlayerAccess.setComponents(key, Math.max(0, cur - drop));
    return { success: true };
  } else {
    // Module Jettison
    const isFitted = ["turret", "high", "med", "low"].some(r =>
      G.P.fitting[r]?.includes(key)
    );
    if (isFitted) return { success: false, reason: "Cannot jettison fitted module" };
    const instIdx = G.P.moduleCargo.findIndex(inst => inst.uid === key);
    if (instIdx === -1) return { success: false, reason: "Module instance not found in cargo" };

    PlayerAccess.removeModuleCargo(instIdx);
    invalidateInstanceCache();
    return { success: true };
  }
}
