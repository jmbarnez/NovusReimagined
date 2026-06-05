import type { Player } from "../../state.js";
import type { RefiningHeatMode } from "../../state.js";

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

export interface SetTractorTightnessCommand {
  type: "setTractorTightness";
  payload: { value: number };
}

export interface SetMapScannerPowerCommand {
  type: "setMapScannerPower";
  payload: { active: boolean };
}

export interface SetMapScannerConeCommand {
  type: "setMapScannerCone";
  payload: { coneDeg: 180 | 90 | 45 | 15 };
}

export interface SetMapScannerStrengthCommand {
  type: "setMapScannerStrength";
  payload: { strength: number };
}

export interface StartScanPulseCommand {
  type: "startScanPulse";
  payload: { angleDeg: number };
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
  payload: { category: "ore" | "loot" | "components"; key: string };
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

export interface ProcessHubMixedOreCommand {
  type: "processHubMixedOre";
  payload: { cargoIndex: number; qty: number; heatMode?: RefiningHeatMode; targetStorageId?: string | null };
}

export interface SeparateHubMaterialCommand {
  type: "separateHubMaterial";
  payload: { materialId: string; heatMode?: RefiningHeatMode };
}

export interface AlloyHubMaterialCommand {
  type: "alloyHubMaterial";
  payload: {
    materialId: string;
    sourceMaterialIds?: string[];
    targetAlloyFamilyId?: string | null;
    heatMode?: RefiningHeatMode;
    targetStorageId?: string | null;
  };
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
  | SetTractorTightnessCommand
  | SetMapScannerPowerCommand
  | SetMapScannerConeCommand
  | SetMapScannerStrengthCommand
  | StartScanPulseCommand
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
  | ProcessHubMixedOreCommand
  | SeparateHubMaterialCommand
  | AlloyHubMaterialCommand
  | CollectHubOutputCommand;
