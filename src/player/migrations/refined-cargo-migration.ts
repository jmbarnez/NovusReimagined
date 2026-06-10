import type { Player } from "../../state.js";
import { PlayerAccess } from "../../state-access.js";
import { ALLOY_FAMILIES } from "../../refinery/index.js";

type LegacyRefinedPool = Partial<Record<"bar" | "lattice" | "condensate", number>>;

export function migrateLegacyRefinedCargo(refined: LegacyRefinedPool | undefined, p: Player): void {
  if (!refined) return;
  const mappings: Array<{ key: keyof LegacyRefinedPool; familyId: string; composition: Record<string, number> }> = [
    { key: "bar", familyId: "ferro_nickel_stock", composition: { iron: 0.64, nickel: 0.24, carbon: 0.08, silicate: 0.04 } },
    { key: "lattice", familyId: "crystal_matrix", composition: { crystal: 0.62, silicate: 0.24, nickel: 0.08, iron: 0.06 } },
    { key: "condensate", familyId: "exotic_conductive", composition: { exotic: 0.3, crystal: 0.3, nickel: 0.2, iron: 0.12, carbon: 0.08 } },
  ];
  for (const mapping of mappings) {
    const qty = refined[mapping.key] ?? 0;
    if (qty <= 0) continue;
    const family = ALLOY_FAMILIES.find((entry) => entry.id === mapping.familyId);
    if (!family) continue;
    PlayerAccess.addBulkMaterial({
      id: `legacy-${mapping.key}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      materialId: family.id,
      kind: "alloy",
      label: family.label,
      volumeM3: qty,
      massKg: qty * family.densityKgPerM3,
      composition: { ...mapping.composition },
      alloyFamilyId: family.id,
    }, p);
  }
}
