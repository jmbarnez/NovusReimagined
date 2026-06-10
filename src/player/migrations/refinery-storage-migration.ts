import type { Player } from "../../state.js";
import { flattenStorageMaterials, makeDefaultRefineryStorage, preferredStorageForMaterial } from "../../refinery/index.js";

export function migrateRefineryStorage(p: Player): void {
  if (!Array.isArray(p.refineryStorage) || p.refineryStorage.length === 0) {
    p.refineryStorage = makeDefaultRefineryStorage();
  } else {
    p.refineryStorage = p.refineryStorage.map((unit) => ({
      ...unit,
      entries: (unit.entries ?? []).map((entry) => ({
        ...entry,
        composition: { ...entry.composition },
      })),
    }));
  }

  const legacyMaterials = Array.isArray(p.hubDeposit?.materials) ? [...p.hubDeposit.materials] : [];
  if (legacyMaterials.length > 0 && flattenStorageMaterials(p.refineryStorage).length === 0) {
    for (const stack of legacyMaterials) {
      const target = preferredStorageForMaterial(stack, p.refineryStorage);
      if (!target) continue;
      target.entries.push({
        ...stack,
        composition: { ...stack.composition },
      });
    }
  }

  if (!p.hubDeposit || typeof p.hubDeposit !== "object") p.hubDeposit = { raw: [], ore: {}, materials: [], loot: {}, modules: [] };
  p.hubDeposit.materials = flattenStorageMaterials(p.refineryStorage);
}
