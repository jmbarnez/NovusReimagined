import { getState } from "../../state-access.js";
import { getAlloyFamilies } from "../../hub.js";
import { MACHINES, RECIPES, poolItemLabel, type IndustryPool, type Recipe } from "../../data/industryRecipes.js";
import { ORE } from "../../data/resources.js";
import { escHtml } from "../../utils/format.js";
import { stationState, iconSvg } from "./shared.js";
import { aggregateStorageComposition, assessAlloyFamilies, materialMatchesRecipeMaterial, storageFillPct, storageUsedVolumeM3 } from "../../refining.js";
import type { RefineryStorageUnit } from "../../state.js";

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
    kicker: "Mixed ore intake",
    body: "Convert mined mixed ore cargo into processed stock while preserving composition and feeding the refinery stockpile.",
  },
  {
    id: "separate",
    label: "Separate",
    kicker: "Stock stream split",
    body: "Break processed stock into simpler constituent streams when a natural mix is noisy or better used elsewhere.",
  },
  {
    id: "alloy",
    label: "Alloy",
    kicker: "Targeted material shaping",
    body: "Push processed stock toward named alloy families or a custom blend, keeping composition as the strategic signal.",
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

export function formatVolume(volumeM3: number): string {
  return `${volumeM3.toFixed(2)} m³`;
}

export function formatMass(massKg: number): string {
  return `${Math.round(massKg).toLocaleString()} kg`;
}

export function formatQty(pool: IndustryPool, qty: number): string {
  return pool === "material" ? formatVolume(qty) : `${qty}×`;
}

export function oreColor(key: string): string {
  return ORE[key]?.color ?? "#b48a52";
}

export function dominantOreKey(composition: Record<string, number>): string | null {
  const entries = Object.entries(composition).sort((a, b) => b[1] - a[1]);
  return entries[0]?.[0] ?? null;
}

export function compositionGradient(composition: Record<string, number>): string {
  const entries = Object.entries(composition)
    .sort((a, b) => b[1] - a[1])
    .filter(([, value]) => value > 0.03);
  if (!entries.length) return "linear-gradient(90deg, #4a5a66, #6a7a86)";
  let cursor = 0;
  const stops: string[] = [];
  for (const [oreKey, value] of entries) {
    const pct = Math.max(4, Math.round(value * 100));
    const start = cursor;
    const end = Math.min(100, cursor + pct);
    const color = oreColor(oreKey);
    stops.push(`${color} ${start}% ${end}%`);
    cursor = end;
  }
  if (cursor < 100) stops.push(`rgba(255,255,255,0.12) ${cursor}% 100%`);
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}

export function compositionAccentVars(composition: Record<string, number>): string {
  const dominantKey = dominantOreKey(composition);
  const accent = dominantKey ? oreColor(dominantKey) : "#b48a52";
  return `--ind-accent:${accent};--ind-comp-gradient:${compositionGradient(composition)};`;
}

export function renderHeatSelect(seed: string): string {
  const current = selectedHeatMode(seed);
  return `
    <label class="ind-heat-control">
      <span>Heat</span>
      <select class="ind-heat-select" data-heat-for="${seed}">
        ${HEAT_OPTIONS.map((option) => `<option value="${option.id}" ${option.id === current ? "selected" : ""}>${option.label}</option>`).join("")}
      </select>
    </label>
  `;
}

export function selectedProcessQty(cargoIndex: number, maxQty: number): number {
  const key = String(cargoIndex);
  const raw = stationState.indProcessQty[key];
  if (!Number.isFinite(raw)) return 1;
  return Math.max(1, Math.min(maxQty, Math.floor(raw)));
}

export function ioPill(pool: IndustryPool, key: string, qty: number, showStock: boolean): string {
  const label = escHtml(poolItemLabel(pool, key));
  const stock = stockOf(pool, key);
  const icon = iconSvg(key, 14);
  const insufficient = showStock && stock + 1e-6 < qty;
  const stockText = showStock ? ` <em>${pool === "material" ? formatVolume(stock) : stock}</em>` : "";
  return `<span class="io-pill io-pill--${pool} ${insufficient ? "insufficient" : ""}">${icon}${formatQty(pool, qty)} ${label}${stockText}</span>`;
}

export function canAffordRecipe(recipeId: string, qty: number): boolean {
  const recipe = RECIPES.find((entry) => entry.id === recipeId);
  if (!recipe) return false;
  return recipe.inputs.every((input) => stockOf(input.pool, input.key) >= input.qty * qty);
}

export function formatTime(seconds: number): string {
  if (seconds < 1) return "<1s";
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  return `${minutes}m ${secs}s`;
}

export function aggregateCargoMaterials() {
  const byKey = new Map<string, { key: string; label: string; volumeM3: number; massKg: number; purpose: string; composition: Record<string, number>; compatibleFamilyIds: string[]; tags: string[] }>();
  for (const stack of materialStacks()) {
    const key = stack.alloyFamilyId ?? stack.materialId;
    const family = getAlloyFamilies().find((entry) => entry.id === key);
    const discovered = getState().player.alloyCodex?.discoveries.find((entry) => entry.id === key);
    const existing = byKey.get(key);
    if (existing) {
      existing.volumeM3 += stack.volumeM3;
      existing.massKg += stack.massKg;
      continue;
    }
    byKey.set(key, {
      key,
      label: discovered?.label ?? poolItemLabel("material", key),
      volumeM3: stack.volumeM3,
      massKg: stack.massKg,
      purpose: discovered?.purpose ?? family?.purpose ?? stack.kind,
      composition: { ...stack.composition },
      compatibleFamilyIds: discovered?.compatibleFamilyIds ?? (family ? [family.id] : []),
      tags: discovered?.tags ?? family?.tags ?? [],
    });
  }
  return [...byKey.values()].sort((a, b) => b.volumeM3 - a.volumeM3 || a.label.localeCompare(b.label));
}

export interface GroupedRefineryMaterial {
  key: string;
  label: string;
  purpose: string;
  kind: "processed" | "alloy" | "customBlend";
  count: number;
  volumeM3: number;
  massKg: number;
  composition: Record<string, number>;
  sourceIds: string[];
  representativeId: string;
  compatibleFamilyIds: string[];
  tags: string[];
}

export interface BlendPreview {
  composition: Record<string, number>;
  massKg: number;
  volumeM3: number;
  familyMatches: ReturnType<typeof assessAlloyFamilies>;
  discoveryMatch: {
    label: string;
    purpose: string;
    tags: string[];
    fitPct: number;
  } | null;
  compatibleFamilyIds: string[];
}

export function groupRefineryMaterials(kind?: GroupedRefineryMaterial["kind"]): GroupedRefineryMaterial[] {
  const grouped = new Map<string, GroupedRefineryMaterial>();
  for (const stack of refineryMaterials()) {
    if (kind && stack.kind !== kind) continue;
    const key = `${stack.kind}|${stack.alloyFamilyId ?? stack.materialId}|${JSON.stringify(stack.composition)}`;
    const family = getAlloyFamilies().find((entry) => entry.id === (stack.alloyFamilyId ?? stack.materialId));
    const discovery = getState().player.alloyCodex?.discoveries.find((entry) => entry.id === (stack.alloyFamilyId ?? stack.materialId));
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
      existing.volumeM3 += stack.volumeM3;
      existing.massKg += stack.massKg;
      existing.sourceIds.push(stack.id);
      continue;
    }
    grouped.set(key, {
      key,
      label: discovery?.label ?? stack.label,
      purpose: discovery?.purpose ?? family?.purpose ?? stack.kind,
      kind: stack.kind,
      count: 1,
      volumeM3: stack.volumeM3,
      massKg: stack.massKg,
      composition: { ...stack.composition },
      sourceIds: [stack.id],
      representativeId: stack.id,
      compatibleFamilyIds: discovery?.compatibleFamilyIds ?? (family ? [family.id] : []),
      tags: discovery?.tags ?? family?.tags ?? [],
    });
  }
  return [...grouped.values()].sort((a, b) => b.volumeM3 - a.volumeM3 || a.label.localeCompare(b.label));
}

