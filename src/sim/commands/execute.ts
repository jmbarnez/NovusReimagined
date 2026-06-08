import { type Player } from "../../state.js";
import { PlayerAccess, WorldAccess, getState } from "../../state-access.js";
import { fireSelectedTurret } from "../../combat/turret-control.js";
import { tryInteractSite } from "../../sites/interact.js";
import { getDockableStation, warpTo, beginWarpThroughGate } from "../../docking/index.js";
import { gateStableId } from "../../utils/warp-gates.js";
import {
  assignModuleSlotToTarget,
  clearSensorLocks,
  requestSensorLock,
  removeSensorLock,
  selectLockTarget,
} from "../../targeting.js";
import { applyToggleSlotMutation } from "../../player/player-fitting.js";
import { tryActivate as tryActivateAbility, ABILITY_BY_ID } from "../../player/abilities.js";
import { MODULES } from "../../data/modules.js";
import { getInstance } from "../../utils/items.js";
import { getSlotPowerCd } from "../../utils/slot-power.js";
import { getStats } from "../../player/player-stats.js";
import { resetTutorialTrackState } from "../../physics/tutorial-track.js";
import { applyDecryptionReward } from "../../sites/decryption-rewards.js";
import { startScanPulse } from "../../scanning/index.js";
import { checkDeliveryContracts } from "../../data/missions.js";
import { alloyHubMaterial, collectHubOutput, processFloatingItem, processMixedOreCargo, separateHubMaterial } from "../../refinery/index.js";
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
} from "../../state/actions.js";
import type { GameCommand } from "./types.js";
import {
  isFiniteNonNegative,
  isPositiveInteger,
  isRackId,
  isScannerConeDeg,
  isValidHardpointIndex,
  isValidSlotIndex,
} from "./validators.js";
import { refreshStationOffers } from "./station-offers.js";

const UNDOCK_DEACTIVATE_RACKS = ["high", "med", "low"] as const;

function resetActiveSlotsOnUndock(p: Player): void {
  for (const rack of UNDOCK_DEACTIVATE_RACKS) {
    const arr = p.slotActive?.[rack];
    if (!arr) continue;
    for (let i = 0; i < arr.length; i++) PlayerAccess.setSlotActive(rack, i, false, p);
  }
}

function resetTurretPowerOnUndock(p: Player): void {
  if (p.turretPower) PlayerAccess.setTurretPowerAll(Array(p.turretPower.length).fill(false), p);
  if (p.turretPowerCd) PlayerAccess.setTurretPowerCdAll(Array(p.turretPowerCd.length).fill(0), p);
}

