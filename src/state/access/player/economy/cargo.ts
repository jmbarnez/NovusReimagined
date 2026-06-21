/**
 * Player cargo accessors: mixed-ore cargo and bulk material stacks.
 *
 * Mixed-ore cargo holds composition-tagged ore batches; bulk materials are
 * refined/processed stacks with volume and mass. Both coalesce matching
 * entries on add via `stackSignature`/composition normalization.
 */
import { _G, type Player, type MixedOreCargo, type BulkMaterialStack } from "../../../../state.js";
import { stackSignature } from "../../../../refinery/index.js";

export const playerCargoAccess = {
  addMixedOreCargo(cargo: MixedOreCargo, p: Player = _G.P) {
    if (!p.mixedOreCargo) p.mixedOreCargo = [];
    const normalizedKey = JSON.stringify(
      Object.entries(cargo.composition)
        .filter(([, value]) => value > 0)
        .sort(([a], [b]) => a.localeCompare(b)),
    );
    const cargoRichness = cargo.richness ?? 1;
    const existing = p.mixedOreCargo.find((slot) => {
      const slotKey = JSON.stringify(
        Object.entries(slot.composition)
          .filter(([, value]) => value > 0)
          .sort(([a], [b]) => a.localeCompare(b)),
      );
      const slotRichness = slot.richness ?? 1;
      return slot.name === cargo.name && slotKey === normalizedKey && slotRichness === cargoRichness;
    });
    if (existing) {
      existing.qty += cargo.qty;
      return;
    }
    p.mixedOreCargo.push({
      name: cargo.name,
      qty: cargo.qty,
      composition: { ...cargo.composition },
      richness: cargoRichness,
    });
  },

  setMixedOreCargo(cargo: MixedOreCargo[], p: Player = _G.P) {
    p.mixedOreCargo = cargo.map((slot) => ({
      name: slot.name,
      qty: slot.qty,
      composition: { ...slot.composition },
      richness: slot.richness ?? 1,
    }));
  },

  removeMixedOreCargo(index: number, qty: number, p: Player = _G.P): boolean {
    if (!p.mixedOreCargo?.[index] || qty <= 0) return false;
    const slot = p.mixedOreCargo[index];
    if (slot.qty < qty) return false;
    slot.qty -= qty;
    if (slot.qty <= 0) p.mixedOreCargo.splice(index, 1);
    return true;
  },

  addBulkMaterial(stack: BulkMaterialStack, p: Player = _G.P) {
    if (!p.bulkMaterialsCargo) p.bulkMaterialsCargo = [];
    const signature = stackSignature(stack);
    const existing = p.bulkMaterialsCargo.find((entry) => stackSignature(entry) === signature);
    if (existing) {
      existing.volumeM3 += stack.volumeM3;
      existing.massKg += stack.massKg;
      return;
    }
    p.bulkMaterialsCargo.push({
      ...stack,
      composition: { ...stack.composition },
    });
  },

  setBulkMaterialsCargo(stacks: BulkMaterialStack[], p: Player = _G.P) {
    p.bulkMaterialsCargo = stacks.map((stack) => ({
      ...stack,
      composition: { ...stack.composition },
    }));
  },

  removeBulkMaterial(index: number, p: Player = _G.P): boolean {
    if (!p.bulkMaterialsCargo?.[index]) return false;
    p.bulkMaterialsCargo.splice(index, 1);
    return true;
  },
};
