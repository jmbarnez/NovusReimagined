/**
 * Player refinery storage and hub deposit accessors.
 *
 * Refinery storage holds processed/alloy material stacks across one or more
 * capacity-limited storage units. Hub deposit is the inbound staging area
 * (raw items, ore, loot, modules) plus a materials view that mirrors
 * refinery storage via {@link syncHubDepositMaterials}.
 *
 * The hub-deposit material helpers delegate to the refinery-storage add/
 * remove paths so the two views never diverge.
 */
import {
  _G,
  type Player,
  type HubDeposit,
  type HubDepositItem,
  type BulkMaterialStack,
  type RefineryStorageUnit,
  type AlloyCodex,
} from "../../../../state.js";
import type { ModuleInstance } from "../../../../types/moduleInstance.js";
import {
  flattenStorageMaterials,
  preferredStorageForMaterial,
  storageUsedVolumeM3,
} from "../../../../refinery/storage.js";
import { stackSignature } from "../../../../refinery/composition.js";

function cloneMaterialStack(stack: BulkMaterialStack): BulkMaterialStack {
  return {
    ...stack,
    composition: { ...stack.composition },
  };
}

function cloneStorageUnit(unit: RefineryStorageUnit): RefineryStorageUnit {
  return {
    ...unit,
    entries: (unit.entries ?? []).map(cloneMaterialStack),
  };
}

function syncHubDepositMaterials(p: Player): void {
  if (!p.hubDeposit) p.hubDeposit = { raw: [], ore: {}, materials: [], loot: {}, modules: [] };
  p.hubDeposit.materials = flattenStorageMaterials(p.refineryStorage).map(cloneMaterialStack);
}

function fitMaterialIntoStorage(
  stack: BulkMaterialStack,
  storage: RefineryStorageUnit,
): { stored: BulkMaterialStack | null; overflow: BulkMaterialStack | null } {
  const freeM3 = Math.max(0, storage.capacityM3 - storageUsedVolumeM3(storage));
  if (freeM3 <= 1e-6) return { stored: null, overflow: cloneMaterialStack(stack) };
  const storedVolumeM3 = Math.min(stack.volumeM3, freeM3);
  const ratio = storedVolumeM3 / Math.max(stack.volumeM3, 1e-6);
  const stored: BulkMaterialStack = {
    ...cloneMaterialStack(stack),
    volumeM3: storedVolumeM3,
    massKg: stack.massKg * ratio,
  };
  if (ratio >= 0.999999) return { stored, overflow: null };
  const overflow: BulkMaterialStack = {
    ...cloneMaterialStack(stack),
    volumeM3: Math.max(0, stack.volumeM3 - stored.volumeM3),
    massKg: Math.max(0, stack.massKg - stored.massKg),
  };
  return { stored, overflow };
}

function removeRefineryStorageMaterialCore(
  materialId: string,
  p: Player,
): { material: BulkMaterialStack | null; storageId: string | null } {
  for (const unit of p.refineryStorage ?? []) {
    const idx = unit.entries.findIndex((entry) => entry.id === materialId);
    if (idx === -1) continue;
    const [removed] = unit.entries.splice(idx, 1);
    syncHubDepositMaterials(p);
    return { material: removed ? cloneMaterialStack(removed) : null, storageId: unit.id };
  }
  return { material: null, storageId: null };
}

function addRefineryStorageMaterialCore(
  stack: BulkMaterialStack,
  p: Player,
  preferredStorageId?: string | null,
): { stored: BulkMaterialStack | null; overflow: BulkMaterialStack | null; storageId: string | null } {
  if (!p.refineryStorage) p.refineryStorage = [];
  const target = preferredStorageForMaterial(stack, p.refineryStorage, preferredStorageId) ?? null;
  if (!target) return { stored: null, overflow: cloneMaterialStack(stack), storageId: null };
  const { stored, overflow } = fitMaterialIntoStorage(stack, target);
  if (stored) {
    const signature = stackSignature(stored);
    const existing = target.entries.find((entry) => stackSignature(entry) === signature);
    if (existing) {
      existing.volumeM3 += stored.volumeM3;
      existing.massKg += stored.massKg;
    } else {
      target.entries.push(cloneMaterialStack(stored));
    }
  }
  syncHubDepositMaterials(p);
  return { stored, overflow, storageId: target.id };
}