export function buildBlendPreview(materials: GroupedRefineryMaterial[]): BlendPreview {
  const totalMassKg = materials.reduce((sum, entry) => sum + entry.massKg, 0);
  const totalVolumeM3 = materials.reduce((sum, entry) => sum + entry.volumeM3, 0);
  const weighted: Record<string, number> = {};
  if (totalMassKg > 0) {
    for (const material of materials) {
      for (const [oreKey, fraction] of Object.entries(material.composition)) {
        weighted[oreKey] = (weighted[oreKey] ?? 0) + (fraction * material.massKg);
      }
    }
  }
  const composition = totalMassKg > 0
    ? Object.fromEntries(
      Object.entries(weighted)
        .map(([oreKey, value]): [string, number] => [oreKey, value / totalMassKg])
        .filter(([, value]) => value > 0.0001),
    )
    : { iron: 1 };
  const familyMatches = assessAlloyFamilies(composition, 0.06);
  const codex = getState().player.alloyCodex;
  const discoveryMatch = (codex?.discoveries ?? [])
    .map((entry) => {
      let diff = 0;
      const keys = new Set([...Object.keys(entry.composition), ...Object.keys(composition)]);
      for (const key of keys) diff += Math.abs((entry.composition[key] ?? 0) - (composition[key] ?? 0));
      const fitPct = Math.max(0, 100 - diff * 120);
      return {
        label: entry.label,
        purpose: entry.purpose,
        tags: entry.tags ?? [],
        fitPct,
      };
    })
    .filter((entry) => entry.fitPct >= 55)
    .sort((a, b) => b.fitPct - a.fitPct || a.label.localeCompare(b.label))[0] ?? null;
  const compatibleFamilyIds = new Set<string>();
  for (const material of materials) {
    for (const familyId of material.compatibleFamilyIds) compatibleFamilyIds.add(familyId);
  }
  return {
    composition,
    massKg: totalMassKg,
    volumeM3: totalVolumeM3,
    familyMatches,
    discoveryMatch,
    compatibleFamilyIds: [...compatibleFamilyIds],
  };
}