export function executeGameCommand(command: GameCommand, p: Player): void {
  switch (command.type) {
    case "fireSelectedTurret":
      fireSelectedTurret(command.payload?.isAutoFire ?? false, p);
      break;
    case "interactSite":
      tryInteractSite(p);
      break;
    case "setFireControlSlot":
      if (!isValidHardpointIndex(command.payload.slot, p)) break;
      PlayerAccess.setFireControlSlot(command.payload.slot, p);
      break;
    case "toggleSlotDefaultAction": {
      const { rack, idx } = command.payload;
      if (!isRackId(rack)) break;
      if (!isValidSlotIndex(idx, rack, p)) break;
      const instanceId = p.fitting[rack]?.[idx];
      const instance = instanceId ? getInstance(instanceId, p) : null;
      const m = instance ? MODULES[instance.baseId] : null;
      if (!m) break;
      if (m.ability && ABILITY_BY_ID[m.ability]) {
        tryActivateAbility(m.ability, p);
        break;
      }
      if (getSlotPowerCd(rack, idx, p) > 0) break;
      applyToggleSlotMutation(rack, idx, p);
      break;
    }
    case "assignModuleSlotToTarget":
      if (!isValidHardpointIndex(command.payload.slotIdx, p)) break;
      if (command.payload.targetId !== null && typeof command.payload.targetId !== "string") break;
      assignModuleSlotToTarget(
        command.payload.slotIdx,
        command.payload.targetId,
        p,
        { ...command.payload.opts, suppressFrameAction: true },
      );
      break;
    case "setHighTarget":
      if (!Number.isInteger(command.payload.idx) || command.payload.idx < 0) break;
      if (command.payload.targetId !== null && typeof command.payload.targetId !== "string") break;
      PlayerAccess.setHighTarget(command.payload.idx, command.payload.targetId, p);
      break;
    case "requestSensorLock":
      if (!command.payload.id) break;
      requestSensorLock(command.payload.id, p, { suppressFrameAction: true });
      break;
    case "removeSensorLock":
      if (!command.payload.id) break;
      removeSensorLock(command.payload.id, p, { suppressFrameAction: true });
      break;
    case "selectLockTarget":
      if (!command.payload.id) break;
      selectLockTarget(command.payload.id, p, { suppressFrameAction: true });
      break;
    case "clearSensorLocks":
      clearSensorLocks(p, { suppressFrameAction: true });
      break;
    case "setTractorTightness":
      if (!Number.isFinite(command.payload.value)) break;
      PlayerAccess.setTractorTightness(Math.max(0, Math.min(1, command.payload.value)), p);
      break;
    case "setMapScannerPower":
      PlayerAccess.setMapScannerActive(command.payload.active === true, p);
      break;
    case "setMapScannerCone":
      if (!isScannerConeDeg(command.payload.coneDeg)) break;
      PlayerAccess.setScannerConeDeg(command.payload.coneDeg, p);
      break;
    case "setMapScannerStrength":
      if (!Number.isFinite(command.payload.strength)) break;
      PlayerAccess.setMapScannerStrength(command.payload.strength, p);
      break;
    case "startScanPulse":
      if (!Number.isFinite(command.payload.angleDeg)) break;
      startScanPulse(p, { angleDeg: command.payload.angleDeg, allowWithoutMapOpen: true });
      break;
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
    case "completeSite": {
      if (
        !isFiniteNonNegative(command.payload.payload) ||
        !isFiniteNonNegative(command.payload.integrity)
      ) break;
      const site = getState().GALAXY[p.sysIdx]?.hiddenSites?.find((entry) => entry.id === command.payload.siteId);
      if (!site) break;
      PlayerAccess.addCompletedSiteId(command.payload.siteId, p);
      WorldAccess.setHiddenSiteState(p.sysIdx, command.payload.siteId, "cleared");
      if (command.payload.payload > 0 && command.payload.integrity > 0) {
        applyDecryptionReward(site, command.payload.payload, command.payload.integrity, command.payload.partial, p);
      }
      if (command.payload.partial) {
        PlayerAccess.setEnergy(Math.max(0, p.energy - 12), p);
      }
      break;
    }
    case "dock": {
      const station = getDockableStation(p, command.payload?.stationId ?? null);
      if (!station) break;
      checkDeliveryContracts(station, p);
      refreshStationOffers(p, station.id);
      clearSensorLocks(p);
      PlayerAccess.updatePhysics({ vx: 0, vy: 0 }, p);
      PlayerAccess.setInvincible(1.5, p);
      break;
    }
    case "undock": {
      resetActiveSlotsOnUndock(p);
      PlayerAccess.setInvincible(1.5, p);
      PlayerAccess.setShieldCd(0, p);
      const stats = getStats(p);
      if (stats.maxShield > 0) PlayerAccess.setShield(stats.maxShield, p);
      resetTurretPowerOnUndock(p);
      PlayerAccess.setStationOffers([], null, p);
      break;
    }
    case "syncTutorialStep":
      PlayerAccess.setTutorialState(command.payload, p);
      resetTutorialTrackState(p);
      break;
    case "warp": {
      const targetIdx = command.payload?.targetIdx;
      if (typeof targetIdx !== "number") break;
      const sys = getState().GALAXY[p.sysIdx];
      if (!sys) break;
      const gate = sys.gates?.find((g) => g.targetSysIdx === targetIdx);
      if (gate) {
        beginWarpThroughGate(gate, p);
      }
      break;
    }
    case "warpGate": {
      const gateId = command.payload?.gateId;
      if (typeof gateId !== "string") break;
      const sys = getState().GALAXY[p.sysIdx];
      if (!sys) break;
      const gate = sys.gates?.find((g) => gateStableId(g) === gateId);
      if (gate && (gate.gateState === "charging" || gate.gateState === "active")) {
        beginWarpThroughGate(gate, p);
      }
      break;
    }
    case "skipTutorial": {
      PlayerAccess.setTutorialSkipped(p);
      PlayerAccess.setTutorialComplete(p);
      PlayerAccess.setHomeSysIdx(command.payload.primeIdx, p);
      resetTutorialTrackState(p);
      if (p.contracts) {
        const idx = p.contracts.findIndex((contract) => contract.id === "mc_academy_training");
        if (idx >= 0) PlayerAccess.removeContract(idx, p);
      }
      break;
    }
  }
}
