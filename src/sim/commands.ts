import { type Player } from "../state.js";
import { PlayerAccess, WorldAccess, getState } from "../state-access.js";
import { fireSelectedTurret } from "../combat/turret-control.js";
import { tryInteractSite } from "../sites/interact.js";
import { tryWarp, warpTo, clearWarpPresentation } from "../dock.js";
import {
  assignModuleSlotToTarget,
  clearSensorLocks,
  requestSensorLock,
  removeSensorLock,
  selectLockTarget,
} from "../targeting.js";
import { applyToggleSlotMutation } from "../player/player-fitting.js";
import { tryActivate as tryActivateAbility, ABILITY_BY_ID } from "../player/abilities.js";
import { MODULES } from "../data/modules.js";
import { getInstance } from "../utils/items.js";
import { getSlotPowerCd } from "../utils/slot-power.js";
import { getStats } from "../player/player-stats.js";
import { resetTutorialTrackState } from "../physics/tutorial-track.js";
import { applyDecryptionReward } from "../sites/decryption-rewards.js";
import { RACK_TYPES, type RackId } from "../constants.js";
import { playerHardpointRack } from "../utils/hardpoints.js";
import { checkDeliveryContracts, generateContractsForStation, type MissionContract } from "../data/missions.js";
import { collectHubOutput, processFloatingItem, smeltFromDeposit } from "../hub.js";
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
} from "../state/actions.js";

export interface InputNavCommand {
  mode: "orbit" | "keepRange";
  targetId: string;
  rangePx: number;
  dir: 1 | -1;
}

export interface FireSelectedTurretCommand {
  type: "fireSelectedTurret";
  payload?: { isAutoFire?: boolean };
}

export interface DockCommand {
  type: "dock";
  payload?: { stationId?: string };
}

export interface UndockCommand {
  type: "undock";
}

export interface WarpCommand {
  type: "warp";
  payload?: { targetIdx?: number };
}

export interface InteractSiteCommand {
  type: "interactSite";
}

export interface SetFireControlSlotCommand {
  type: "setFireControlSlot";
  payload: { slot: number };
}

export interface ToggleSlotDefaultActionCommand {
  type: "toggleSlotDefaultAction";
  payload: { rack: string; idx: number };
}

export interface AssignModuleSlotToTargetCommand {
  type: "assignModuleSlotToTarget";
  payload: {
    slotIdx: number;
    targetId: string | null;
    opts?: { clearAssign?: boolean; silent?: boolean };
  };
}

export interface SetHighTargetCommand {
  type: "setHighTarget";
  payload: { idx: number; targetId: string | null };
}

export interface SyncTutorialStepCommand {
  type: "syncTutorialStep";
  payload: Player["tutorial"];
}

export interface SkipTutorialCommand {
  type: "skipTutorial";
  payload: { primeIdx: number };
}

export interface CompleteSiteCommand {
  type: "completeSite";
  payload: {
    siteId: string;
    payload: number;
    integrity: number;
    partial: boolean;
  };
}

export interface RequestSensorLockCommand {
  type: "requestSensorLock";
  payload: { id: string };
}

export interface RemoveSensorLockCommand {
  type: "removeSensorLock";
  payload: { id: string };
}

export interface SelectLockTargetCommand {
  type: "selectLockTarget";
  payload: { id: string };
}

export interface ClearSensorLocksCommand {
  type: "clearSensorLocks";
}

export interface QueueIndustryJobCommand {
  type: "queueIndustryJob";
  payload: { recipeId: string; qty: number };
}

export interface CancelIndustryJobCommand {
  type: "cancelIndustryJob";
  payload: { jobId: string };
}

export interface BuyBlueprintCommand {
  type: "buyBlueprint";
  payload: { recipeId: string };
}

export interface BuyAmmunitionCommand {
  type: "buyAmmunition";
  payload: { ammoType: "hybrid" | "missile" };
}

export interface SellCargoResourceCommand {
  type: "sellCargoResource";
  payload: { category: "ore" | "refined" | "loot" | "components"; key: string };
}

export interface SetHomeSystemCommand {
  type: "setHomeSystem";
}

export interface JettisonItemCommand {
  type: "jettisonItem";
  payload: { itemId: string; qty?: number | null };
}

export interface RepairShipCommand {
  type: "repairShip";
}

export interface FitModuleCommand {
  type: "fitModule";
  payload: { rack: "turret" | "high" | "med" | "low"; slotIdx: number; instanceId: string };
}

export interface UnfitModuleCommand {
  type: "unfitModule";
  payload: { rack: "turret" | "high" | "med" | "low"; slotIdx: number };
}

export interface SwapModuleCommand {
  type: "swapModule";
  payload: { rack: "turret" | "high" | "med" | "low"; slotIdx: number; instanceId: string };
}

export interface TurnInContractCommand {
  type: "turnInContract";
  payload: { contractId: string };
}

export interface AbandonContractCommand {
  type: "abandonContract";
  payload: { contractId: string };
}

export interface BuyModuleCommand {
  type: "buyModule";
  payload: { moduleId: string };
}

export interface SellModuleCommand {
  type: "sellModule";
  payload: { moduleId: string };
}

export interface AcceptContractCommand {
  type: "acceptContract";
  payload: { contractId: string };
}

export interface ProcessHubFloatingItemCommand {
  type: "processHubFloatingItem";
  payload: { itemId: string };
}

export interface SmeltHubOreCommand {
  type: "smeltHubOre";
  payload: { oreKey: string; qty: number };
}

export interface CollectHubOutputCommand {
  type: "collectHubOutput";
}