export function refineryZoneSummaries() {
  const units = refineryStorageUnits();
  const zones = [
    { kind: "intake" as const, label: "Intake", units: units.filter((unit) => unit.kind === "intake") },
    { kind: "processed" as const, label: "Processed Stock", units: units.filter((unit) => unit.kind === "processed") },
    { kind: "separated" as const, label: "Separated Streams", units: units.filter((unit) => unit.kind === "separated") },
    { kind: "alloy" as const, label: "Alloy Reservoirs", units: units.filter((unit) => unit.kind === "alloy") },
  ];
  return zones.map((zone) => {
    const entries = zone.units.flatMap((unit) => unit.entries ?? []);
    const totalVolumeM3 = entries.reduce((sum, entry) => sum + entry.volumeM3, 0);
    const totalMassKg = entries.reduce((sum, entry) => sum + entry.massKg, 0);
    const dominant = entries.length ? aggregateStorageComposition({ id: "", label: "", kind: zone.kind, capacityM3: 0, entries }) : null;
    const dominantLabel = dominant
      ? Object.entries(dominant).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([oreKey]) => poolItemLabel("ore", oreKey)).join(" / ")
      : "No stock";
    return {
      ...zone,
      entries,
      totalVolumeM3,
      totalMassKg,
      dominantLabel,
    };
  });
}

