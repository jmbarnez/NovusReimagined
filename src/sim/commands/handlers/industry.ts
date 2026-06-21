/**
 * Industry / economy command handlers.
 *
 * Covers craft queue and blueprint management, ammunition and cargo sales,
 * module fit/unfit/swap/buy/sell, mission contract turn-in/abandon/accept,
 * hub processing (floating items, mixed-ore, separate, alloy, collect), and
 * home-system selection.
 */
import type { Player } from "../../../state.js";
import { PlayerAccess } from "../../../state-access.js";
import {
  alloyHubMaterial,
  collectHubOutput,
  processFloatingItem,
  processMixedOreCargo,
  separateHubMaterial,
} from "../../../refinery/index.js";
import {
  abandonContractAction,
  acceptContractProposalAction,
  buyModuleAction,
  buyAmmunitionAction,
  buyBlueprintAction,
  cancelIndustryJobAction,
  fitModuleAction,
  jettisonItemAction,
  queueIndustryJobAction,
  repairShipAction,
  sellModuleAction,
  sellCargoResourceAction,
  setHomeSystemAction,
  swapModuleAction,
  turnInContractAction,
  unfitModuleAction,
} from "../../../state/actions.js";
import type { GameCommand } from "../types.js";
import { isPositiveInteger, isRackId, isValidSlotIndex } from "../validators.js";
import { refreshStationOffers } from "../station-offers.js";

export type IndustryCommand = Extract<
  GameCommand,
  {
    type:
      | "queueIndustryJob"
      | "cancelIndustryJob"
      | "buyBlueprint"
      | "buyAmmunition"
      | "sellCargoResource"
      | "setHomeSystem"
      | "jettisonItem"
      | "repairShip"
      | "fitModule"
      | "unfitModule"
      | "swapModule"
      | "turnInContract"
      | "abandonContract"
      | "buyModule"
      | "sellModule"
      | "acceptContract"
      | "processHubFloatingItem"
      | "processHubMixedOre"
      | "separateHubMaterial"
      | "alloyHubMaterial"
      | "collectHubOutput";
  }
>;

export function handleIndustryCommand(command: IndustryCommand, p: Player): void {
  switch (command.type) {
    case "queueIndustryJob":
      if (!command.payload.recipeId) break;
      if (!isPositiveInteger(command.payload.qty)) break;
      queueIndustryJobAction(command.payload.recipeId, command.payload.qty, p);
      break;
    case "cancelIndustryJob":
      if (!command.payload.jobId) break;
      cancelIndustryJobAction(command.payload.jobId, p);
      break;
    case "buyBlueprint":
      if (!command.payload.recipeId) break;
      buyBlueprintAction(command.payload.recipeId, p);
      break;
    case "buyAmmunition":
      buyAmmunitionAction(command.payload.ammoType, p);
      break;
    case "sellCargoResource":
      if (!command.payload.key) break;
      sellCargoResourceAction(command.payload.category, command.payload.key, p);
      break;
    case "setHomeSystem":
      setHomeSystemAction(p);
      break;
    case "jettisonItem":
      if (!command.payload.itemId) break;
      jettisonItemAction(command.payload.itemId, command.payload.qty ?? null, p);
      break;
    case "repairShip":
      repairShipAction(p);
      break;
    case "fitModule":
      if (!isRackId(command.payload.rack)) break;
      if (!isValidSlotIndex(command.payload.slotIdx, command.payload.rack, p)) break;
      if (!command.payload.instanceId) break;
      fitModuleAction(command.payload.rack, command.payload.slotIdx, command.payload.instanceId, p);
      break;
    case "unfitModule":
      if (!isRackId(command.payload.rack)) break;
      if (!isValidSlotIndex(command.payload.slotIdx, command.payload.rack, p)) break;
      unfitModuleAction(command.payload.rack, command.payload.slotIdx, p);
      break;
    case "swapModule":
      if (!isRackId(command.payload.rack)) break;
      if (!isValidSlotIndex(command.payload.slotIdx, command.payload.rack, p)) break;
      if (!command.payload.instanceId) break;
      swapModuleAction(command.payload.rack, command.payload.slotIdx, command.payload.instanceId, p);
      break;
    case "turnInContract":
      if (!command.payload.contractId) break;
      if (turnInContractAction(command.payload.contractId, p).success) {
        refreshStationOffers(p, p.stationOfferStationId);
      }
      break;
    case "abandonContract":
      if (!command.payload.contractId) break;
      abandonContractAction(command.payload.contractId, p);
      break;
    case "buyModule":
      if (!command.payload.moduleId) break;
      buyModuleAction(command.payload.moduleId, p);
      break;
    case "sellModule":
      if (!command.payload.moduleId) break;
      sellModuleAction(command.payload.moduleId, p);
      break;
    case "acceptContract": {
      if (!command.payload.contractId) break;
      const offer = p.stationOffers.find((contract) => contract.id === command.payload.contractId);
      if (!offer) break;
      if (acceptContractProposalAction(offer, p.stationOfferStationId, p).success) {
        PlayerAccess.setStationOffers(
          p.stationOffers.filter((contract) => contract.id !== command.payload.contractId),
          p.stationOfferStationId,
          p,
        );
      }
      break;
    }
    case "processHubFloatingItem":
      if (!command.payload.itemId) break;
      processFloatingItem(command.payload.itemId, p);
      break;
    case "processHubMixedOre":
      if (!Number.isInteger(command.payload.cargoIndex) || command.payload.cargoIndex < 0) break;
      if (!isPositiveInteger(command.payload.qty)) break;
      processMixedOreCargo(
        command.payload.cargoIndex,
        command.payload.qty,
        command.payload.heatMode ?? "stable",
        p,
        command.payload.targetStorageId ?? null,
      );
      break;
    case "separateHubMaterial":
      if (!command.payload.materialId) break;
      separateHubMaterial(command.payload.materialId, command.payload.heatMode ?? "stable", p);
      break;
    case "alloyHubMaterial":
      if (!command.payload.materialId) break;
      alloyHubMaterial(
        command.payload.materialId,
        command.payload.targetAlloyFamilyId ?? null,
        command.payload.heatMode ?? "stable",
        p,
        command.payload.sourceMaterialIds,
        command.payload.targetStorageId ?? null,
      );
      break;
    case "collectHubOutput":
      collectHubOutput(p);
      break;
  }
}
