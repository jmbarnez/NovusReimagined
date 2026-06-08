import { MACHINES, RECIPES, type Recipe } from "../../../../data/industryRecipes.js";
import { stationState } from "../../shared.js";
import { stockOf } from "./state.js";
import { groupRefineryMaterials } from "./composition.js";

export function canAffordRecipe(recipeId: string, qty: number): boolean {
  const recipe = RECIPES.find((entry) => entry.id === recipeId);
  if (!recipe) return false;
  return recipe.inputs.every((input) => stockOf(input.pool, input.key) >= input.qty * qty);
}

export function fabricationReadyMaterials() {
  const materialGroups = groupRefineryMaterials();
  return materialGroups.filter((entry) =>
    RECIPES.some((recipe) =>
      recipe.inputs.some((input) => input.pool === "material" && entry.compatibleFamilyIds.includes(input.key)),
    ),
  );
}

export function filteredAssemblyRecipes(): Recipe[] {
  const query = stationState.indSearch.trim().toLowerCase();
  let filtered = RECIPES.filter((recipe) => recipe.machine === stationState.indTab);
  if (query) filtered = filtered.filter((recipe) => recipe.label.toLowerCase().includes(query));
  if (stationState.indSort === "affordable") {
    filtered = [...filtered].sort((a, b) => {
      const aCost = canAffordRecipe(a.id, stationState.craftQty) ? 0 : 1;
      const bCost = canAffordRecipe(b.id, stationState.craftQty) ? 0 : 1;
      return aCost - bCost || a.label.localeCompare(b.label);
    });
  } else {
    filtered = [...filtered].sort((a, b) => a.label.localeCompare(b.label));
  }
  return filtered;
}
