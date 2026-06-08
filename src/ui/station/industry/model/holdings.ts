import { getState } from "../../../../state-access.js";
import { getAlloyFamilies, aggregateStorageComposition, storageFillPct, storageUsedVolumeM3 } from "../../../../refinery/index.js";
import { poolItemLabel } from "../../../../data/industryRecipes.js";
import type { RefineryStorageUnit } from "../../../../state.js";
import { materialStacks, refineryStorageUnits } from "./state.js";
import { groupRefineryMaterials } from "./composition.js";

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