export const playerRefineryStorageAccess = {
  setRefineryStorage(storage: RefineryStorageUnit[], p: Player = _G.P) {
    p.refineryStorage = storage.map(cloneStorageUnit);
    syncHubDepositMaterials(p);
  },

  setAlloyCodex(codex: AlloyCodex, p: Player = _G.P) {
    p.alloyCodex = {
      knownFamilyIds: [...(codex.knownFamilyIds ?? [])],
      discoveries: (codex.discoveries ?? []).map((entry) => ({
        ...entry,
        composition: { ...entry.composition },
        compatibleFamilyIds: [...entry.compatibleFamilyIds],
        tags: [...entry.tags],
      })),
    };
  },

  addRefineryStorageMaterial(
    stack: BulkMaterialStack,
    p: Player = _G.P,
    preferredStorageId?: string | null,
  ): { stored: BulkMaterialStack | null; overflow: BulkMaterialStack | null; storageId: string | null } {
    return addRefineryStorageMaterialCore(stack, p, preferredStorageId);
  },

  removeRefineryStorageMaterial(
    materialId: string,
    p: Player = _G.P,
  ): { material: BulkMaterialStack | null; storageId: string | null } {
    return removeRefineryStorageMaterialCore(materialId, p);
  },

  getRefineryStorageMaterial(
    materialId: string,
    p: Player = _G.P,
  ): { material: BulkMaterialStack | null; storageId: string | null } {
    for (const unit of p.refineryStorage ?? []) {
      const found = unit.entries.find((entry) => entry.id === materialId);
      if (found) return { material: cloneMaterialStack(found), storageId: unit.id };
    }
    return { material: null, storageId: null };
  },

  removeRefineryStorageMaterials(
    materialIds: string[],
    p: Player = _G.P,
  ): { materials: BulkMaterialStack[]; storageIds: string[] } {
    const materials: BulkMaterialStack[] = [];
    const storageIds = new Set<string>();
    for (const id of materialIds) {
      const removed = removeRefineryStorageMaterialCore(id, p);
      if (removed.material) {
        materials.push(removed.material);
        if (removed.storageId) storageIds.add(removed.storageId);
      }
    }
    syncHubDepositMaterials(p);
    return { materials, storageIds: [...storageIds] };
  },

  setHubDeposit(deposit: HubDeposit, p: Player = _G.P) {
    p.hubDeposit = deposit;
  },

  addHubDepositItem(item: HubDepositItem, p: Player = _G.P) {
    if (!p.hubDeposit) p.hubDeposit = { raw: [], ore: {}, materials: [], loot: {}, modules: [] };
    if (!p.hubDeposit.raw) p.hubDeposit.raw = [];
    p.hubDeposit.raw.push(item);
  },

  removeHubDepositItem(id: string, p: Player = _G.P): boolean {
    if (!p.hubDeposit?.raw) return false;
    const idx = p.hubDeposit.raw.findIndex((i) => i.id === id);
    if (idx === -1) return false;
    p.hubDeposit.raw.splice(idx, 1);
    return true;
  },

  setHubDepositOre(type: string, value: number, p: Player = _G.P) {
    if (!p.hubDeposit) p.hubDeposit = { raw: [], ore: {}, materials: [], loot: {}, modules: [] };
    if (!p.hubDeposit.ore) p.hubDeposit.ore = {};
    p.hubDeposit.ore[type] = value;
  },

  setHubDepositLoot(type: string, value: number, p: Player = _G.P) {
    if (!p.hubDeposit) p.hubDeposit = { raw: [], ore: {}, materials: [], loot: {}, modules: [] };
    if (!p.hubDeposit.loot) p.hubDeposit.loot = {};
    p.hubDeposit.loot[type] = value;
  },

  /** Hub-deposit materials mirror refinery storage — delegate to the storage add path. */
  addHubDepositMaterial(stack: BulkMaterialStack, p: Player = _G.P) {
    addRefineryStorageMaterialCore(stack, p);
  },

  /** Hub-deposit materials mirror refinery storage — delegate to the storage remove path. */
  removeHubDepositMaterial(id: string, p: Player = _G.P): BulkMaterialStack | null {
    return removeRefineryStorageMaterialCore(id, p).material;
  },

  addHubDepositModule(inst: ModuleInstance, p: Player = _G.P) {
    if (!p.hubDeposit) p.hubDeposit = { raw: [], ore: {}, materials: [], loot: {}, modules: [] };
    if (!p.hubDeposit.modules) p.hubDeposit.modules = [];
    p.hubDeposit.modules.push(inst);
  },
};
