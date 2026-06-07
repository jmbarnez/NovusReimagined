import { ORE } from "../data/resources.js";
import type { BulkMaterialStack, RefiningHeatMode } from "../state.js";
import { normalizeComposition, type OreComposition } from "../utils/ore-naming.js";
import { HEAT_EFFICIENCY } from "./families.js";
import { averageDensityKgPerM3, materialLabelForComposition } from "./composition.js";
import { oreDensityKgPerM3 } from "./families.js";
import { resolveAlloyFamily } from "./assessment.js";

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
