import { ORE, VOL } from "./data/resources.js";
import type { AlloyCodex, BulkMaterialStack, DiscoveredAlloy, RefineryStorageUnit, RefiningHeatMode } from "./state.js";
import { normalizeComposition, sortedCompositionEntries, type OreComposition } from "./utils/ore-naming.js";

export interface AlloyFamily {
  id: string;
  label: string;
  densityKgPerM3: number;
  purpose: string;
  windows: Partial<Record<string, { min: number; max: number }>>;
  traceLimit?: number;
  tags?: string[];
}

const ORE_DENSITY_KG_PER_M3: Record<string, number> = {
  iron: 7850,
  nickel: 8900,
  silicate: 2600,
  carbon: 2100,
  crystal: 3200,
  exotic: 5400,
};

const HEAT_EFFICIENCY: Record<RefiningHeatMode, { process: number; separate: number; alloy: number; tolerance: number }> = {
  cool: { process: 0.94, separate: 0.95, alloy: 0.92, tolerance: 0.02 },
  stable: { process: 1.0, separate: 1.0, alloy: 1.0, tolerance: 0.06 },
  hot: { process: 1.03, separate: 0.91, alloy: 1.04, tolerance: 0.03 },
};

export const ALLOY_FAMILIES: AlloyFamily[] = [
  {
    id: "ferro_nickel_stock",
    label: "Ferro-nickel stock",
    densityKgPerM3: 8150,
    purpose: "Structural frames",
    tags: ["structural", "frame", "gear"],
    traceLimit: 0.12,
    windows: {
      iron: { min: 0.46, max: 0.74 },
      nickel: { min: 0.18, max: 0.42 },
      carbon: { min: 0.0, max: 0.12 },
      silicate: { min: 0.0, max: 0.14 },
      crystal: { min: 0.0, max: 0.08 },
      exotic: { min: 0.0, max: 0.05 },
    },
  },
  {
    id: "carbon_steel_stock",
    label: "Carbon steel stock",
    densityKgPerM3: 7820,
    purpose: "Hull plating",
    tags: ["structural", "hull", "plate"],
    traceLimit: 0.1,
    windows: {
      iron: { min: 0.55, max: 0.84 },
      carbon: { min: 0.08, max: 0.24 },
      nickel: { min: 0.0, max: 0.16 },
      silicate: { min: 0.0, max: 0.12 },
      crystal: { min: 0.0, max: 0.05 },
      exotic: { min: 0.0, max: 0.04 },
    },
  },
  {
    id: "crystal_matrix",
    label: "Crystal matrix stock",
    densityKgPerM3: 3650,
    purpose: "Sensor and lattice assemblies",
    tags: ["sensor", "lattice", "electronics"],
    traceLimit: 0.12,
    windows: {
      crystal: { min: 0.44, max: 0.76 },
      silicate: { min: 0.12, max: 0.34 },
      nickel: { min: 0.0, max: 0.16 },
      iron: { min: 0.0, max: 0.18 },
      exotic: { min: 0.0, max: 0.12 },
      carbon: { min: 0.0, max: 0.08 },
    },
  },
  {
    id: "exotic_conductive",
    label: "Exotic conductive blend",
    densityKgPerM3: 4720,
    purpose: "Power and guidance hardware",
    tags: ["conductive", "power", "guidance"],
    traceLimit: 0.14,
    windows: {
      exotic: { min: 0.18, max: 0.44 },
      crystal: { min: 0.18, max: 0.42 },
      nickel: { min: 0.05, max: 0.26 },
      iron: { min: 0.0, max: 0.18 },
      carbon: { min: 0.0, max: 0.1 },
      silicate: { min: 0.0, max: 0.12 },
    },
  },
];

export function oreDensityKgPerM3(key: string): number {
  return ORE_DENSITY_KG_PER_M3[key] ?? 4000;
}

export function averageOreUnitVolumeM3(composition: OreComposition): number {
  const normalized = normalizeComposition(composition);
  return Object.entries(normalized).reduce((sum, [key, fraction]) => {
    const unitVolume = VOL.ore[key as keyof typeof VOL.ore] ?? 0.15;
    return sum + unitVolume * fraction;
  }, 0);
}

