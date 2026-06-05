import { type Player, type BulkMaterialStack, type RefiningHeatMode } from "./state.js";
import { getState } from "./state-access.js";
import { PlayerAccess, WorldAccess } from "./state-access.js";
import type { HubJob } from "./state.js";
import type { ModuleInstance } from "./types/moduleInstance.js";
import { dst, random } from "./utils/math.js";
import { floatText } from "./utils/fx.js";
import { curSys } from "./utils/game.js";
import { removeSensorLock } from "./targeting.js";
import { removeWreckPiece } from "./utils/entities.js";
import { rollWreckSalvage } from "./wreck.js";
import { addSkillXp } from "./player/player-data.js";
import { getStats } from "./player/player-stats.js";
import { logEvent } from "./feedback.js";
import { C } from "./config/index.js";
import type { Station, WreckSalvageEntry } from "./types/world.js";
import {
  ALLOY_FAMILIES,
  alloyMaterial,
  flattenStorageMaterials,
  averageDensityKgPerM3,
  estimateMixedOreCargoMassKg,
  materialLabelForComposition,
  preferredStorageForMaterial,
  processMixedSource,
  separateMaterial,
  upsertDiscoveredAlloy,
} from "./refining.js";
import { normalizeComposition, type OreComposition } from "./utils/ore-naming.js";

const DEFAULT_HEAT_MODE: RefiningHeatMode = "stable";