export type GameCommand =
  | FireSelectedTurretCommand
  | DockCommand
  | UndockCommand
  | WarpCommand
  | InteractSiteCommand
  | SetFireControlSlotCommand
  | ToggleSlotDefaultActionCommand
  | AssignModuleSlotToTargetCommand
  | SetHighTargetCommand
  | SyncTutorialStepCommand
  | SkipTutorialCommand
  | CompleteSiteCommand
  | RequestSensorLockCommand
  | RemoveSensorLockCommand
  | SelectLockTargetCommand
  | ClearSensorLocksCommand
  | QueueIndustryJobCommand
  | CancelIndustryJobCommand
  | BuyBlueprintCommand
  | BuyAmmunitionCommand
  | SellCargoResourceCommand
  | SetHomeSystemCommand
  | JettisonItemCommand
  | RepairShipCommand
  | FitModuleCommand
  | UnfitModuleCommand
  | SwapModuleCommand
  | TurnInContractCommand
  | AbandonContractCommand
  | BuyModuleCommand
  | SellModuleCommand
  | AcceptContractCommand
  | ProcessHubFloatingItemCommand
  | SmeltHubOreCommand
  | CollectHubOutputCommand;

const RACK_SET = new Set<string>(RACK_TYPES);

function isRackId(value: string): value is RackId {
  return RACK_SET.has(value);
}

function isValidSlotIndex(idx: number, rack: string, p: Player): boolean {
  return Number.isInteger(idx) && idx >= 0 && idx < (p.fitting?.[rack]?.length ?? 0);
}

function isValidHardpointIndex(idx: number, p: Player): boolean {
  const rack = playerHardpointRack(p);
  return isValidSlotIndex(idx, rack, p);
}

function isFiniteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function refreshStationOffers(p: Player, stationId: string | null): void {
  if (!stationId) {
    PlayerAccess.setStationOffers([], null, p);
    return;
  }
  const sys = getState().GALAXY[p.sysIdx];
  const station = sys?.stations.find((st) => st.id === stationId) ?? null;
  if (!station) {
    PlayerAccess.setStationOffers([], null, p);
    return;
  }
  const ring = sys?.ring ?? 0;
  const offers: MissionContract[] = generateContractsForStation(station, p.sysIdx, ring);
  PlayerAccess.setStationOffers(offers, station.id, p);
}

export function executeGameCommand(command: GameCommand, p: Player): void {
  switch (command.type) {
    case "fireSelectedTurret":
      fireSelectedTurret(command.payload?.isAutoFire ?? false, p);
      break;
    case "interactSite":
      tryInteractSite(p);
      break;
    case "warp":
      tryWarp(p);
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
      // Ability modules fire directly on the server's player copy.
      if (m.ability && ABILITY_BY_ID[m.ability]) {
        tryActivateAbility(m.ability, p);
        break;
      }
      // Cycling guard: discard if the server already started a cycle for this slot.
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
    case "queueIndustryJob":
      if (!command.payload.recipeId) break;
      if (!Number.isFinite(command.payload.qty) || command.payload.qty <= 0 || !Number.isInteger(command.payload.qty)) break;
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
      fitModuleAction(command.payload.rack, command.payload.slotIdx, command.payload.instanceId, p);
      break;
    case "unfitModule":
      unfitModuleAction(command.payload.rack, command.payload.slotIdx, p);
      break;
    case "swapModule":
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
    case "smeltHubOre":
      if (!command.payload.oreKey) break;
      if (!Number.isFinite(command.payload.qty) || command.payload.qty <= 0 || !Number.isInteger(command.payload.qty)) break;
      smeltFromDeposit(command.payload.oreKey, command.payload.qty, p);
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
    case "dock":
      if (command.payload?.stationId) {
        const sys = getState().GALAXY[p.sysIdx];
        const station = sys?.stations.find((st) => st.id === command.payload?.stationId) ?? null;
        if (station) {
          checkDeliveryContracts(station, p);
        }
        refreshStationOffers(p, command.payload.stationId);
      }
      clearSensorLocks(p);
      PlayerAccess.updatePhysics({ vx: 0, vy: 0 }, p);
      PlayerAccess.setInvincible(1.5, p);
      break;
    case "undock": {
      for (const rack of ["high", "med", "low"] as const) {
        const arr = p.slotActive?.[rack];
        if (!arr) continue;
        for (let i = 0; i < arr.length; i++) PlayerAccess.setSlotActive(rack, i, false, p);
      }
      PlayerAccess.setInvincible(1.5, p);
      PlayerAccess.setShieldCd(0, p);
      const stats = getStats(p);
      if (stats.maxShield > 0) PlayerAccess.setShield(stats.maxShield, p);
      if (p.turretPower) PlayerAccess.setTurretPowerAll(Array(p.turretPower.length).fill(false), p);
      if (p.turretPowerCd) PlayerAccess.setTurretPowerCdAll(Array(p.turretPowerCd.length).fill(0), p);
      PlayerAccess.setStationOffers([], null, p);
      break;
    }
    case "syncTutorialStep":
      PlayerAccess.setTutorialState(command.payload, p);
      resetTutorialTrackState(p);
      break;
    case "skipTutorial": {
      PlayerAccess.setTutorialSkipped(p);
      PlayerAccess.setTutorialComplete(p);
      PlayerAccess.setHomeSysIdx(command.payload.primeIdx, p);
      warpTo(command.payload.primeIdx, p);
      clearWarpPresentation(p);
      resetTutorialTrackState(p);
      if (p.contracts) {
        const idx = p.contracts.findIndex((contract) => contract.id === "mc_academy_training");
        if (idx >= 0) PlayerAccess.removeContract(idx, p);
      }
      break;
    }
  }
}
