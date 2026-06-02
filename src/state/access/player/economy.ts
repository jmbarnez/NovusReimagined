import { _G, type Player, type HubJob, type HubOutput, type HubDeposit, type HubDepositItem, type MixedOreCargo } from "../../../state.js";
import type { ModuleInstance } from "../../../types/moduleInstance.js";
import type { CraftJob } from "../../../data/industryRecipes.js";
import type { MissionContract } from "../../../data/missions.js";

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

  removeMixedOreCargo(index: number, qty: number, p: Player = _G.P): boolean {
    if (!p.mixedOreCargo?.[index] || qty <= 0) return false;
    const slot = p.mixedOreCargo[index];
    if (slot.qty < qty) return false;
    slot.qty -= qty;
    if (slot.qty <= 0) p.mixedOreCargo.splice(index, 1);
    return true;
  },

  setRefined(type: string, value: number, p: Player = _G.P) {
    p.refined[type] = value;
  },

  setRefinedAll(refined: Record<string, number>, p: Player = _G.P) {
    p.refined = refined;
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
    if (!p.hubOutput) p.hubOutput = { loot: {}, ore: {}, refined: {}, modules: [] };
    if (!p.hubOutput.modules) p.hubOutput.modules = [];
    p.hubOutput.modules.push(inst);
  },

  setHubOutputLoot(type: string, value: number, p: Player = _G.P) {
    if (!p.hubOutput) p.hubOutput = { loot: {}, ore: {}, refined: {}, modules: [] };
    if (!p.hubOutput.loot) p.hubOutput.loot = {};
    p.hubOutput.loot[type] = value;
  },

  setHubOutputOre(type: string, value: number, p: Player = _G.P) {
    if (!p.hubOutput) p.hubOutput = { loot: {}, ore: {}, refined: {}, modules: [] };
    if (!p.hubOutput.ore) p.hubOutput.ore = {};
    p.hubOutput.ore[type] = value;
  },

  setHubOutputRefined(type: string, value: number, p: Player = _G.P) {
    if (!p.hubOutput) p.hubOutput = { loot: {}, ore: {}, refined: {}, modules: [] };
    if (!p.hubOutput.refined) p.hubOutput.refined = {};
    p.hubOutput.refined[type] = value;
  },

  setHubDeposit(deposit: HubDeposit, p: Player = _G.P) {
    p.hubDeposit = deposit;
  },

  addHubDepositItem(item: HubDepositItem, p: Player = _G.P) {
    if (!p.hubDeposit) p.hubDeposit = { raw: [], ore: {}, loot: {}, modules: [] };
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
    if (!p.hubDeposit) p.hubDeposit = { raw: [], ore: {}, loot: {}, modules: [] };
    if (!p.hubDeposit.ore) p.hubDeposit.ore = {};
    p.hubDeposit.ore[type] = value;
  },

  setHubDepositLoot(type: string, value: number, p: Player = _G.P) {
    if (!p.hubDeposit) p.hubDeposit = { raw: [], ore: {}, loot: {}, modules: [] };
    if (!p.hubDeposit.loot) p.hubDeposit.loot = {};
    p.hubDeposit.loot[type] = value;
  },

  addHubDepositModule(inst: ModuleInstance, p: Player = _G.P) {
    if (!p.hubDeposit) p.hubDeposit = { raw: [], ore: {}, loot: {}, modules: [] };
    if (!p.hubDeposit.modules) p.hubDeposit.modules = [];
    p.hubDeposit.modules.push(inst);
  },
};