function createMaterialStack(input: Omit<BulkMaterialStack, "id">): BulkMaterialStack {
  return {
    id: `mat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ...input,
    composition: { ...normalizeComposition(input.composition) },
  };
}

function asteroidMatterMassKg(rawMass: number, composition: OreComposition): number {
  return Math.max(180, rawMass * 0.05 * averageDensityKgPerM3(composition));
}

function processJobDuration(massKg: number): number {
  return C.HUB.ASTEROID_PROCESS_BASE + massKg / Math.max(1, C.HUB.ASTEROID_PROCESS_PER_MASS * 16);
}

function refinementHeatMode(mode?: RefiningHeatMode): RefiningHeatMode {
  return mode === "cool" || mode === "hot" ? mode : "stable";
}

function skillUnlockBonus(skillLevel: number): number {
  return 1 + Math.min(0.2, skillLevel * 0.03);
}

function findHubMaterial(p: Player, materialId: string): BulkMaterialStack | null {
  return PlayerAccess.getRefineryStorageMaterial(materialId, p).material;
}

function storeRefineryMaterial(
  material: BulkMaterialStack,
  p: Player,
  preferredStorageId?: string | null,
): { stored: BulkMaterialStack | null; overflow: BulkMaterialStack | null; storageId: string | null } {
  return PlayerAccess.addRefineryStorageMaterial(material, p, preferredStorageId);
}

function logStorageOverflow(label: string, overflow: BulkMaterialStack | null, p: Player): void {
  if (!overflow || overflow.volumeM3 <= 1e-4) return;
  if (p === getState().player) {
    logEvent(`${label} overflowed storage — ${overflow.volumeM3.toFixed(1)} m³ lost as slag`, "system");
  }
}

function blendMaterials(materials: BulkMaterialStack[]): { composition: OreComposition; massKg: number; volumeM3: number } {
  const totalMassKg = materials.reduce((sum, material) => sum + material.massKg, 0);
  const totalVolumeM3 = materials.reduce((sum, material) => sum + material.volumeM3, 0);
  if (totalMassKg <= 0) return { composition: { iron: 1 }, massKg: 0, volumeM3: totalVolumeM3 };
  const weighted: Record<string, number> = {};
  for (const material of materials) {
    for (const [oreKey, fraction] of Object.entries(material.composition)) {
      weighted[oreKey] = (weighted[oreKey] ?? 0) + fraction * material.massKg;
    }
  }
  return {
    composition: normalizeComposition(
      Object.fromEntries(Object.entries(weighted).map(([oreKey, massKg]) => [oreKey, massKg / totalMassKg])),
    ),
    massKg: totalMassKg,
    volumeM3: totalVolumeM3,
  };
}

function completeAsteroidProcessing(job: HubJob, p: Player) {
  const composition = normalizeComposition(job.composition ?? { iron: 1 });
  const skillLv = p.skills?.refining ?? 0;
  const processed = processMixedSource({
    sourceMassKg: asteroidMatterMassKg(job.mass, composition),
    composition,
    richness: job.richness ?? 1,
    skillLevel: skillLv,
    heatMode: refinementHeatMode(job.heatMode),
  });
  const material = createMaterialStack({
    materialId: "processed_stock",
    kind: "processed",
    label: materialLabelForComposition(composition),
    volumeM3: processed.volumeM3,
    massKg: processed.massKg,
    composition,
  });
  const routed = storeRefineryMaterial(material, p, job.targetStorageId);
  logStorageOverflow(material.label, routed.overflow, p);
  const xp = Math.max(12, Math.floor(processed.massKg * 0.012 * skillUnlockBonus(skillLv)));
  addSkillXp("refining", xp, p);
  if (p === getState().player) {
    logEvent(`Processing complete — ${material.label} ready · ${material.volumeM3.toFixed(1)} m³ · Refining +${xp} XP`, "loot");
  }
}

function completeMixedOreProcessing(job: HubJob, p: Player) {
  const composition = normalizeComposition(job.composition ?? { iron: 1 });
  const skillLv = p.skills?.refining ?? 0;
  const processed = processMixedSource({
    sourceMassKg: job.mass,
    composition,
    richness: job.richness ?? 1,
    skillLevel: skillLv,
    heatMode: refinementHeatMode(job.heatMode),
  });
  const material = createMaterialStack({
    materialId: "processed_stock",
    kind: "processed",
    label: materialLabelForComposition(composition),
    volumeM3: processed.volumeM3,
    massKg: processed.massKg,
    composition,
  });
  const routed = storeRefineryMaterial(material, p, job.targetStorageId);
  logStorageOverflow(material.label, routed.overflow, p);
  const xp = Math.max(8, Math.floor(processed.massKg * 0.015 * skillUnlockBonus(skillLv)));
  addSkillXp("refining", xp, p);
  if (p === getState().player) {
    logEvent(`Feedstock stabilized — ${material.label} stockpiled · Refining +${xp} XP`, "loot");
  }
}

function completeSeparation(job: HubJob, p: Player) {
  const composition = normalizeComposition(job.composition ?? { iron: 1 });
  const material: BulkMaterialStack = {
    id: job.sourceMaterialId ?? `sep-${Date.now()}`,
    materialId: "processed_stock",
    kind: "processed",
    label: materialLabelForComposition(composition),
    volumeM3: job.sourceQty ?? 0,
    massKg: job.mass,
    composition,
  };
  const result = separateMaterial({
    material,
    skillLevel: p.skills?.refining ?? 0,
    heatMode: refinementHeatMode(job.heatMode),
  });
  for (const output of result.outputs) {
    const stored = storeRefineryMaterial(createMaterialStack({
      materialId: "processed_stock",
      kind: "processed",
      label: output.label,
      volumeM3: output.volumeM3,
      massKg: output.massKg,
      composition: output.composition,
    }), p);
    logStorageOverflow(output.label, stored.overflow, p);
  }
  const xp = Math.max(6, Math.floor(result.outputs.reduce((sum, output) => sum + output.massKg, 0) * 0.01));
  addSkillXp("refining", xp, p);
  if (p === getState().player) {
    logEvent(`Separation complete — ${result.outputs.length} stock streams recovered · Refining +${xp} XP`, "loot");
  }
}

function completeAlloying(job: HubJob, p: Player) {
  const composition = normalizeComposition(job.composition ?? { iron: 1 });
  const material: BulkMaterialStack = {
    id: job.sourceMaterialId ?? `alloy-${Date.now()}`,
    materialId: "processed_stock",
    kind: "processed",
    label: materialLabelForComposition(composition),
    volumeM3: job.sourceQty ?? 0,
    massKg: job.mass,
    composition,
  };
  const output = alloyMaterial({
    material,
    skillLevel: p.skills?.refining ?? 0,
    heatMode: refinementHeatMode(job.heatMode),
    targetFamilyId: job.targetAlloyFamilyId,
  });
  const now = Date.now() / 1000;
  const discovered = output.kind === "customBlend"
    ? upsertDiscoveredAlloy(p.alloyCodex, output.composition, now)
    : null;
  const routed = storeRefineryMaterial(createMaterialStack({
    materialId: output.materialId,
    kind: discovered ? "alloy" : output.kind,
    label: discovered?.label ?? output.label,
    volumeM3: output.volumeM3,
    massKg: output.massKg,
    composition: output.composition,
    alloyFamilyId: discovered?.id ?? output.alloyFamilyId,
  }), p, job.targetStorageId);
  logStorageOverflow(discovered?.label ?? output.label, routed.overflow, p);
  PlayerAccess.setAlloyCodex(p.alloyCodex, p);
  const xp = Math.max(10, Math.floor(output.massKg * ((output.kind === "alloy" || discovered) ? 0.018 : 0.012)));
  addSkillXp("refining", xp, p);
  if (p === getState().player) {
    const label = discovered?.label ?? output.label;
    const suffix = discovered ? " · Discovery logged" : "";
    logEvent(`Alloying complete — ${label} produced${suffix} · Refining +${xp} XP`, "loot");
  }
}

function completeDebrisProcessing(mass: number, salvagePool: WreckSalvageEntry[] | undefined, p: Player) {
  const rollBonus = getStats(p).salvageBonus;
  const drops = rollWreckSalvage(salvagePool, rollBonus);
  for (const drop of drops) {
    if (drop.kind === "loot") {
      const cur = p.hubDeposit?.loot?.[drop.payload] ?? 0;
      PlayerAccess.setHubDepositLoot(drop.payload, cur + drop.qty, p);
    } else if (drop.kind === "module" && drop.instance) {
      PlayerAccess.addHubDepositModule(drop.instance, p);
    }
  }
  const xp = Math.max(5, Math.floor(mass * 0.015));
  addSkillXp("salvage", xp, p);
  if (p === getState().player) {
    logEvent(`Processing complete — salvage ready · Salvage +${xp} XP`, "loot");
  }
}

function getHub(p: Player): Station | null {
  const sys = curSys(p);
  if (!sys) return null;
  return sys.stations.find((st: Station) => st.isProcessingHub) ?? null;
}

export function getDropZoneCenter(hub: Station): { x: number; y: number; radius: number } {
  const dx = hub.dropZoneOffset?.dx ?? 180;
  const dy = hub.dropZoneOffset?.dy ?? 0;
  return {
    x: hub.x + dx,
    y: hub.y + dy,
    radius: hub.dropZoneRadius ?? 140,
  };
}

export function fmtDuration(seconds: number): string {
  const rounded = Math.ceil(seconds);
  if (rounded < 60) return `${rounded}s`;
  const m = Math.floor(rounded / 60);
  const s = rounded % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export function getProcessFee(mass: number): number {
  return Math.max(C.HUB.PROCESS_MIN_FEE, Math.ceil(mass * C.HUB.PROCESS_FEE_PER_MASS));
}

export function getFloatingDeposits(hub: Station, p: Player) {
  const dropZone = getDropZoneCenter(hub);
  const items: Array<{
    id: string;
    kind: "asteroid" | "debris";
    label: string;
    mass: number;
    composition?: OreComposition;
    richness?: number;
    salvagePool?: WreckSalvageEntry[];
  }> = [];

  for (const wp of getState().wreckPieces) {
    if (dst(wp.x, wp.y, dropZone.x, dropZone.y) < dropZone.radius) {
      const mass = wp.radius * wp.radius * 0.8;
      items.push({
        id: wp.id,
        kind: "debris",
        label: wp.name || "Wreck debris",
        mass,
        salvagePool: wp.salvagePool ? [...wp.salvagePool] : [],
      });
    }
  }

  const sys = curSys(p);
  if (sys) {
    for (const ast of sys.asteroids) {
      if (ast.depleted || ast.hp <= 0) continue;
      if (dst(ast.x, ast.y, dropZone.x, dropZone.y) < dropZone.radius) {
        items.push({
          id: ast.id,
          kind: "asteroid",
          label: ast.name || "Asteroid",
          mass: ast.radius * ast.radius * 1.8,
          composition: { ...ast.composition },
          richness: ast.richness,
        });
      }
    }
  }
  return items;
}

export function getCargoMixedOreInputs(p: Player = getState().player) {
  return (p.mixedOreCargo ?? []).map((slot, index) => ({
    id: `mixed-${index}`,
    index,
    label: slot.name,
    qty: slot.qty,
    richness: slot.richness ?? 1,
    composition: { ...slot.composition },
    massKg: estimateMixedOreCargoMassKg(slot.qty, slot.composition),
  }));
}

export function updateHub(_dt: number) {
  // Background ingestion remains manual by design.
}

export function processFloatingItem(itemId: string, p: Player): { success: boolean; reason?: string } {
  const hub = getHub(p);
  if (!hub) return { success: false, reason: "No active reclamation hub detected" };
  const item = getFloatingDeposits(hub, p).find((entry) => entry.id === itemId);
  if (!item) return { success: false, reason: "Target matter is no longer in the bay" };

  const fee = getProcessFee(item.mass);
  if (p.credits < fee) return { success: false, reason: `Need ${fee}¢ processing fee (have ${p.credits}¢)` };
  PlayerAccess.modifyCredits(-fee, p);

  if (item.kind === "debris") {
    const idx = getState().wreckPieces.findIndex((wp) => wp.id === itemId);
    if (idx !== -1) {
      removeSensorLock(itemId, p);
      removeWreckPiece(idx);
    }
  } else {
    const sys = curSys(p);
    if (sys?.asteroids.some((ast) => ast.id === itemId)) {
      removeSensorLock(itemId, p);
      WorldAccess.depleteAsteroid(p.sysIdx, itemId, 90 + random() * 60);
    }
  }

  const now = Date.now() / 1000;
  const job: HubJob = {
    id: `hub-${item.kind}-${Date.now()}`,
    kind: item.kind === "asteroid" ? "asteroid" : "debris",
    startTime: now,
    duration: processJobDuration(item.mass),
    mass: item.mass,
    composition: item.composition ? { ...item.composition } : undefined,
    richness: item.richness ?? 1,
    salvagePool: item.salvagePool ? [...item.salvagePool] : undefined,
    heatMode: DEFAULT_HEAT_MODE,
  };
  PlayerAccess.addHubJob(job, p);
  if (p === getState().player) {
    const dropZone = getDropZoneCenter(hub);
    floatText(dropZone.x, dropZone.y - 35, "Reclamation Initiated", "#ffaa44");
    logEvent(`Matter reclamation initiated: ${item.label} (${fee}¢ fee)`, "system");
  }
  return { success: true };
}

export function processMixedOreCargo(
  index: number,
  qty: number,
  heatMode: RefiningHeatMode,
  p: Player,
  targetStorageId?: string | null,
): { success: boolean; reason?: string } {
  const slot = p.mixedOreCargo?.[index];
  if (!slot || qty <= 0 || qty > slot.qty) return { success: false, reason: "Invalid mixed ore selection" };
  const sourceMassKg = estimateMixedOreCargoMassKg(qty, slot.composition);
  const fee = getProcessFee(sourceMassKg / 100);
  if (p.credits < fee) return { success: false, reason: `Need ${fee}¢ processing fee (have ${p.credits}¢)` };

  PlayerAccess.modifyCredits(-fee, p);
  if (!PlayerAccess.removeMixedOreCargo(index, qty, p)) {
    return { success: false, reason: "Unable to reserve ore chunk" };
  }

  const now = Date.now() / 1000;
  PlayerAccess.addHubJob({
    id: `hub-mixed-${Date.now()}-${index}`,
    kind: "processMixed",
    startTime: now,
    duration: processJobDuration(sourceMassKg),
    mass: sourceMassKg,
    composition: { ...slot.composition },
    richness: slot.richness ?? 1,
    sourceQty: qty,
    heatMode: refinementHeatMode(heatMode),
    targetStorageId: targetStorageId ?? undefined,
  }, p);
  if (p === getState().player) {
    logEvent(`Queued feedstock processing: ${slot.name} ×${qty} (${fee}¢ fee)`, "system");
  }
  return { success: true };
}

export function separateHubMaterial(materialId: string, heatMode: RefiningHeatMode, p: Player): { success: boolean; reason?: string } {
  const found = PlayerAccess.getRefineryStorageMaterial(materialId, p);
  const material = found.material;
  if (!material) return { success: false, reason: "Material stack not found" };
  const fee = getProcessFee(material.massKg / 120);
  if (p.credits < fee) return { success: false, reason: `Need ${fee}¢ separation fee (have ${p.credits}¢)` };
  const removed = PlayerAccess.removeHubDepositMaterial(materialId, p);
  if (!removed) return { success: false, reason: "Material stack unavailable" };
  PlayerAccess.modifyCredits(-fee, p);
  PlayerAccess.addHubJob({
    id: `hub-separate-${Date.now()}`,
    kind: "separateStock",
    startTime: Date.now() / 1000,
    duration: 6 + removed.volumeM3 * 10,
    mass: removed.massKg,
    sourceQty: removed.volumeM3,
    composition: { ...removed.composition },
    sourceMaterialId: removed.id,
    sourceStorageId: found.storageId ?? undefined,
    heatMode: refinementHeatMode(heatMode),
  }, p);
  return { success: true };
}

export function alloyHubMaterial(
  materialId: string,
  targetAlloyFamilyId: string | null,
  heatMode: RefiningHeatMode,
  p: Player,
  sourceMaterialIds?: string[],
  targetStorageId?: string | null,
): { success: boolean; reason?: string } {
  const requestedIds = Array.from(new Set([materialId, ...(sourceMaterialIds ?? [])].filter((id): id is string => !!id)));
  const removed = PlayerAccess.removeRefineryStorageMaterials(requestedIds, p);
  if (removed.materials.length === 0) return { success: false, reason: "Material stack not found" };
  const blend = blendMaterials(removed.materials);
  const fee = getProcessFee(blend.massKg / 150);
  if (p.credits < fee) return { success: false, reason: `Need ${fee}¢ alloying fee (have ${p.credits}¢)` };
  PlayerAccess.modifyCredits(-fee, p);
  PlayerAccess.addHubJob({
    id: `hub-alloy-${Date.now()}`,
    kind: "alloyStock",
    startTime: Date.now() / 1000,
    duration: 8 + blend.volumeM3 * 12,
    mass: blend.massKg,
    sourceQty: blend.volumeM3,
    composition: { ...blend.composition },
    sourceMaterialId: removed.materials[0]?.id,
    sourceMaterialIds: requestedIds,
    sourceStorageId: removed.storageIds[0],
    targetAlloyFamilyId: targetAlloyFamilyId ?? undefined,
    heatMode: refinementHeatMode(heatMode),
    targetStorageId: targetStorageId ?? undefined,
  }, p);
  return { success: true };
}

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

export function getAlloyFamilies() {
  return ALLOY_FAMILIES;
}
