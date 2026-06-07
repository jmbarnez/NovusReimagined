import type { Player, BulkMaterialStack, RefiningHeatMode } from "../state.js";
import { getState } from "../state-access.js";
import { PlayerAccess } from "../state-access.js";
import { logEvent } from "../feedback.js";
import { C } from "../config/index.js";
import { normalizeComposition, type OreComposition } from "../utils/ore-naming.js";
import { averageDensityKgPerM3, materialLabelForComposition } from "./composition.js";

export const DEFAULT_HEAT_MODE: RefiningHeatMode = "stable";

export function createMaterialStack(input: Omit<BulkMaterialStack, "id">): BulkMaterialStack {
  return {
    id: `mat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ...input,
    composition: { ...normalizeComposition(input.composition) },
  };
}

export function asteroidMatterMassKg(rawMass: number, composition: OreComposition): number {
  return Math.max(180, rawMass * 0.05 * averageDensityKgPerM3(composition));
}

export function processJobDuration(massKg: number): number {
  return C.HUB.ASTEROID_PROCESS_BASE + massKg / Math.max(1, C.HUB.ASTEROID_PROCESS_PER_MASS * 16);
}

export function refinementHeatMode(mode?: RefiningHeatMode): RefiningHeatMode {
  return mode === "cool" || mode === "hot" ? mode : "stable";
}

export function skillUnlockBonus(skillLevel: number): number {
  return 1 + Math.min(0.2, skillLevel * 0.03);
}

export function findHubMaterial(p: Player, materialId: string): BulkMaterialStack | null {
  return PlayerAccess.getRefineryStorageMaterial(materialId, p).material;
}

export function storeRefineryMaterial(
  material: BulkMaterialStack,
  p: Player,
  preferredStorageId?: string | null,
): { stored: BulkMaterialStack | null; overflow: BulkMaterialStack | null; storageId: string | null } {
  return PlayerAccess.addRefineryStorageMaterial(material, p, preferredStorageId);
}

export function logStorageOverflow(label: string, overflow: BulkMaterialStack | null, p: Player): void {
  if (!overflow || overflow.volumeM3 <= 1e-4) return;
  if (p === getState().player) {
    logEvent(`${label} overflowed storage — ${overflow.volumeM3.toFixed(1)} m³ lost as slag`, "system");
  }
}

export function blendMaterials(materials: BulkMaterialStack[]): { composition: OreComposition; massKg: number; volumeM3: number } {
  const totalMassKg = materials.reduce((sum, material) => sum + material.massKg, 0);
  const totalVolumeM3 = materials.reduce((sum, material) => sum + material.volumeM3, 0);
  if (totalMassKg <= 0) return { composition: { iron: 1 }, massKg: 0, volumeM3: totalVolumeM3 };
  const weighted: Record<string, number> = {};
  for (const material of materials) {
    for (const [oreKey, fraction] of Object.entries(material.composition)) {
      weighted[oreKey] = (weighted[oreKey] ?? 0) + fraction * material.massKg;
    }
  }
  return {
    composition: normalizeComposition(
      Object.fromEntries(Object.entries(weighted).map(([oreKey, massKg]) => [oreKey, massKg / totalMassKg])),
    ),
    massKg: totalMassKg,
    volumeM3: totalVolumeM3,
  };
}
