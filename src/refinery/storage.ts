import type { AlloyCodex, BulkMaterialStack, RefineryStorageUnit } from "../state.js";
import { normalizeComposition, sortedCompositionEntries } from "../utils/ore-naming.js";

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

export function aggregateStorageComposition(unit: RefineryStorageUnit): Record<string, number> {
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
