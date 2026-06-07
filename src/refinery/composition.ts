import { ORE, VOL } from "../data/resources.js";
import type { BulkMaterialStack } from "../state.js";
import { normalizeComposition, sortedCompositionEntries, type OreComposition } from "../utils/ore-naming.js";
import { oreDensityKgPerM3 } from "./families.js";

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

export function materialLabelForComposition(composition: OreComposition): string {
  const sorted = sortedCompositionEntries(composition);
  const first = sorted[0]?.[0] ?? "iron";
  const second = sorted[1]?.[0];
  if (!second || (sorted[1]?.[1] ?? 0) < 0.16) {
    return `${ORE[first]?.label ?? first} stock`;
  }
  return `${ORE[first]?.abbr ?? first}-${ORE[second]?.abbr ?? second} stock`;
}
