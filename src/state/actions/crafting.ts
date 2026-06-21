import { type Player } from "../../state.js";
import { PlayerAccess, getState } from "../../state-access.js";
import { getRecipe, createCraftJob, type IndustryPool, tickCraftJobs, type CraftJob, RECIPES } from "../../data/industryRecipes.js";
import { invalidate } from "../../player/player-stats.js";
import { ALLOY_FAMILIES } from "../../refinery/families.js";
import { materialMatchesRecipeMaterial } from "../../refinery/storage.js";
import type { ActionResponse } from "./economy.js";

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
