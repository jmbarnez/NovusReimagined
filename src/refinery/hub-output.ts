import type { Player, BulkMaterialStack } from "../state.js";
import type { ModuleInstance } from "../types/moduleInstance.js";
import { getState } from "../state-access.js";
import { PlayerAccess } from "../state-access.js";
import { flattenStorageMaterials } from "./storage.js";
import {
  completeAsteroidProcessing,
  completeMixedOreProcessing,
  completeSeparation,
  completeAlloying,
  completeDebrisProcessing,
} from "./hub-jobs.js";

export function tickHubQueue(p: Player = getState().player) {
  if (!p.hubQueue?.length) return;
  const now = Date.now() / 1000;
  const completed: number[] = [];

  for (let i = 0; i < p.hubQueue.length; i++) {
    const job = p.hubQueue[i];
    if (now - job.startTime < job.duration) continue;
    completed.push(i);
    if (job.kind === "debris") completeDebrisProcessing(job.mass, job.salvagePool, p);
    else if (job.kind === "asteroid") completeAsteroidProcessing(job, p);
    else if (job.kind === "processMixed") completeMixedOreProcessing(job, p);
    else if (job.kind === "separateStock") completeSeparation(job, p);
    else if (job.kind === "alloyStock") completeAlloying(job, p);
  }

  for (let i = completed.length - 1; i >= 0; i--) {
    PlayerAccess.spliceHubQueue(completed[i], 1, p);
  }
}

export function collectHubOutput(p: Player = getState().player): {
  loot: Record<string, number>;
  ore: Record<string, number>;
  materials: BulkMaterialStack[];
  modules: ModuleInstance[];
} {
  const materials = [
    ...(p.hubOutput.materials ?? []),
    ...flattenStorageMaterials(p.refineryStorage),
  ].map((entry) => ({ ...entry, composition: { ...entry.composition } }));

  const out = {
    loot: { ...p.hubOutput.loot, ...p.hubDeposit.loot },
    ore: { ...p.hubOutput.ore },
    materials,
    modules: [...p.hubOutput.modules, ...p.hubDeposit.modules],
  };

  for (const [key, qty] of Object.entries(out.loot)) {
    PlayerAccess.setLoot(key, (p.loot[key] ?? 0) + qty, p);
  }
  for (const [key, qty] of Object.entries(out.ore)) {
    PlayerAccess.setOre(key, (p.ore[key] ?? 0) + qty, p);
  }
  for (const material of materials) {
    PlayerAccess.addBulkMaterial(material, p);
  }
  for (const inst of out.modules) {
    PlayerAccess.addModuleCargo(inst, p);
  }

  PlayerAccess.setHubOutput({ loot: {}, ore: {}, materials: [], modules: [] }, p);
  PlayerAccess.setHubDeposit({
    raw: [...p.hubDeposit.raw],
    ore: { ...p.hubDeposit.ore },
    materials: [],
    loot: {},
    modules: [],
  }, p);
  PlayerAccess.setRefineryStorage(
    (p.refineryStorage ?? []).map((unit) => ({
      ...unit,
      entries: [],
    })),
    p,
  );
  return out;
}

export function hasHubDeposit(p: Player): boolean {
  const d = p.hubDeposit;
  if (!d) return false;
  return (
    (d.raw?.length ?? 0) > 0 ||
    Object.values(d.ore ?? {}).some((value) => value > 0) ||
    flattenStorageMaterials(p.refineryStorage).length > 0 ||
    Object.values(d.loot ?? {}).some((value) => value > 0) ||
    (d.modules?.length ?? 0) > 0
  );
}

export function hasHubOutput(p: Player = getState().player): boolean {
  const o = p.hubOutput;
  const d = p.hubDeposit;
  return (
    Object.values(o.loot ?? {}).some((value) => value > 0) ||
    Object.values(o.ore ?? {}).some((value) => value > 0) ||
    (o.materials?.length ?? 0) > 0 ||
    (o.modules?.length ?? 0) > 0 ||
    Object.values(d?.loot ?? {}).some((value) => value > 0) ||
    (d?.modules?.length ?? 0) > 0 ||
    flattenStorageMaterials(p.refineryStorage).length > 0
  );
}
