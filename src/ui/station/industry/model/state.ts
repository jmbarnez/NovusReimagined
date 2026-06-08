import { getState } from "../../../../state-access.js";
import { getAlloyFamilies, materialMatchesRecipeMaterial } from "../../../../refinery/index.js";
import { type IndustryPool } from "../../../../data/industryRecipes.js";
import { stationState } from "../../shared.js";
import type { RefineryStorageUnit } from "../../../../state.js";

export type RefiningStage = "process" | "separate" | "alloy";

export interface StageMeta {
  id: RefiningStage;
  label: string;
  kicker: string;
  body: string;
}

export const STAGES: StageMeta[] = [
  {
    id: "process",
    label: "Process",
    kicker: "Ore in",
    body: "Turn ore from cargo into stock.",
  },
  {
    id: "separate",
    label: "Separate",
    kicker: "Split stock",
    body: "Split mixed stock into simple streams.",
  },
  {
    id: "alloy",
    label: "Alloy",
    kicker: "Blend stock",
    body: "Blend stock into a known alloy or a new mix.",
  },
];

export const HEAT_OPTIONS = [
  { id: "cool", label: "Cool" },
  { id: "stable", label: "Stable" },
  { id: "hot", label: "Hot" },
] as const;

export const MACHINE_META: Record<string, { kicker: string; body: string }> = {
  workbench: {
    kicker: "Bulk material fabrication",
    body: "Turns alloy stock, salvage parts, and blueprint-gated assemblies into finished station components.",
  },
  processor: {
    kicker: "Salvage recovery",
    body: "Recovers usable component stock from damaged field parts and salvage-grade hardware.",
  },
};

export const RECIPE_NOTES: Record<string, string> = {
  circuit: "Crystal matrix feed is pressed into stable sensor substrate before loot-grade electronics are bonded in.",
  gear: "Structural stock is trimmed into torque-safe hardware for fittings, hull work, and assembly lines.",
  harness: "Conductive stock is drawn into controlled looms and finished with compact cell hardware.",
  sensor_cluster: "Composite subassemblies are packed into a blueprint-gated sensor package for advanced systems.",
  proc_gear: "Intact field parts are rebuilt into standardized drive hardware.",
  proc_circuit: "Recovery line extracts functional board surfaces from salvage electronics.",
  proc_harness: "Power cells and intact parts are stripped into serviceable wiring bundles.",
};

export function currentStage(): RefiningStage {
  return stationState.indStage;
}

export function stageMeta(id: RefiningStage): StageMeta {
  return STAGES.find((stage) => stage.id === id) ?? STAGES[0]!;
}

export function selectedHeatMode(seed: string): "cool" | "stable" | "hot" {
  const value = stationState.indHeatOverrides[seed];
  return value === "cool" || value === "hot" ? value : "stable";
}

export function playerPool(pool: IndustryPool): Record<string, number> {
  if (pool === "ore") return getState().player.ore;
  if (pool === "loot") return getState().player.loot;
  if (pool === "component") return getState().player.components;
  return {};
}

export function materialStacks() {
  return getState().player.bulkMaterialsCargo ?? [];
}

export function refineryStorageUnits(): RefineryStorageUnit[] {
  return getState().player.refineryStorage ?? [];
}

export function refineryMaterials() {
  return refineryStorageUnits().flatMap((unit) => unit.entries ?? []);
}

export function stockOf(pool: IndustryPool, key: string): number {
  if (pool === "material") {
    return materialStacks()
      .filter((stack) => materialMatchesRecipeMaterial(stack, key, getState().player.alloyCodex))
      .reduce((sum, stack) => sum + stack.volumeM3, 0);
  }
  return playerPool(pool)[key] || 0;
}

export function selectedProcessQty(cargoIndex: number, maxQty: number): number {
  const key = String(cargoIndex);
  const raw = stationState.indProcessQty[key];
  if (!Number.isFinite(raw)) return 1;
  return Math.max(1, Math.min(maxQty, Math.floor(raw)));
}
