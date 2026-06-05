/**
 * Single source of truth for all station industry recipes.
 *
 * **Adding a recipe:** append to RECIPES. Set `machine` to an existing machine id,
 * or add a new entry to MACHINES first.
 *
 * **Adding a new pool output type:** register the key in the appropriate resource
 * dict (COMPONENTS, etc.), VOL, and player-data defaults.
 */

import { ORE, LOOT, COMPONENTS } from "./resources.js";
import { ALLOY_FAMILIES } from "../refining.js";

export type IndustryPool = "ore" | "loot" | "component" | "material";

export interface RecipeIO {
  pool: IndustryPool;
  key: string;
  qty: number;
}

export interface Recipe {
  id: string;
  machine: string;
  label: string;
  inputs: RecipeIO[];
  outputs: RecipeIO[];
  /** Estimated time to craft one unit (seconds). */
  duration?: number;
  /** Enables a "× All" batch button. */
  batchable?: boolean;
  /** Skill key (on getState().player.skills) applied as a 5%-per-level output multiplier. */
  outputSkill?: string;
  requiresBlueprint?: boolean;
  blueprintCost?: number;
}

export interface Machine {
  id: string;
  label: string;
}

export const MACHINES: Machine[] = [
  { id: "workbench", label: "Fabrication" },
  { id: "processor", label: "Recovery" },
];

export const RECIPES: Recipe[] = [
  // ── Fabrication ───────────────────────────────────────────────────────────
  {
    id: "circuit", machine: "workbench", label: "Circuit board", duration: 12,
    inputs: [
      { pool: "material", key: "crystal_matrix",  qty: 0.4 },
      { pool: "loot",    key: "chip", qty: 1 },
    ],
    outputs: [{ pool: "component", key: "circuit", qty: 1 }],
  },
  {
    id: "gear", machine: "workbench", label: "Mechanical gear", duration: 12,
    inputs: [
      { pool: "material", key: "ferro_nickel_stock", qty: 0.6 },
      { pool: "loot",    key: "scrap",   qty: 2 },
    ],
    outputs: [{ pool: "component", key: "gear", qty: 1 }],
  },
  {
    id: "harness", machine: "workbench", label: "Wiring harness", duration: 12,
    inputs: [
      { pool: "material", key: "exotic_conductive", qty: 0.35 },
      { pool: "loot",    key: "cell",       qty: 1 },
    ],
    outputs: [{ pool: "component", key: "harness", qty: 1 }],
  },
  {
    id: "sensor_cluster", machine: "workbench", label: "Sensor cluster", duration: 15,
    requiresBlueprint: true, blueprintCost: 850,
    inputs: [
      { pool: "component", key: "circuit", qty: 1 },
      { pool: "component", key: "gear",    qty: 1 },
      { pool: "component", key: "harness", qty: 1 },
    ],
    outputs: [{ pool: "component", key: "sensor_cluster", qty: 1 }],
  },

  // ── Recovery ──────────────────────────────────────────────────────────────
  {
    id: "proc_gear", machine: "processor", label: "Mechanical gear", duration: 10,
    batchable: true, outputSkill: "metallurgy",
    inputs:  [{ pool: "loot",      key: "intact-part", qty: 1 }],
    outputs: [{ pool: "component", key: "gear",        qty: 1 }],
  },
  {
    id: "proc_circuit", machine: "processor", label: "Circuit board", duration: 10,
    batchable: true, outputSkill: "metallurgy",
    inputs: [
      { pool: "loot", key: "intact-part", qty: 1 },
      { pool: "loot", key: "chip",        qty: 1 },
    ],
    outputs: [{ pool: "component", key: "circuit", qty: 1 }],
  },
  {
    id: "proc_harness", machine: "processor", label: "Wiring harness", duration: 10,
    batchable: true, outputSkill: "metallurgy",
    inputs: [
      { pool: "loot", key: "intact-part", qty: 1 },
      { pool: "loot", key: "cell",        qty: 1 },
    ],
    outputs: [{ pool: "component", key: "harness", qty: 1 }],
  },
];

/** Bump when recipe ids change so hot-reload UIs rebuild. */
export const INDUSTRY_RECIPES_REVISION = RECIPES.map(r => r.id).join("|");

const recipesById: Record<string, Recipe | undefined> = Object.fromEntries(
  RECIPES.map(r => [r.id, r])
);

export function getRecipe(id: string): Recipe | null {
  return recipesById[id] ?? null;
}

export function recipesByMachine(machineId: string): Recipe[] {
  return RECIPES.filter(r => r.machine === machineId);
}

/** Resolve a pool key to its display label. */
export function poolItemLabel(pool: IndustryPool, key: string): string {
  if (pool === "ore")       return ORE[key]?.label       ?? key;
  if (pool === "loot")      return LOOT[key]?.label      ?? key;
  if (pool === "component") return COMPONENTS[key]?.label ?? key;
  if (pool === "material")  return ALLOY_FAMILIES.find((family) => family.id === key)?.label ?? key;
  return key;
}

export interface CraftJob {
  id: string;
  recipeId: string;
  startTime: number;
  duration: number;
  qty: number;
}

let _nextJobId = 1;
function generateJobId(): string { return `job-${_nextJobId++}`; }

export function createCraftJob(recipeId: string, qty: number): CraftJob {
  const recipe = getRecipe(recipeId);
  if (!recipe) throw new Error(`Unknown recipe: ${recipeId}`);
  return {
    id: generateJobId(),
    recipeId,
    startTime: Date.now(),
    duration: (recipe.duration ?? 10) * 1000,
    qty,
  };
}

export function tickCraftJobs(jobs: CraftJob[], onDone: (job: CraftJob) => void): CraftJob[] {
  const remaining: CraftJob[] = [];
  for (const job of jobs) {
    const elapsed = Date.now() - job.startTime;
    if (elapsed >= job.duration) {
      onDone(job);
    } else {
      remaining.push(job);
    }
  }
  return remaining;
}