export function averageDensityKgPerM3(composition: OreComposition): number {
  const normalized = normalizeComposition(composition);
  return Object.entries(normalized).reduce((sum, [key, fraction]) => sum + oreDensityKgPerM3(key) * fraction, 0);
}

export function estimateMixedOreCargoVolumeM3(qty: number, composition: OreComposition): number {
  return qty * averageOreUnitVolumeM3(composition);
}

export function estimateMixedOreCargoMassKg(qty: number, composition: OreComposition): number {
  const volume = estimateMixedOreCargoVolumeM3(qty, composition);
  return volume * averageDensityKgPerM3(composition);
}

export function estimateCargoMaterialMassKg(materials: BulkMaterialStack[] | undefined): number {
  return (materials ?? []).reduce((sum, stack) => sum + stack.massKg, 0);
}

export function normalizeCompositionKey(composition: OreComposition): string {
  const normalized = normalizeComposition(composition);
  return JSON.stringify(
    Object.entries(normalized)
      .map(([key, fraction]) => [key, Math.round(fraction * 100) / 100] as const)
      .filter(([, fraction]) => fraction > 0)
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

export function stackSignature(material: Pick<BulkMaterialStack, "kind" | "materialId" | "alloyFamilyId" | "composition">): string {
  return [
    material.kind,
    material.materialId,
    material.alloyFamilyId ?? "",
    normalizeCompositionKey(material.composition),
  ].join("|");
}

function quantizedCompositionEntries(composition: OreComposition): [string, number][] {
  const normalized = normalizeComposition(composition);
  return Object.entries(normalized)
    .map(([key, fraction]) => [key, Math.round(fraction * 20) / 20] as [string, number])
    .filter(([, fraction]) => fraction > 0)
    .sort(([a], [b]) => a.localeCompare(b));
}

export function discoverySignatureKey(composition: OreComposition): string {
  return JSON.stringify(quantizedCompositionEntries(composition));
}

function dominantPurposeTag(composition: OreComposition): string[] {
  const assessments = assessAlloyFamilies(composition, 0.04)
    .filter((entry) => entry.score != null && entry.fitPct >= 54)
    .slice(0, 2);
  const tags = new Set<string>();
  for (const assessment of assessments) {
    for (const tag of assessment.family.tags ?? []) tags.add(tag);
  }
  return tags.size ? [...tags] : ["experimental"];
}

function discoveredAlloyLabel(composition: OreComposition): string {
  const sorted = sortedCompositionEntries(composition);
  const first = sorted[0]?.[0] ?? "iron";
  const second = sorted[1]?.[0] ?? "carbon";
  return `${ORE[first]?.abbr ?? first}-${ORE[second]?.abbr ?? second} intermediate`;
}

export function createDiscoveredAlloy(composition: OreComposition, discoveredAt: number): DiscoveredAlloy {
  const normalized = normalizeComposition(composition);
  const compatibleFamilies = assessAlloyFamilies(normalized, 0.04)
    .filter((entry) => entry.score != null && entry.fitPct >= 52)
    .slice(0, 2)
    .map((entry) => entry.family.id);
  const tags = dominantPurposeTag(normalized);
  return {
    id: `disc-${Math.abs(hashString(discoverySignatureKey(normalized))).toString(36)}`,
    label: discoveredAlloyLabel(normalized),
    signatureKey: discoverySignatureKey(normalized),
    composition: normalized,
    densityKgPerM3: averageDensityKgPerM3(normalized) * 0.99,
    purpose: compatibleFamilies.length
      ? compatibleFamilies
        .map((familyId) => ALLOY_FAMILIES.find((family) => family.id === familyId)?.purpose)
        .filter((value): value is string => !!value)
        .join(" / ")
      : "Experimental systems stock",
    tags,
    compatibleFamilyIds: compatibleFamilies,
    discoveredAt,
    seenCount: 1,
  };
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export function makeDefaultAlloyCodex(): AlloyCodex {
  return {
    knownFamilyIds: ALLOY_FAMILIES.map((family) => family.id),
    discoveries: [],
  };
}

export function makeDefaultRefineryStorage(): RefineryStorageUnit[] {
  return [
    { id: "intake-hopper-a", label: "Intake Hopper A", kind: "intake", capacityM3: 9, entries: [], notes: "Mixed feed intake" },
    { id: "processed-tank-a", label: "Process Tank A", kind: "processed", capacityM3: 14, entries: [], notes: "Primary processed stock tank" },
    { id: "processed-tank-b", label: "Process Tank B", kind: "processed", capacityM3: 14, entries: [], notes: "Secondary processed stock tank" },
    { id: "separated-iron", label: "Iron Bin", kind: "separated", capacityM3: 10, entries: [], preferredOreKey: "iron" },
    { id: "separated-nickel", label: "Nickel Bin", kind: "separated", capacityM3: 10, entries: [], preferredOreKey: "nickel" },
    { id: "separated-carbon", label: "Carbon Bin", kind: "separated", capacityM3: 9, entries: [], preferredOreKey: "carbon" },
    { id: "separated-crystal", label: "Crystal Bin", kind: "separated", capacityM3: 9, entries: [], preferredOreKey: "crystal" },
    { id: "separated-silicate", label: "Silicate Bin", kind: "separated", capacityM3: 9, entries: [], preferredOreKey: "silicate" },
    { id: "separated-exotic", label: "Exotic Bin", kind: "separated", capacityM3: 8, entries: [], preferredOreKey: "exotic" },
    { id: "alloy-reservoir-a", label: "Alloy Reservoir A", kind: "alloy", capacityM3: 12, entries: [], notes: "Main alloy output" },
    { id: "alloy-reservoir-b", label: "Alloy Reservoir B", kind: "alloy", capacityM3: 12, entries: [], notes: "Secondary alloy output" },
  ];
}

export function flattenStorageMaterials(storage: RefineryStorageUnit[] | undefined): BulkMaterialStack[] {
  const out: BulkMaterialStack[] = [];
  for (const unit of storage ?? []) {
    for (const entry of unit.entries ?? []) out.push({ ...entry, composition: { ...entry.composition } });
  }
  return out;
}

export function storageUsedVolumeM3(unit: RefineryStorageUnit): number {
  return (unit.entries ?? []).reduce((sum, entry) => sum + entry.volumeM3, 0);
}

export function storageFillPct(unit: RefineryStorageUnit): number {
  if (unit.capacityM3 <= 0) return 0;
  return Math.max(0, Math.min(1, storageUsedVolumeM3(unit) / unit.capacityM3));
}

export function aggregateStorageComposition(unit: RefineryStorageUnit): OreComposition {
  const totalMass = (unit.entries ?? []).reduce((sum, entry) => sum + entry.massKg, 0);
  if (totalMass <= 0) return { iron: 1 };
  const composition: Record<string, number> = {};
  for (const entry of unit.entries ?? []) {
    for (const [oreKey, fraction] of Object.entries(entry.composition)) {
      composition[oreKey] = (composition[oreKey] ?? 0) + fraction * entry.massKg;
    }
  }
  return normalizeComposition(
    Object.fromEntries(Object.entries(composition).map(([oreKey, weightedMass]) => [oreKey, weightedMass / totalMass])),
  );
}

export function materialMatchesRecipeMaterial(
  material: Pick<BulkMaterialStack, "materialId" | "alloyFamilyId">,
  key: string,
  codex?: AlloyCodex | null,
): boolean {
  if (material.materialId === key || material.alloyFamilyId === key) return true;
  const discovery = codex?.discoveries.find((entry) => entry.id === (material.alloyFamilyId ?? material.materialId));
  return discovery?.compatibleFamilyIds.includes(key) ?? false;
}

export function preferredStorageForMaterial(
  material: Pick<BulkMaterialStack, "kind" | "composition">,
  storage: RefineryStorageUnit[],
  preferredId?: string | null,
): RefineryStorageUnit | null {
  if (preferredId) {
    const preferred = storage.find((unit) => unit.id === preferredId) ?? null;
    if (preferred) return preferred;
  }
  const dominantOre = sortedCompositionEntries(material.composition)[0]?.[0];
  if (material.kind === "alloy" || material.kind === "customBlend") {
    return storage.find((unit) => unit.kind === "alloy") ?? null;
  }
  if (material.kind === "processed" && Object.keys(material.composition).length === 1 && dominantOre) {
    const exact = storage.find((unit) => unit.kind === "separated" && unit.preferredOreKey === dominantOre);
    if (exact) return exact;
  }
  return storage.find((unit) => unit.kind === "processed") ?? storage[0] ?? null;
}

export function upsertDiscoveredAlloy(codex: AlloyCodex, composition: OreComposition, now: number): DiscoveredAlloy {
  const signature = discoverySignatureKey(composition);
  const existing = codex.discoveries.find((entry) => entry.signatureKey === signature);
  if (existing) {
    existing.seenCount += 1;
    return existing;
  }
  const created = createDiscoveredAlloy(composition, now);
  codex.discoveries.push(created);
  return created;
}

function scoreAgainstFamily(composition: OreComposition, family: AlloyFamily, toleranceBonus: number): number | null {
  const normalized = normalizeComposition(composition);
  let score = 0;
  let totalTrace = 0;
  for (const [key, fraction] of Object.entries(normalized)) {
    const win = family.windows[key];
    if (!win) {
      totalTrace += fraction;
      score += fraction * 1.4;
      continue;
    }
    const min = Math.max(0, win.min - toleranceBonus);
    const max = Math.min(1, win.max + toleranceBonus);
    if (fraction < min) score += min - fraction;
    else if (fraction > max) score += fraction - max;
    if (fraction > win.max) totalTrace += Math.max(0, fraction - win.max);
  }
  if (family.traceLimit != null && totalTrace > family.traceLimit + toleranceBonus) return null;
  return score;
}

export interface AlloyFamilyAssessment {
  family: AlloyFamily;
  score: number | null;
  fitPct: number;
  tracePct: number;
  status: "match" | "near" | "off";
}

function traceOverrun(composition: OreComposition, family: AlloyFamily): number {
  const normalized = normalizeComposition(composition);
  let totalTrace = 0;
  for (const [key, fraction] of Object.entries(normalized)) {
    const win = family.windows[key];
    if (!win) {
      totalTrace += fraction;
      continue;
    }
    if (fraction > win.max) totalTrace += Math.max(0, fraction - win.max);
  }
  return totalTrace;
}

export function assessAlloyFamilies(
  composition: OreComposition,
  toleranceBonus: number,
): AlloyFamilyAssessment[] {
  return ALLOY_FAMILIES.map((family) => {
    const score = scoreAgainstFamily(composition, family, toleranceBonus);
    const tracePct = traceOverrun(composition, family);
    const fitPct = score == null
      ? Math.max(0, 60 - tracePct * 140)
      : Math.max(0, Math.min(100, 100 - score * 180));
    let status: AlloyFamilyAssessment["status"] = "off";
    if (score != null && fitPct >= 90) status = "match";
    else if (score != null && fitPct >= 68) status = "near";
    return {
      family,
      score,
      fitPct,
      tracePct,
      status,
    };
  }).sort((a, b) => {
    const aRank = a.status === "match" ? 0 : a.status === "near" ? 1 : 2;
    const bRank = b.status === "match" ? 0 : b.status === "near" ? 1 : 2;
    return aRank - bRank || b.fitPct - a.fitPct || a.family.label.localeCompare(b.family.label);
  });
}

export function resolveAlloyFamily(
  composition: OreComposition,
  targetFamilyId: string | null | undefined,
  toleranceBonus: number,
): AlloyFamily | null {
  if (targetFamilyId) {
    const target = ALLOY_FAMILIES.find((family) => family.id === targetFamilyId) ?? null;
    if (!target) return null;
    return scoreAgainstFamily(composition, target, toleranceBonus) == null ? null : target;
  }
  let best: AlloyFamily | null = null;
  let bestScore = Infinity;
  for (const family of ALLOY_FAMILIES) {
    const score = scoreAgainstFamily(composition, family, toleranceBonus);
    if (score == null) continue;
    if (score < bestScore) {
      best = family;
      bestScore = score;
    }
  }
  return best;
}

export function materialLabelForComposition(composition: OreComposition): string {
  const sorted = sortedCompositionEntries(composition);
  const first = sorted[0]?.[0] ?? "iron";
  const second = sorted[1]?.[0];
  if (!second || (sorted[1]?.[1] ?? 0) < 0.16) {
    return `${ORE[first]?.label ?? first} stock`;
  }
  return `${ORE[first]?.abbr ?? first}-${ORE[second]?.abbr ?? second} stock`;
}

function processEfficiency(skillLevel: number, richness: number, heatMode: RefiningHeatMode): number {
  const skillBonus = 0.58 + skillLevel * 0.035;
  const richnessBonus = Math.min(0.32, (richness - 1) * 0.06);
  return Math.max(0.42, skillBonus + richnessBonus) * HEAT_EFFICIENCY[heatMode].process;
}

export function processMixedSource(params: {
  sourceMassKg: number;
  composition: OreComposition;
  richness: number;
  skillLevel: number;
  heatMode: RefiningHeatMode;
}): { volumeM3: number; massKg: number; wasteMassKg: number; composition: OreComposition } {
  const composition = normalizeComposition(params.composition);
  const density = averageDensityKgPerM3(composition);
  const eff = processEfficiency(params.skillLevel, params.richness, params.heatMode);
  const retainedMassKg = Math.max(40, params.sourceMassKg * eff);
  const wasteMassKg = Math.max(0, params.sourceMassKg - retainedMassKg);
  return {
    volumeM3: retainedMassKg / density,
    massKg: retainedMassKg,
    wasteMassKg,
    composition,
  };
}

export function separateMaterial(params: {
  material: BulkMaterialStack;
  skillLevel: number;
  heatMode: RefiningHeatMode;
}): { outputs: Array<{ label: string; composition: OreComposition; volumeM3: number; massKg: number }>; wasteMassKg: number } {
  const eff = (0.74 + params.skillLevel * 0.025) * HEAT_EFFICIENCY[params.heatMode].separate;
  const normalized = normalizeComposition(params.material.composition);
  const outputs: Array<{ label: string; composition: OreComposition; volumeM3: number; massKg: number }> = [];
  let usedMassKg = 0;
  for (const [key, fraction] of Object.entries(normalized)) {
    if (fraction < 0.08) continue;
    const massKg = params.material.massKg * fraction * eff;
    if (massKg <= 0) continue;
    const composition = { [key]: 1 };
    const volumeM3 = massKg / oreDensityKgPerM3(key);
    usedMassKg += massKg;
    outputs.push({
      label: `${ORE[key]?.label ?? key} stock`,
      composition,
      volumeM3,
      massKg,
    });
  }
  return {
    outputs,
    wasteMassKg: Math.max(0, params.material.massKg - usedMassKg),
  };
}

export function alloyMaterial(params: {
  material: BulkMaterialStack;
  skillLevel: number;
  heatMode: RefiningHeatMode;
  targetFamilyId?: string | null;
}): {
  kind: BulkMaterialStack["kind"];
  materialId: string;
  label: string;
  alloyFamilyId?: string;
  volumeM3: number;
  massKg: number;
  composition: OreComposition;
  wasteMassKg: number;
} {
  const tolerance = Math.min(0.12, params.skillLevel * 0.008) + HEAT_EFFICIENCY[params.heatMode].tolerance;
  const family = resolveAlloyFamily(params.material.composition, params.targetFamilyId, tolerance);
  const eff = (0.88 + params.skillLevel * 0.015) * HEAT_EFFICIENCY[params.heatMode].alloy;
  const retainedMassKg = Math.max(10, params.material.massKg * eff);
  const wasteMassKg = Math.max(0, params.material.massKg - retainedMassKg);
  if (family) {
    return {
      kind: "alloy",
      materialId: family.id,
      alloyFamilyId: family.id,
      label: family.label,
      composition: normalizeComposition(params.material.composition),
      massKg: retainedMassKg,
      volumeM3: retainedMassKg / family.densityKgPerM3,
      wasteMassKg,
    };
  }
  const customLabel = `Custom ${materialLabelForComposition(params.material.composition)}`;
  const density = averageDensityKgPerM3(params.material.composition) * 0.98;
  return {
    kind: "customBlend",
    materialId: "custom_blend",
    label: customLabel,
    composition: normalizeComposition(params.material.composition),
    massKg: retainedMassKg,
    volumeM3: retainedMassKg / density,
    wasteMassKg,
  };
}