export function refineryHoldingsSummary() {
  const mixed = getState().player.mixedOreCargo ?? [];
  const cargoMaterial = aggregateCargoMaterials();
  const grouped = groupRefineryMaterials();
  const processed = grouped.filter((entry) => entry.kind === "processed" && Object.keys(entry.composition).length > 1);
  const separated = grouped.filter((entry) => entry.kind === "processed" && Object.keys(entry.composition).length === 1);
  const alloy = grouped.filter((entry) => entry.kind !== "processed");
  return {
    mixedOreQty: mixed.reduce((sum, entry) => sum + entry.qty, 0),
    mixedOreTypes: mixed.length,
    processedVolumeM3: processed.reduce((sum, entry) => sum + entry.volumeM3, 0),
    separatedVolumeM3: separated.reduce((sum, entry) => sum + entry.volumeM3, 0),
    alloyVolumeM3: alloy.reduce((sum, entry) => sum + entry.volumeM3, 0),
    cargoMaterialVolumeM3: cargoMaterial.reduce((sum, entry) => sum + entry.volumeM3, 0),
    cargoMaterialMassKg: cargoMaterial.reduce((sum, entry) => sum + entry.massKg, 0),
  };
}

export function fabricationReadyMaterials() {
  const materialGroups = groupRefineryMaterials();
  return materialGroups.filter((entry) =>
    RECIPES.some((recipe) =>
      recipe.inputs.some((input) => input.pool === "material" && entry.compatibleFamilyIds.includes(input.key)),
    ),
  );
}

export function refineryStorageSummary(unit: RefineryStorageUnit): {
  usedM3: number;
  fillPct: number;
  compositionText: string;
  totalMassKg: number;
  dominantLabel: string;
} {
  const usedM3 = storageUsedVolumeM3(unit);
  const fillPct = storageFillPct(unit);
  const totalMassKg = (unit.entries ?? []).reduce((sum, entry) => sum + entry.massKg, 0);
  const composition = aggregateStorageComposition(unit);
  const entries = Object.entries(composition).sort((a, b) => b[1] - a[1]);
  const dominantLabel = entries[0] ? poolItemLabel("ore", entries[0][0]) : "Empty";
  const compositionText = entries
    .filter(([, fraction]) => fraction > 0.08)
    .slice(0, 3)
    .map(([oreKey, fraction]) => `${poolItemLabel("ore", oreKey)} ${Math.round(fraction * 100)}%`)
    .join(" · ");
  return { usedM3, fillPct, compositionText, totalMassKg, dominantLabel };
}

export function renderRefineryStockEmpty(message: string): string {
  return `<div class="ind-stage-empty">${escHtml(message)}</div>`;
}

export function renderCompositionBars(composition: Record<string, number>): string {
  const entries = Object.entries(composition)
    .sort((a, b) => b[1] - a[1])
    .filter(([, value]) => value > 0.03);
  return `
    <div class="ind-comp-bars">
      ${entries.map(([key, value]) => `
        <div class="ind-comp-row">
          <div class="ind-comp-row-head">
            <span>${escHtml(poolItemLabel("ore", key))}</span>
            <span>${Math.round(value * 100)}%</span>
          </div>
          <div class="ind-comp-track"><div class="ind-comp-fill" style="width:${Math.max(6, value * 100)}%;background:${oreColor(key)}"></div></div>
        </div>
      `).join("")}
    </div>
  `;
}

export function renderCompositionRibbon(
  segments: Array<{
    label: string;
    composition: Record<string, number>;
    meta: string;
    tone?: "source" | "result" | "blend";
  }>,
): string {
  return `
    <div class="ind-comp-ribbon">
      ${segments.map((segment, index) => `
        <div class="ind-comp-ribbon-block ind-comp-ribbon-block--${segment.tone ?? "source"}" style="${compositionAccentVars(segment.composition)}">
          <div class="ind-comp-ribbon-head">
            <span>${escHtml(segment.label)}</span>
            <small>${escHtml(segment.meta)}</small>
          </div>
          <div class="ind-comp-ribbon-track">
            <div class="ind-comp-ribbon-fill" style="background:${compositionGradient(segment.composition)}"></div>
          </div>
        </div>
        ${index < segments.length - 1 ? `<div class="ind-comp-ribbon-arrow">→</div>` : ""}
      `).join("")}
    </div>
  `;
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

export function machineLabel(machineId: string): string {
  return MACHINES.find((machine) => machine.id === machineId)?.label ?? machineId;
}
