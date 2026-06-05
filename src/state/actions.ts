import { type Player } from "../state.js";
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
import { getDockableStation } from "../dock.js";
import { moduleFitsShipRack } from "../utils/hardpoints.js";
import { ALLOY_FAMILIES, materialMatchesRecipeMaterial } from "../refining.js";

export interface ActionResponse {
  success: boolean;
  reason?: string;
  creditsSpent?: number;
  creditsEarned?: number;
  label?: string;
}

function materialStockOf(key: string, p: Player): number {
  return (p.bulkMaterialsCargo ?? [])
    .filter((stack) => materialMatchesRecipeMaterial(stack, key, p.alloyCodex))
    .reduce((sum, stack) => sum + stack.volumeM3, 0);
}

function consumeMaterialVolume(key: string, volumeM3: number, p: Player): boolean {
  if (materialStockOf(key, p) + 1e-6 < volumeM3) return false;
  let remaining = volumeM3;
  const next = [...(p.bulkMaterialsCargo ?? [])];
  for (let i = 0; i < next.length && remaining > 1e-6; i++) {
    const stack = next[i];
    if (!materialMatchesRecipeMaterial(stack, key, p.alloyCodex)) continue;
    const take = Math.min(stack.volumeM3, remaining);
    if (take <= 0) continue;
    const ratio = take / Math.max(stack.volumeM3, 1e-6);
    stack.volumeM3 -= take;
    stack.massKg -= stack.massKg * ratio;
    remaining -= take;
  }
  PlayerAccess.setBulkMaterialsCargo(next.filter((stack) => stack.volumeM3 > 1e-4 && stack.massKg > 1e-2), p);
  invalidate(p);
  return true;
}

function refundMaterialVolume(key: string, volumeM3: number, p: Player): void {
  const family = ALLOY_FAMILIES.find((entry) => entry.id === key);
  if (!family || volumeM3 <= 0) return;
  PlayerAccess.addBulkMaterial({
    id: `refund-${key}-${Date.now()}`,
    materialId: family.id,
    kind: "alloy",
    label: family.label,
    alloyFamilyId: family.id,
    volumeM3,
    massKg: volumeM3 * family.densityKgPerM3,
    composition: Object.fromEntries(
      Object.entries(family.windows).map(([oreKey, range]) => [oreKey, ((range?.min ?? 0) + (range?.max ?? 0)) / 2]),
    ),
  }, p);
}

