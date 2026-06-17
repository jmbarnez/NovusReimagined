import type { Player, BulkMaterialStack, HubJob } from "../state.js";
import { getState } from "../state-access.js";
import { PlayerAccess } from "../state-access.js";
import { addSkillXp } from "../player/player-data.js";
import { getStats } from "../player/player-stats.js";
import { logEvent } from "../feedback.js";
import { t } from "../utils/i18n.js";
import { rollWreckSalvage } from "../wreck/index.js";
import type { WreckSalvageEntry } from "../types/system.js";
import { normalizeComposition } from "../utils/ore-naming.js";
import { processMixedSource, separateMaterial, alloyMaterial } from "./processing.js";
import { materialLabelForComposition } from "./composition.js";
import { upsertDiscoveredAlloy } from "./assessment.js";
import {
  createMaterialStack,
  asteroidMatterMassKg,
  refinementHeatMode,
  skillUnlockBonus,
  storeRefineryMaterial,
  logStorageOverflow,
} from "./hub-state.js";

export function completeAsteroidProcessing(job: HubJob, p: Player) {
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
    logEvent(t("system.processingComplete", { label: material.label, volume: material.volumeM3.toFixed(1), xp }), "loot");
  }
}

export function completeMixedOreProcessing(job: HubJob, p: Player) {
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
    logEvent(t("system.feedstockStabilized", { label: material.label, xp }), "loot");
  }
}

export function completeSeparation(job: HubJob, p: Player) {
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
    logEvent(t("system.separationComplete", { count: result.outputs.length, xp }), "loot");
  }
}

export function completeAlloying(job: HubJob, p: Player) {
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
    logEvent(t("system.alloyingComplete", { label, suffix, xp }), "loot");
  }
}

export function completeDebrisProcessing(mass: number, salvagePool: WreckSalvageEntry[] | undefined, p: Player) {
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
    logEvent(t("system.salvageReady", { xp }), "loot");
  }
}
