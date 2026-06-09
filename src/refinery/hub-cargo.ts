import type { Player, RefiningHeatMode, BulkMaterialStack } from "../state.js";
import { getState } from "../state-access.js";
import { PlayerAccess, WorldAccess } from "../state-access.js";
import { floatText } from "../utils/fx.js";
import { t } from "../utils/i18n.js";
import { curSys } from "../utils/game.js";
import { random } from "../utils/math.js";
import { removeSensorLock } from "../targeting.js";
import { removeWreckPiece } from "../utils/entities.js";
import { logEvent } from "../feedback.js";
import { estimateMixedOreCargoMassKg } from "./composition.js";
import { getHub } from "./hub-core.js";
import { refinementHeatMode, processJobDuration, blendMaterials } from "./hub-state.js";
import { getProcessFee, getFloatingDeposits, getDropZoneCenter } from "./hub-queries.js";

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
  PlayerAccess.addHubJob({
    id: `hub-${item.kind}-${Date.now()}`,
    kind: item.kind === "asteroid" ? "asteroid" : "debris",
    startTime: now,
    duration: processJobDuration(item.mass),
    mass: item.mass,
    composition: item.composition ? { ...item.composition } : undefined,
    richness: item.richness ?? 1,
    salvagePool: item.salvagePool ? [...item.salvagePool] : undefined,
    heatMode: refinementHeatMode(),
  }, p);
  if (p === getState().player) {
    const dropZone = getDropZoneCenter(hub);
    floatText(dropZone.x, dropZone.y - 35, t("system.reclamationInitiated"), "#ffaa44");
    logEvent(t("system.reclamationLog", { label: item.label, fee }), "system");
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
    logEvent(t("system.queuedProcessing", { name: slot.name, qty, fee }), "system");
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
  const plannedMaterials: BulkMaterialStack[] = [];
  for (const id of requestedIds) {
    const found = PlayerAccess.getRefineryStorageMaterial(id, p);
    const material = found?.material;
    if (material) plannedMaterials.push(material);
  }
  if (!plannedMaterials.some((material) => material.id === materialId)) return { success: false, reason: "Material stack not found" };
  const plannedBlend = blendMaterials(plannedMaterials);
  const fee = getProcessFee(plannedBlend.massKg / 150);
  if (p.credits < fee) return { success: false, reason: `Need ${fee}¢ alloying fee (have ${p.credits}¢)` };
  const removed = PlayerAccess.removeRefineryStorageMaterials(requestedIds, p);
  if (removed.materials.length === 0) return { success: false, reason: "Material stack not found" };
  const blend = blendMaterials(removed.materials);
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
