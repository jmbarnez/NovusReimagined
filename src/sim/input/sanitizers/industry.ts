/**
 * Industry / economy action sanitizers.
 *
 * Covers craft queue and blueprint actions, ammunition and cargo sales,
 * module fit/unfit/swap/buy/sell, mission contract turn-in/abandon/accept,
 * and hub processing (floating items, mixed-ore, separate, alloy, collect),
 * plus home-system selection.
 */
import type { GameCommand } from "../../commands.js";
import {
  AMMO_TYPES,
  HEAT_MODES,
  RACK_IDS,
  RESOURCE_CATEGORIES,
  numberPayload,
  optionalPayloadRecord,
  stringPayload,
} from "../sanitize-helpers.js";

export function sanitizeIndustryAction(action: Record<string, unknown>): GameCommand | null {
  switch (action.type) {
    case "queueIndustryJob": {
      const recipeId = stringPayload(action, "recipeId");
      const qty = numberPayload(action, "qty");
      return recipeId == null || qty == null ? null : { type: "queueIndustryJob", payload: { recipeId, qty } };
    }
    case "cancelIndustryJob": {
      const jobId = stringPayload(action, "jobId");
      return jobId == null ? null : { type: "cancelIndustryJob", payload: { jobId } };
    }
    case "buyBlueprint": {
      const recipeId = stringPayload(action, "recipeId");
      return recipeId == null ? null : { type: "buyBlueprint", payload: { recipeId } };
    }
    case "buyAmmunition": {
      const ammoType = stringPayload(action, "ammoType");
      return ammoType != null && AMMO_TYPES.has(ammoType)
        ? { type: "buyAmmunition", payload: { ammoType: ammoType as "hybrid" | "missile" } }
        : null;
    }
    case "sellCargoResource": {
      const payload = optionalPayloadRecord(action);
      if (typeof payload.category !== "string" || !RESOURCE_CATEGORIES.has(payload.category)) return null;
      if (typeof payload.key !== "string") return null;
      return { type: "sellCargoResource", payload: { category: payload.category as "ore" | "loot" | "components", key: payload.key } };
    }
    case "setHomeSystem":
    case "repairShip":
    case "collectHubOutput":
      return { type: action.type };
    case "jettisonItem": {
      const payload = optionalPayloadRecord(action);
      if (typeof payload.itemId !== "string") return null;
      if (payload.qty !== undefined && payload.qty !== null && typeof payload.qty !== "number") return null;
      return { type: "jettisonItem", payload: { itemId: payload.itemId, qty: payload.qty } };
    }
    case "fitModule":
    case "swapModule": {
      const payload = optionalPayloadRecord(action);
      if (typeof payload.rack !== "string" || !RACK_IDS.has(payload.rack)) return null;
      if (typeof payload.slotIdx !== "number" || typeof payload.instanceId !== "string") return null;
      return { type: action.type, payload: { rack: payload.rack as "turret" | "high" | "med" | "low", slotIdx: payload.slotIdx, instanceId: payload.instanceId } };
    }
    case "unfitModule": {
      const payload = optionalPayloadRecord(action);
      if (typeof payload.rack !== "string" || !RACK_IDS.has(payload.rack)) return null;
      if (typeof payload.slotIdx !== "number") return null;
      return { type: "unfitModule", payload: { rack: payload.rack as "turret" | "high" | "med" | "low", slotIdx: payload.slotIdx } };
    }
    case "turnInContract": {
      const contractId = stringPayload(action, "contractId");
      return contractId == null ? null : { type: "turnInContract", payload: { contractId } };
    }
    case "abandonContract": {
      const contractId = stringPayload(action, "contractId");
      return contractId == null ? null : { type: "abandonContract", payload: { contractId } };
    }
    case "acceptContract": {
      const contractId = stringPayload(action, "contractId");
      return contractId == null ? null : { type: "acceptContract", payload: { contractId } };
    }
    case "buyModule": {
      const moduleId = stringPayload(action, "moduleId");
      return moduleId == null ? null : { type: "buyModule", payload: { moduleId } };
    }
    case "sellModule": {
      const moduleId = stringPayload(action, "moduleId");
      return moduleId == null ? null : { type: "sellModule", payload: { moduleId } };
    }
    case "processHubFloatingItem": {
      const itemId = stringPayload(action, "itemId");
      return itemId == null ? null : { type: "processHubFloatingItem", payload: { itemId } };
    }
    case "processHubMixedOre": {
      const cargoIndex = numberPayload(action, "cargoIndex");
      const qty = numberPayload(action, "qty");
      const payload = optionalPayloadRecord(action);
      const heatMode = typeof payload.heatMode === "string" && HEAT_MODES.has(payload.heatMode) ? (payload.heatMode as "cool" | "stable" | "hot") : undefined;
      const targetStorageId = payload.targetStorageId == null
        ? undefined
        : typeof payload.targetStorageId === "string"
          ? payload.targetStorageId
          : null;
      return cargoIndex == null || qty == null ? null : { type: "processHubMixedOre", payload: { cargoIndex, qty, heatMode, targetStorageId } };
    }
    case "separateHubMaterial": {
      const materialId = stringPayload(action, "materialId");
      const payload = optionalPayloadRecord(action);
      const heatMode = typeof payload.heatMode === "string" && HEAT_MODES.has(payload.heatMode) ? (payload.heatMode as "cool" | "stable" | "hot") : undefined;
      return materialId == null ? null : { type: "separateHubMaterial", payload: { materialId, heatMode } };
    }
    case "alloyHubMaterial": {
      const payload = optionalPayloadRecord(action);
      if (typeof payload.materialId !== "string") return null;
      const heatMode = typeof payload.heatMode === "string" && HEAT_MODES.has(payload.heatMode) ? (payload.heatMode as "cool" | "stable" | "hot") : undefined;
      const targetAlloyFamilyId = payload.targetAlloyFamilyId == null
        ? undefined
        : typeof payload.targetAlloyFamilyId === "string"
          ? payload.targetAlloyFamilyId
          : null;
      const targetStorageId = payload.targetStorageId == null
        ? undefined
        : typeof payload.targetStorageId === "string"
          ? payload.targetStorageId
          : null;
      const sourceMaterialIds = Array.isArray(payload.sourceMaterialIds)
        ? payload.sourceMaterialIds.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
        : undefined;
      return {
        type: "alloyHubMaterial",
        payload: { materialId: payload.materialId, sourceMaterialIds, targetAlloyFamilyId, heatMode, targetStorageId },
      };
    }
    default:
      return null;
  }
}
