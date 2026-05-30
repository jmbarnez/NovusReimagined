import { Client, type Player } from "../state.js";
import { PlayerAccess, getState } from "../state-access.js";
import { MODULES } from "../data/modules.js";
import { ORE_MARKET_BUY, COMPONENT_MARKET_BUY } from "../data/marketCatalog.js";
import { getStats, invalidate } from "../player/player-stats.js";
import { syncSlotHeat } from "../player/player-fitting.js";
import { ensureAmmoDefaults } from "../player/player-data.js";
import { MODULE_HP_MAX } from "../constants.js";
import { emit } from "../events.js";
import { getRecipe, createCraftJob, type IndustryPool, tickCraftJobs, type CraftJob, RECIPES } from "../data/industryRecipes.js";
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

export function repairShipAction(_p: Player = getState().player): ActionResponse {
  const st = getStats();
  const hullRep = Math.max(0, st.maxHp - getState().player.hp);
  const structRep = Math.max(0, st.maxStructure - getState().player.structure);
  const shieldRep = Math.max(0, st.maxShield - getState().player.shield);
  let moduleDamageTotal = 0;

  for (const rack of ["turret", "high", "med", "low"] as const) {
    const slots = getState().player.fitting?.[rack];
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
  if (getState().player.credits < cost) {
    return { success: false, reason: "Insufficient credits" };
  }

  PlayerAccess.modifyCredits(-cost);
  PlayerAccess.setHp(st.maxHp);
  PlayerAccess.setStructure(st.maxStructure);
  PlayerAccess.setShield(st.maxShield);

  for (const inst of getState().player.moduleCargo) {
    inst.durability = inst.maxDurability;
  }

  for (const rack of ["turret", "high", "med", "low"] as const) {
    const slots = getState().player.fitting?.[rack];
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

export function buyModuleAction(moduleId: string, _p: Player = getState().player): ActionResponse {
  const m = MODULES[moduleId];
  if (!m) {
    return { success: false, reason: "Module not found" };
  }
  if (getState().player.credits < m.price) {
    return { success: false, reason: "Insufficient credits" };
  }

  PlayerAccess.modifyCredits(-m.price);
  const inst = generateModuleInstance(moduleId, getState().player.level, 0);
  inst.rarity = ModuleRarity.Stock;
  inst.affixes = [];
  PlayerAccess.addModuleCargo(inst);
  invalidateInstanceCache();

  return { success: true, creditsSpent: m.price };
}

export function sellModuleAction(moduleId: string, _p: Player = getState().player): ActionResponse {
  const m = MODULES[moduleId];
  if (!m) {
    return { success: false, reason: "Module not found" };
  }

  const fittedIds = new Set<string>();
  for (const r of ["turret", "high", "med", "low"] as const) {
    for (const uid of getState().player.fitting[r]) {
      if (uid) fittedIds.add(uid);
    }
  }

  const instIdx = getState().player.moduleCargo.findIndex(inst => inst.baseId === moduleId && !fittedIds.has(inst.uid));
  if (instIdx === -1) {
    return { success: false, reason: "No matching unfitted module found in cargo" };
  }

  const inst = getState().player.moduleCargo[instIdx];
  const rarityMult = RARITY_CONFIG[inst.rarity].sellMult;
  const sellPrice = Math.floor(m.price * 0.6 * rarityMult);

  PlayerAccess.removeModuleCargo(instIdx);
  PlayerAccess.modifyCredits(sellPrice);
  invalidateInstanceCache();
  invalidate();

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
  category: "ore" | "refined" | "loot" | "components",
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

export function fitModuleAction(rack: "turret" | "high" | "med" | "low", slotIdx: number, instanceId: string, _p: Player = getState().player): ActionResponse {
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

export function unfitModuleAction(rack: "turret" | "high" | "med" | "low", slotIdx: number, _p: Player = getState().player): ActionResponse {
  const uid = getState().player.fitting[rack][slotIdx];
  if (!uid) return { success: false, reason: "Slot is empty" };
  const inst = getInstance(uid);
  if (!inst) return { success: false, reason: "Module instance not found" };

  const slotHp = getState().player.moduleHp?.[rack]?.[slotIdx] ?? MODULE_HP_MAX;
  inst.durability = Math.round((slotHp / MODULE_HP_MAX) * inst.maxDurability);
  PlayerAccess.setFittingSlot(rack, slotIdx, null);
  syncSlotHeat();
  invalidate();

  return { success: true };
}

export function swapModuleAction(rack: "turret" | "high" | "med" | "low", slotIdx: number, newInstanceId: string, _p: Player = getState().player): ActionResponse {
  if (!newInstanceId) return { success: false, reason: "No module selected" };
  const newInst = getInstance(newInstanceId);
  if (!newInst) return { success: false, reason: "New module instance not found" };

  const oldUid = getState().player.fitting[rack][slotIdx];
  if (!oldUid) return { success: false, reason: "No module to swap from" };
  const oldInst = getInstance(oldUid);
  if (!oldInst) return { success: false, reason: "Old module instance not found" };

  const slotHp = getState().player.moduleHp?.[rack]?.[slotIdx] ?? MODULE_HP_MAX;
  oldInst.durability = Math.round((slotHp / MODULE_HP_MAX) * oldInst.maxDurability);
  PlayerAccess.setFittingSlot(rack, slotIdx, newInstanceId);
  PlayerAccess.setModuleHp(rack, slotIdx, Math.round((newInst.durability / newInst.maxDurability) * MODULE_HP_MAX));
  syncSlotHeat();
  invalidate();

  return { success: true };
}

export function queueIndustryJobAction(recipeId: string, craftQty: number, p: Player = getState().player): ActionResponse {
  const r = getRecipe(recipeId);
  if (!r) return { success: false, reason: "Recipe not found" };
  if (r.requiresBlueprint && !p.blueprints[recipeId]) {
    return { success: false, reason: "Blueprint required" };
  }

  const pool = (poolType: IndustryPool) =>
    poolType === "ore" ? p.ore : poolType === "refined" ? p.refined : poolType === "loot" ? p.loot : p.components;

  for (const inp of r.inputs) {
    if ((pool(inp.pool)[inp.key] || 0) < inp.qty * craftQty) {
      return { success: false, reason: `Insufficient ${inp.key}` };
    }
  }

  const isLocal = (p === getState().player);
  for (const inp of r.inputs) {
    const cur = pool(inp.pool)[inp.key] || 0;
    if (isLocal) {
      const setter = inp.pool === "ore" ? PlayerAccess.setOre
        : inp.pool === "refined" ? PlayerAccess.setRefined
        : inp.pool === "loot" ? PlayerAccess.setLoot
        : PlayerAccess.setComponents;
      setter(inp.key, cur - inp.qty * craftQty);
    } else {
      pool(inp.pool)[inp.key] = cur - inp.qty * craftQty;
    }
  }

  const job = createCraftJob(recipeId, craftQty);
  if (isLocal) {
    PlayerAccess.addCraftJob(job);
  } else {
    p.craftQueue.push(job);
  }

  return { success: true, label: `${r.label} ×${craftQty} (${job.duration / 1000}s)` };
}

export function tickIndustryQueue(p: Player = getState().player) {
  if (!p.craftQueue || p.craftQueue.length === 0) return;

  const completed: CraftJob[] = [];
  const remaining = tickCraftJobs(p.craftQueue, (job) => {
    completed.push(job);
  });

  const isLocal = (p === getState().player);
  if (isLocal) {
    PlayerAccess.setCraftQueue(remaining);
  } else {
    p.craftQueue = remaining;
  }

  const pool = (poolType: IndustryPool, playerObj: Player) =>
    poolType === "ore" ? playerObj.ore : poolType === "refined" ? playerObj.refined : poolType === "loot" ? playerObj.loot : playerObj.components;

  for (const job of completed) {
    const recipe = RECIPES.find(r => r.id === job.recipeId);
    if (!recipe) continue;
    const skillMult = recipe.outputSkill ? 1 + (p.skills[recipe.outputSkill] || 0) * 0.05 : 1;
    for (const out of recipe.outputs) {
      const totalQty = Math.floor(out.qty * job.qty * skillMult);
      const cur = pool(out.pool, p)[out.key] || 0;
      if (isLocal) {
        const setter = out.pool === "ore" ? PlayerAccess.setOre
          : out.pool === "refined" ? PlayerAccess.setRefined
          : out.pool === "loot" ? PlayerAccess.setLoot
          : PlayerAccess.setComponents;
        setter(out.key, cur + totalQty);
      } else {
        pool(out.pool, p)[out.key] = cur + totalQty;
      }
    }
  }
}

export function cancelIndustryJobAction(jobId: string, _p: Player = getState().player): ActionResponse {
  const idx = getState().player.craftQueue.findIndex(j => j.id === jobId);
  if (idx === -1) return { success: false, reason: "Job not found" };
  const job = getState().player.craftQueue[idx];
  const r = getRecipe(job.recipeId);

  if (r) {
    const pool = (p: IndustryPool) =>
      p === "ore" ? getState().player.ore : p === "refined" ? getState().player.refined : p === "loot" ? getState().player.loot : getState().player.components;
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

export function buyBlueprintAction(recipeId: string, _p: Player = getState().player): ActionResponse {
  const r = getRecipe(recipeId);
  const cost = r?.blueprintCost ?? 0;
  if (!r || !cost) return { success: false, reason: "Blueprint not purchasable" };
  if (getState().player.credits < cost) return { success: false, reason: "Insufficient credits" };

  PlayerAccess.modifyCredits(-cost);
  PlayerAccess.setBlueprint(recipeId, true);
  return { success: true, creditsSpent: cost };
}

export function setHomeSystemAction(p: Player = getState().player): ActionResponse {
  PlayerAccess.setHomeSysIdx(p.sysIdx, p);
  return { success: true };
}

export function acceptContractAction(contractId: string, stationContracts: MissionContract[]): ActionResponse {
  const contract = stationContracts.find(c => c.id === contractId);
  if (!contract) return { success: false, reason: "Contract not found" };
  if (getState().player.contracts.length >= 3) {
    return { success: false, reason: "Contract limit reached" };
  }

  const accepted = { ...contract, status: "active" as const };
  PlayerAccess.addContract(accepted);
  emit("mission:accepted", { contract: accepted });

  return { success: true, label: accepted.title };
}

export function acceptContractProposalAction(
  contract: MissionContract,
  stationId: string | null,
  p: Player = getState().player
): ActionResponse {
  if (p.contracts.length >= 3) {
    return { success: false, reason: "Contract limit reached" };
  }
  const accepted = { ...contract, status: "active" as const };
  if (stationId) accepted.stationId = stationId;
  PlayerAccess.addContract(accepted, p);

  if (p === getState().player) {
    emit("mission:accepted", { contract: accepted });
  }

  return { success: true, label: accepted.title };
}

export function turnInContractAction(contractId: string, _p: Player = getState().player): ActionResponse {
  const idx = getState().player.contracts.findIndex(c => c.id === contractId && c.status === "complete");
  if (idx === -1) return { success: false, reason: "Complete contract not found" };
  const contract = getState().player.contracts[idx];

  if (contract.stationId !== Client.activeStation?.id) {
    return { success: false, reason: "Must turn in at correct station" };
  }

  PlayerAccess.modifyCredits(contract.reward);
  PlayerAccess.removeContract(idx);

  return { success: true, creditsEarned: contract.reward, label: contract.title };
}

export function abandonContractAction(contractId: string, _p: Player = getState().player): ActionResponse {
  const idx = getState().player.contracts.findIndex(c => c.id === contractId);
  if (idx === -1) return { success: false, reason: "Contract not found" };

  PlayerAccess.removeContract(idx);
  return { success: true };
}

export function jettisonItemAction(itemId: string, qty: number | null = null, _p: Player = getState().player): ActionResponse {
  const p = getState().player;
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
    const cur = p.ore[key] || 0;
    const drop = qty === null ? cur : Math.min(qty, cur);
    if (drop <= 0) return { success: false, reason: "No items to jettison" };
    PlayerAccess.setOre(key, Math.max(0, cur - drop));
    return { success: true, label: `${drop}× iron` }; // Generic display, or caller handles
  } else if (type === "ammo") {
    const cur = p.ammo[key as keyof typeof p.ammo] || 0;
    const drop = qty === null ? cur : Math.min(qty, cur);
    if (drop <= 0) return { success: false, reason: "No items to jettison" };
    PlayerAccess.setAmmo(key as "hybrid" | "missile", Math.max(0, cur - drop));
    return { success: true };
  } else if (type === "refined") {
    const cur = p.refined[key] || 0;
    const drop = qty === null ? cur : Math.min(qty, cur);
    if (drop <= 0) return { success: false, reason: "No items to jettison" };
    PlayerAccess.setRefined(key, Math.max(0, cur - drop));
    return { success: true };
  } else if (type === "loot") {
    const cur = p.loot[key] || 0;
    const drop = qty === null ? cur : Math.min(qty, cur);
    if (drop <= 0) return { success: false, reason: "No items to jettison" };
    PlayerAccess.setLoot(key, Math.max(0, cur - drop));
    return { success: true };
  } else if (type === "component") {
    const cur = p.components[key] || 0;
    const drop = qty === null ? cur : Math.min(qty, cur);
    if (drop <= 0) return { success: false, reason: "No items to jettison" };
    PlayerAccess.setComponents(key, Math.max(0, cur - drop));
    return { success: true };
  } else {
    // Module Jettison
    const isFitted = ["turret", "high", "med", "low"].some(r =>
      p.fitting[r]?.includes(key)
    );
    if (isFitted) return { success: false, reason: "Cannot jettison fitted module" };
    const instIdx = p.moduleCargo.findIndex(inst => inst.uid === key);
    if (instIdx === -1) return { success: false, reason: "Module instance not found in cargo" };

    PlayerAccess.removeModuleCargo(instIdx);
    invalidateInstanceCache();
    return { success: true };
  }
}