function isInstanceFittedElsewhere(instanceId: string, p: Player, except?: { rack: string; slotIdx: number }): boolean {
  for (const rack of ["turret", "high", "med", "low"] as const) {
    const slots = p.fitting?.[rack] ?? [];
    for (let idx = 0; idx < slots.length; idx++) {
      if (except && rack === except.rack && idx === except.slotIdx) continue;
      if (slots[idx] === instanceId) return true;
    }
  }
  return false;
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

export function fitModuleAction(rack: "turret" | "high" | "med" | "low", slotIdx: number, instanceId: string, p: Player = getState().player): ActionResponse {
  if (!instanceId) return { success: false, reason: "No module selected" };
  if (!Array.isArray(p.fitting?.[rack]) || slotIdx < 0 || slotIdx >= p.fitting[rack].length) {
    return { success: false, reason: "Invalid slot" };
  }
  if (p.fitting[rack][slotIdx]) return { success: false, reason: "Slot already occupied" };
  const inst = getInstance(instanceId, p);
  if (!inst) return { success: false, reason: "Module instance not found" };
  const m = MODULES[inst.baseId];
  if (!m) return { success: false, reason: "Module base definition not found" };
  if (!moduleFitsShipRack(m.rack, rack)) return { success: false, reason: "Module does not fit this slot" };
  if (isInstanceFittedElsewhere(instanceId, p)) return { success: false, reason: "Module is already fitted" };

  PlayerAccess.setFittingSlot(rack, slotIdx, instanceId, p);
  PlayerAccess.setModuleHp(rack, slotIdx, Math.round((inst.durability / inst.maxDurability) * MODULE_HP_MAX), p);
  syncSlotHeat(p);
  invalidate(p);

  return { success: true };
}

export function unfitModuleAction(rack: "turret" | "high" | "med" | "low", slotIdx: number, p: Player = getState().player): ActionResponse {
  if (!Array.isArray(p.fitting?.[rack]) || slotIdx < 0 || slotIdx >= p.fitting[rack].length) {
    return { success: false, reason: "Invalid slot" };
  }
  const uid = p.fitting[rack][slotIdx];
  if (!uid) return { success: false, reason: "Slot is empty" };
  const inst = getInstance(uid, p);
  if (!inst) return { success: false, reason: "Module instance not found" };

  const slotHp = p.moduleHp?.[rack]?.[slotIdx] ?? MODULE_HP_MAX;
  inst.durability = Math.round((slotHp / MODULE_HP_MAX) * inst.maxDurability);
  PlayerAccess.setFittingSlot(rack, slotIdx, null, p);
  syncSlotHeat(p);
  invalidate(p);

  return { success: true };
}

export function swapModuleAction(rack: "turret" | "high" | "med" | "low", slotIdx: number, newInstanceId: string, p: Player = getState().player): ActionResponse {
  if (!newInstanceId) return { success: false, reason: "No module selected" };
  if (!Array.isArray(p.fitting?.[rack]) || slotIdx < 0 || slotIdx >= p.fitting[rack].length) {
    return { success: false, reason: "Invalid slot" };
  }
  const newInst = getInstance(newInstanceId, p);
  if (!newInst) return { success: false, reason: "New module instance not found" };
  const newModule = MODULES[newInst.baseId];
  if (!newModule) return { success: false, reason: "New module base definition not found" };
  if (!moduleFitsShipRack(newModule.rack, rack)) return { success: false, reason: "Module does not fit this slot" };
  if (isInstanceFittedElsewhere(newInstanceId, p, { rack, slotIdx })) {
    return { success: false, reason: "Module is already fitted" };
  }

  const oldUid = p.fitting[rack][slotIdx];
  if (!oldUid) return { success: false, reason: "No module to swap from" };
  const oldInst = getInstance(oldUid, p);
  if (!oldInst) return { success: false, reason: "Old module instance not found" };

  const slotHp = p.moduleHp?.[rack]?.[slotIdx] ?? MODULE_HP_MAX;
  oldInst.durability = Math.round((slotHp / MODULE_HP_MAX) * oldInst.maxDurability);
  PlayerAccess.setFittingSlot(rack, slotIdx, newInstanceId, p);
  PlayerAccess.setModuleHp(rack, slotIdx, Math.round((newInst.durability / newInst.maxDurability) * MODULE_HP_MAX), p);
  syncSlotHeat(p);
  invalidate(p);

  return { success: true };
}

export function queueIndustryJobAction(recipeId: string, craftQty: number, p: Player = getState().player): ActionResponse {
  const r = getRecipe(recipeId);
  if (!r) return { success: false, reason: "Recipe not found" };
  if (r.requiresBlueprint && !p.blueprints[recipeId]) {
    return { success: false, reason: "Blueprint required" };
  }

  const pool = (poolType: IndustryPool) =>
    poolType === "ore" ? p.ore
      : poolType === "loot" ? p.loot
      : poolType === "component" ? p.components
      : null;

  for (const inp of r.inputs) {
    const stock = inp.pool === "material"
      ? materialStockOf(inp.key, p)
      : ((pool(inp.pool)?.[inp.key] || 0));
    if (stock < inp.qty * craftQty - 1e-6) {
      return { success: false, reason: `Insufficient ${inp.key}` };
    }
  }

  const isLocal = (p === getState().player);
  for (const inp of r.inputs) {
    if (inp.pool === "material") {
      if (!consumeMaterialVolume(inp.key, inp.qty * craftQty, p)) {
        return { success: false, reason: `Insufficient ${inp.key}` };
      }
    } else {
      const cur = pool(inp.pool)?.[inp.key] || 0;
      if (isLocal) {
        const setter = inp.pool === "ore" ? PlayerAccess.setOre
          : inp.pool === "loot" ? PlayerAccess.setLoot
          : PlayerAccess.setComponents;
        setter(inp.key, cur - inp.qty * craftQty);
      } else if (pool(inp.pool)) {
        pool(inp.pool)![inp.key] = cur - inp.qty * craftQty;
      }
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
    poolType === "ore" ? playerObj.ore
      : poolType === "loot" ? playerObj.loot
      : poolType === "component" ? playerObj.components
      : null;

  for (const job of completed) {
    const recipe = RECIPES.find(r => r.id === job.recipeId);
    if (!recipe) continue;
    const skillMult = recipe.outputSkill ? 1 + (p.skills[recipe.outputSkill] || 0) * 0.05 : 1;
    for (const out of recipe.outputs) {
      const totalQty = Math.floor(out.qty * job.qty * skillMult);
      if (out.pool === "material") {
        refundMaterialVolume(out.key, totalQty, p);
      } else {
        const cur = pool(out.pool, p)?.[out.key] || 0;
        if (isLocal) {
          const setter = out.pool === "ore" ? PlayerAccess.setOre
            : out.pool === "loot" ? PlayerAccess.setLoot
            : PlayerAccess.setComponents;
          setter(out.key, cur + totalQty);
        } else if (pool(out.pool, p)) {
          pool(out.pool, p)![out.key] = cur + totalQty;
        }
      }
    }
  }
}

export function cancelIndustryJobAction(jobId: string, p: Player = getState().player): ActionResponse {
  const idx = p.craftQueue.findIndex(j => j.id === jobId);
  if (idx === -1) return { success: false, reason: "Job not found" };
  const job = p.craftQueue[idx];
  const r = getRecipe(job.recipeId);

  if (r) {
    const pool = (poolType: IndustryPool) =>
      poolType === "ore" ? p.ore
        : poolType === "loot" ? p.loot
        : poolType === "component" ? p.components
        : null;
    for (const inp of r.inputs) {
      if (inp.pool === "material") {
        refundMaterialVolume(inp.key, inp.qty * job.qty, p);
      } else {
        const cur = pool(inp.pool)?.[inp.key] || 0;
        const setter = inp.pool === "ore" ? PlayerAccess.setOre
          : inp.pool === "loot" ? PlayerAccess.setLoot
          : PlayerAccess.setComponents;
        setter(inp.key, cur + inp.qty * job.qty, p);
      }
    }
  }

  PlayerAccess.removeCraftJob(idx, p);
  return { success: true, label: r?.label || "job" };
}

export function buyBlueprintAction(recipeId: string, p: Player = getState().player): ActionResponse {
  const r = getRecipe(recipeId);
  const cost = r?.blueprintCost ?? 0;
  if (!r || !cost) return { success: false, reason: "Blueprint not purchasable" };
  if (p.credits < cost) return { success: false, reason: "Insufficient credits" };

  PlayerAccess.modifyCredits(-cost, p);
  PlayerAccess.setBlueprint(recipeId, true, p);
  return { success: true, creditsSpent: cost };
}

export function setHomeSystemAction(p: Player = getState().player): ActionResponse {
  PlayerAccess.setHomeSysIdx(p.sysIdx, p);
  return { success: true };
}

export function acceptContractAction(
  contractId: string,
  stationContracts: MissionContract[],
  p: Player = getState().player,
): ActionResponse {
  const contract = stationContracts.find(c => c.id === contractId);
  if (!contract) return { success: false, reason: "Contract not found" };
  if (p.contracts.length >= 3) {
    return { success: false, reason: "Contract limit reached" };
  }

  const accepted = { ...contract, status: "active" as const };
  PlayerAccess.addContract(accepted, p);
  if (p === getState().player) {
    emit("mission:accepted", { contract: accepted });
  }

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

export function turnInContractAction(contractId: string, p: Player = getState().player): ActionResponse {
  const idx = p.contracts.findIndex(c => c.id === contractId && c.status === "complete");
  if (idx === -1) return { success: false, reason: "Complete contract not found" };
  const contract = p.contracts[idx];

  if (p.stationOfferStationId !== contract.stationId || !getDockableStation(p, contract.stationId)) {
    return { success: false, reason: "Must turn in at correct station" };
  }

  PlayerAccess.modifyCredits(contract.reward, p);
  PlayerAccess.removeContract(idx, p);

  return { success: true, creditsEarned: contract.reward, label: contract.title };
}

export function abandonContractAction(contractId: string, p: Player = getState().player): ActionResponse {
  const idx = p.contracts.findIndex(c => c.id === contractId);
  if (idx === -1) return { success: false, reason: "Contract not found" };

  PlayerAccess.removeContract(idx, p);
  return { success: true };
}

export function jettisonItemAction(itemId: string, qty: number | null = null, p: Player = getState().player): ActionResponse {
  // Parsing standard IDs like: "ore_iron", "ammo_hybrid", "loot_scrap", "comp_gear", "mod_uid"
  let type = "";
  let key = "";
  if (itemId.startsWith("ore_")) {
    type = "ore";
    key = itemId.replace("ore_", "");
  } else if (itemId.startsWith("ammo_")) {
    type = "ammo";
    key = itemId.replace("ammo_", "");
  } else if (itemId.startsWith("loot_")) {
    type = "loot";
    key = itemId.replace("loot_", "");
  } else if (itemId.startsWith("comp_")) {
    type = "component";
    key = itemId.replace("comp_", "");
  } else if (itemId.startsWith("mod_")) {
    type = "module";
    key = itemId.replace("mod_", "");
  } else if (itemId.startsWith("mat_")) {
    type = "material";
    key = itemId.replace("mat_", "");
  }

  if (!type) return { success: false, reason: "Invalid item ID format" };

  if (type === "ore") {
    const cur = p.ore[key] || 0;
    const drop = qty === null ? cur : Math.min(qty, cur);
    if (drop <= 0) return { success: false, reason: "No items to jettison" };
    PlayerAccess.setOre(key, Math.max(0, cur - drop), p);
    return { success: true, label: `${drop}× iron` }; // Generic display, or caller handles
  } else if (type === "ammo") {
    const cur = p.ammo[key as keyof typeof p.ammo] || 0;
    const drop = qty === null ? cur : Math.min(qty, cur);
    if (drop <= 0) return { success: false, reason: "No items to jettison" };
    PlayerAccess.setAmmo(key as "hybrid" | "missile", Math.max(0, cur - drop), p);
    return { success: true };
  } else if (type === "material") {
    const idx = parseInt(key, 10);
    if (!Number.isFinite(idx) || idx < 0) return { success: false, reason: "Material stack not found" };
    if (!p.bulkMaterialsCargo?.[idx]) return { success: false, reason: "Material stack not found" };
    PlayerAccess.removeBulkMaterial(idx, p);
    invalidate(p);
    return { success: true };
  } else if (type === "loot") {
    const cur = p.loot[key] || 0;
    const drop = qty === null ? cur : Math.min(qty, cur);
    if (drop <= 0) return { success: false, reason: "No items to jettison" };
    PlayerAccess.setLoot(key, Math.max(0, cur - drop), p);
    return { success: true };
  } else if (type === "component") {
    const cur = p.components[key] || 0;
    const drop = qty === null ? cur : Math.min(qty, cur);
    if (drop <= 0) return { success: false, reason: "No items to jettison" };
    PlayerAccess.setComponents(key, Math.max(0, cur - drop), p);
    return { success: true };
  } else {
    // Module Jettison
    const isFitted = ["turret", "high", "med", "low"].some(r =>
      p.fitting[r]?.includes(key)
    );
    if (isFitted) return { success: false, reason: "Cannot jettison fitted module" };
    const instIdx = p.moduleCargo.findIndex(inst => inst.uid === key);
    if (instIdx === -1) return { success: false, reason: "Module instance not found in cargo" };

    PlayerAccess.removeModuleCargo(instIdx, p);
    invalidateInstanceCache();
    return { success: true };
  }
}
