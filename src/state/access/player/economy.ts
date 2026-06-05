import {
  _G,
  type Player,
  type HubJob,
  type HubOutput,
  type HubDeposit,
  type HubDepositItem,
  type MixedOreCargo,
  type BulkMaterialStack,
  type RefineryStorageUnit,
  type AlloyCodex,
} from "../../../state.js";
import type { ModuleInstance } from "../../../types/moduleInstance.js";
import type { CraftJob } from "../../../data/industryRecipes.js";
import type { MissionContract } from "../../../data/missions.js";
import { flattenStorageMaterials, preferredStorageForMaterial, stackSignature, storageUsedVolumeM3 } from "../../../refining.js";

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

export const playerEconomyAccess = {
  modifyCredits(amount: number, p: Player = _G.P) {
    p.credits += amount;
  },

  setAmmo(type: "hybrid" | "missile", value: number, p: Player = _G.P) {
    p.ammo[type] = value;
  },

  setOre(type: string, value: number, p: Player = _G.P) {
    p.ore[type] = value;
  },

  setOreAll(ore: Record<string, number>, p: Player = _G.P) {
    p.ore = ore;
  },

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

  removeMixedOreCargo(index: number, qty: number, p: Player = _G.P): boolean {
    if (!p.mixedOreCargo?.[index] || qty <= 0) return false;
    const slot = p.mixedOreCargo[index];
    if (slot.qty < qty) return false;
    slot.qty -= qty;
    if (slot.qty <= 0) p.mixedOreCargo.splice(index, 1);
    return true;
  },

  setLoot(type: string, value: number, p: Player = _G.P) {
    p.loot[type] = value;
  },

  setLootAll(loot: Record<string, number>, p: Player = _G.P) {
    p.loot = loot;
  },

  setComponents(type: string, value: number, p: Player = _G.P) {
    p.components[type] = value;
  },

  setComponentsAll(components: Record<string, number>, p: Player = _G.P) {
    p.components = components;
  },

  setAmmoAll(ammo: { hybrid: number; missile: number }, p: Player = _G.P) {
    p.ammo = ammo;
  },

  setContracts(contracts: Player["contracts"], p: Player = _G.P) {
    p.contracts = contracts;
  },

  setStationOffers(offers: Player["stationOffers"], stationId: string | null, p: Player = _G.P) {
    p.stationOffers = offers;
    p.stationOfferStationId = stationId;
  },

  setCraftQueue(queue: Player["craftQueue"], p: Player = _G.P) {
    p.craftQueue = queue;
  },

  setBlueprint(id: string, owned: boolean, p: Player = _G.P) {
    p.blueprints[id] = owned;
  },

  setBlueprintsAll(blueprints: Record<string, boolean>, p: Player = _G.P) {
    p.blueprints = blueprints;
  },

  addCraftJob(job: CraftJob, p: Player = _G.P) {
    p.craftQueue.push(job);
  },

  removeCraftJob(index: number, p: Player = _G.P) {
    p.craftQueue.splice(index, 1);
  },

  addContract(contract: MissionContract, p: Player = _G.P) {
    p.contracts.push(contract);
  },

  removeContract(index: number, p: Player = _G.P) {
    p.contracts.splice(index, 1);
  },

  addHubJob(job: HubJob, p: Player = _G.P) {
    if (!p.hubQueue) p.hubQueue = [];
    p.hubQueue.push(job);
  },

  setHubQueue(queue: HubJob[], p: Player = _G.P) {
    p.hubQueue = queue;
  },

  spliceHubQueue(index: number, deleteCount: number, p: Player = _G.P) {
    if (!p.hubQueue) p.hubQueue = [];
    return p.hubQueue.splice(index, deleteCount);
  },

  setHubOutput(output: HubOutput, p: Player = _G.P) {
    p.hubOutput = output;
  },

  addHubOutputModule(inst: ModuleInstance, p: Player = _G.P) {
    if (!p.hubOutput) p.hubOutput = { loot: {}, ore: {}, materials: [], modules: [] };
    if (!p.hubOutput.modules) p.hubOutput.modules = [];
    p.hubOutput.modules.push(inst);
  },

  setHubOutputLoot(type: string, value: number, p: Player = _G.P) {
    if (!p.hubOutput) p.hubOutput = { loot: {}, ore: {}, materials: [], modules: [] };
    if (!p.hubOutput.loot) p.hubOutput.loot = {};
    p.hubOutput.loot[type] = value;
  },

  setHubOutputOre(type: string, value: number, p: Player = _G.P) {
    if (!p.hubOutput) p.hubOutput = { loot: {}, ore: {}, materials: [], modules: [] };
    if (!p.hubOutput.ore) p.hubOutput.ore = {};
    p.hubOutput.ore[type] = value;
  },

  addHubOutputMaterial(stack: BulkMaterialStack, p: Player = _G.P) {
    if (!p.hubOutput) p.hubOutput = { loot: {}, ore: {}, materials: [], modules: [] };
    if (!p.hubOutput.materials) p.hubOutput.materials = [];
    const signature = stackSignature(stack);
    const existing = p.hubOutput.materials.find((entry) => stackSignature(entry) === signature);
    if (existing) {
      existing.volumeM3 += stack.volumeM3;
      existing.massKg += stack.massKg;
      return;
    }
    p.hubOutput.materials.push({ ...stack, composition: { ...stack.composition } });
  },

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
  },

  removeRefineryStorageMaterial(materialId: string, p: Player = _G.P): { material: BulkMaterialStack | null; storageId: string | null } {
    for (const unit of p.refineryStorage ?? []) {
      const idx = unit.entries.findIndex((entry) => entry.id === materialId);
      if (idx === -1) continue;
      const [removed] = unit.entries.splice(idx, 1);
      syncHubDepositMaterials(p);
      return { material: removed ? cloneMaterialStack(removed) : null, storageId: unit.id };
    }
    return { material: null, storageId: null };
  },

  getRefineryStorageMaterial(materialId: string, p: Player = _G.P): { material: BulkMaterialStack | null; storageId: string | null } {
    for (const unit of p.refineryStorage ?? []) {
      const found = unit.entries.find((entry) => entry.id === materialId);
      if (found) return { material: cloneMaterialStack(found), storageId: unit.id };
    }
    return { material: null, storageId: null };
  },

  removeRefineryStorageMaterials(materialIds: string[], p: Player = _G.P): { materials: BulkMaterialStack[]; storageIds: string[] } {
    const materials: BulkMaterialStack[] = [];
    const storageIds = new Set<string>();
    for (const id of materialIds) {
      const removed = this.removeRefineryStorageMaterial(id, p);
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
    const idx = p.hubDeposit.raw.findIndex(i => i.id === id);
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

  addHubDepositMaterial(stack: BulkMaterialStack, p: Player = _G.P) {
    this.addRefineryStorageMaterial(stack, p);
  },

  removeHubDepositMaterial(id: string, p: Player = _G.P): BulkMaterialStack | null {
    return this.removeRefineryStorageMaterial(id, p).material;
  },

  addHubDepositModule(inst: ModuleInstance, p: Player = _G.P) {
    if (!p.hubDeposit) p.hubDeposit = { raw: [], ore: {}, materials: [], loot: {}, modules: [] };
    if (!p.hubDeposit.modules) p.hubDeposit.modules = [];
    p.hubDeposit.modules.push(inst);
  },
};
