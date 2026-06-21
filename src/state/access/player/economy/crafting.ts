/**
 * Player crafting and hub output accessors.
 *
 * Covers the craft queue (blueprint-gated station fabrication), blueprints,
 * the hub processing queue, and hub output collection (loot/ore/materials/
 * modules). Hub output material stacks coalesce via `stackSignature`.
 */
import {
  _G,
  type Player,
  type HubJob,
  type HubOutput,
  type BulkMaterialStack,
} from "../../../../state.js";
import type { ModuleInstance } from "../../../../types/moduleInstance.js";
import type { CraftJob } from "../../../../data/industryRecipes.js";
import { stackSignature } from "../../../../refinery/composition.js";

export const playerCraftingAccess = {
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
};
