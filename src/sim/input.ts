import { Client, type Player } from "../state.js";
import type { GameCommand, InputNavCommand } from "./commands.js";
export type GameAction = GameCommand;

const pendingFrameActions: GameCommand[] = [];

export interface InputFrame {
  tick: number;
  keys: {
    space: boolean;
    w: boolean;
    a: boolean;
    s: boolean;
    d: boolean;
  };
  mouseWorld: { x: number; y: number };
  waypoint: { x: number; y: number } | null;
  navCommand: InputNavCommand | null;
  movementControlMode: "waypoint" | "direct";
  actions: GameCommand[];
}

const MAX_INPUT_COORD = 1_000_000;
const MAX_NAV_RANGE = 10_000;
const MAX_ACTIONS_PER_FRAME = 16;
const RACK_IDS = new Set(["turret", "high", "med", "low"]);
const AMMO_TYPES = new Set(["hybrid", "missile"]);
const RESOURCE_CATEGORIES = new Set(["ore", "loot", "components"]);
const HEAT_MODES = new Set(["cool", "stable", "hot"]);

function finiteOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function clampFinite(value: unknown, min: number, max: number): number {
  return Math.max(min, Math.min(max, finiteOrZero(value)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringPayload(action: Record<string, unknown>, key: string): string | null {
  const payload = action.payload;
  if (!isRecord(payload)) return null;
  const value = payload[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberPayload(action: Record<string, unknown>, key: string): number | null {
  const payload = action.payload;
  if (!isRecord(payload)) return null;
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function optionalPayloadRecord(action: Record<string, unknown>): Record<string, unknown> {
  return isRecord(action.payload) ? action.payload : {};
}

function sanitizeAction(action: Record<string, unknown>): GameCommand | null {
  switch (action.type) {
    case "fireSelectedTurret": {
      const payload = optionalPayloadRecord(action);
      return { type: "fireSelectedTurret", payload: { isAutoFire: payload.isAutoFire === true } };
    }
    case "dock": {
      const payload = optionalPayloadRecord(action);
      return typeof payload.stationId === "string" ? { type: "dock", payload: { stationId: payload.stationId } } : { type: "dock" };
    }
    case "undock":
    case "interactSite":
    case "clearSensorLocks":
    case "setHomeSystem":
    case "repairShip":
    case "collectHubOutput":
      return { type: action.type };
    case "warp": {
      const targetIdx = numberPayload(action, "targetIdx");
      return targetIdx == null ? { type: "warp" } : { type: "warp", payload: { targetIdx } };
    }
    case "setFireControlSlot": {
      const slot = numberPayload(action, "slot");
      return slot == null ? null : { type: "setFireControlSlot", payload: { slot } };
    }
    case "toggleSlotDefaultAction": {
      const payload = optionalPayloadRecord(action);
      if (typeof payload.rack !== "string" || !RACK_IDS.has(payload.rack)) return null;
      if (typeof payload.idx !== "number" || !Number.isFinite(payload.idx)) return null;
      return { type: "toggleSlotDefaultAction", payload: { rack: payload.rack, idx: payload.idx } };
    }
    case "assignModuleSlotToTarget": {
      const payload = optionalPayloadRecord(action);
      if (typeof payload.slotIdx !== "number" || !Number.isFinite(payload.slotIdx)) return null;
      if (payload.targetId !== null && typeof payload.targetId !== "string") return null;
      const opts = isRecord(payload.opts)
        ? { clearAssign: payload.opts.clearAssign === true, silent: payload.opts.silent === true }
        : undefined;
      return { type: "assignModuleSlotToTarget", payload: { slotIdx: payload.slotIdx, targetId: payload.targetId, opts } };
    }
    case "setHighTarget": {
      const payload = optionalPayloadRecord(action);
      if (typeof payload.idx !== "number" || !Number.isFinite(payload.idx)) return null;
      if (payload.targetId !== null && typeof payload.targetId !== "string") return null;
      return { type: "setHighTarget", payload: { idx: payload.idx, targetId: payload.targetId } };
    }
    case "syncTutorialStep": {
      return isRecord(action.payload) ? { type: "syncTutorialStep", payload: action.payload as Player["tutorial"] } : null;
    }
    case "skipTutorial": {
      const primeIdx = numberPayload(action, "primeIdx");
      return primeIdx == null ? null : { type: "skipTutorial", payload: { primeIdx } };
    }
    case "completeSite": {
      const payload = optionalPayloadRecord(action);
      if (typeof payload.siteId !== "string") return null;
      if (typeof payload.payload !== "number" || typeof payload.integrity !== "number") return null;
      return { type: "completeSite", payload: { siteId: payload.siteId, payload: payload.payload, integrity: payload.integrity, partial: payload.partial === true } };
    }
    case "requestSensorLock":
    case "removeSensorLock":
    case "selectLockTarget": {
      const id = stringPayload(action, "id");
      return id == null ? null : { type: action.type, payload: { id } };
    }
    case "setTractorTightness": {
      const value = numberPayload(action, "value");
      return value == null ? null : { type: "setTractorTightness", payload: { value } };
    }
    case "setMapScannerPower": {
      const payload = optionalPayloadRecord(action);
      return { type: "setMapScannerPower", payload: { active: payload.active === true } };
    }
    case "setMapScannerCone": {
      const coneDeg = numberPayload(action, "coneDeg");
      return coneDeg === 180 || coneDeg === 90 || coneDeg === 45 || coneDeg === 15
        ? { type: "setMapScannerCone", payload: { coneDeg } }
        : null;
    }
    case "setMapScannerStrength":
    case "startScanPulse": {
      const key = action.type === "setMapScannerStrength" ? "strength" : "angleDeg";
      const value = numberPayload(action, key);
      return value == null ? null : { type: action.type, payload: { [key]: value } } as GameCommand;
    }
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
      return ammoType != null && AMMO_TYPES.has(ammoType) ? { type: "buyAmmunition", payload: { ammoType: ammoType as "hybrid" | "missile" } } : null;
    }
    case "sellCargoResource": {
      const payload = optionalPayloadRecord(action);
      if (typeof payload.category !== "string" || !RESOURCE_CATEGORIES.has(payload.category)) return null;
      if (typeof payload.key !== "string") return null;
      return { type: "sellCargoResource", payload: { category: payload.category as "ore" | "loot" | "components", key: payload.key } };
    }
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
      const heatMode = typeof payload.heatMode === "string" && HEAT_MODES.has(payload.heatMode) ? payload.heatMode as "cool" | "stable" | "hot" : undefined;
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
      const heatMode = typeof payload.heatMode === "string" && HEAT_MODES.has(payload.heatMode) ? payload.heatMode as "cool" | "stable" | "hot" : undefined;
      return materialId == null ? null : { type: "separateHubMaterial", payload: { materialId, heatMode } };
    }
    case "alloyHubMaterial": {
      const payload = optionalPayloadRecord(action);
      if (typeof payload.materialId !== "string") return null;
      const heatMode = typeof payload.heatMode === "string" && HEAT_MODES.has(payload.heatMode) ? payload.heatMode as "cool" | "stable" | "hot" : undefined;
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

function sanitizePoint(value: unknown): { x: number; y: number } | null {
  if (!isRecord(value)) return null;
  return {
    x: clampFinite(value.x, -MAX_INPUT_COORD, MAX_INPUT_COORD),
    y: clampFinite(value.y, -MAX_INPUT_COORD, MAX_INPUT_COORD),
  };
}

function sanitizeNavCommand(value: unknown): InputNavCommand | null {
  if (!isRecord(value)) return null;
  if (value.mode !== "orbit" && value.mode !== "keepRange") return null;
  if (typeof value.targetId !== "string") return null;
  return {
    mode: value.mode,
    targetId: value.targetId,
    rangePx: clampFinite(value.rangePx, 0, MAX_NAV_RANGE),
    dir: value.dir === -1 ? -1 : 1,
  };
}

function sanitizeActions(value: unknown): GameCommand[] {
  if (!Array.isArray(value)) return [];
  const actions: GameCommand[] = [];
  for (let i = 0; i < value.length && actions.length < MAX_ACTIONS_PER_FRAME; i++) {
    const action = value[i];
    if (!isRecord(action) || typeof action.type !== "string") continue;
    const sanitized = sanitizeAction(action);
    if (sanitized) actions.push(sanitized);
  }
  return actions;
}

export function sanitizeInputFrame(value: unknown): InputFrame | null {
  if (!isRecord(value)) return null;
  const keys = isRecord(value.keys) ? value.keys : {};
  const mouseWorld = sanitizePoint(value.mouseWorld) ?? { x: 0, y: 0 };
  const waypoint = value.waypoint === null || value.waypoint === undefined
    ? null
    : sanitizePoint(value.waypoint);

  return {
    tick: Number.isInteger(value.tick) ? finiteOrZero(value.tick) : 0,
    keys: {
      space: keys.space === true,
      w: keys.w === true,
      a: keys.a === true,
      s: keys.s === true,
      d: keys.d === true,
    },
    mouseWorld,
    waypoint,
    navCommand: sanitizeNavCommand(value.navCommand),
    movementControlMode: value.movementControlMode === "direct" ? "direct" : "waypoint",
    actions: sanitizeActions(value.actions),
  };
}

/** Stage a discrete command for the next input frame sent to the authoritative server. */
export function queueFrameAction(command: GameCommand, opts?: { replaceByType?: boolean }): void {
  if (opts?.replaceByType) {
    const existingIdx = pendingFrameActions.findIndex((entry) => entry.type === command.type);
    if (existingIdx >= 0) {
      pendingFrameActions[existingIdx] = command;
      return;
    }
  }
  pendingFrameActions.push(command);
}

export function applyInputFrameToPlayer(frame: InputFrame, p: Player): void {
  p.inputKeys = { space: frame.keys.space, w: frame.keys.w, a: frame.keys.a, s: frame.keys.s, d: frame.keys.d };
  p.inputMouseWorld = { x: frame.mouseWorld.x, y: frame.mouseWorld.y };
  p.movementControlMode = frame.movementControlMode;
  p.waypoint = frame.waypoint;
  p.navCommand = frame.navCommand;
}

export function createLocalInputFrame(tickNum: number): InputFrame {
  const actions = pendingFrameActions.splice(0, pendingFrameActions.length);

  if (
    Client.mouse.lmb &&
    !Client.keys["shift"] &&
    Client.gameStarted &&
    !Client.stationOpen &&
    !Client.bridgeOpen &&
    !Client.showMap &&
    !Client.settingsOpen
  ) {
    actions.push({ type: "fireSelectedTurret", payload: { isAutoFire: false } });
  }

  return {
    tick: tickNum,
    keys: {
      space: !!Client.keys[" "],
      w: Client.settings.movementControlMode === "direct" && !!Client.keys["w"],
      a: Client.settings.movementControlMode === "direct" && !!Client.keys["a"],
      s: Client.settings.movementControlMode === "direct" && !!Client.keys["s"],
      d: Client.settings.movementControlMode === "direct" && !!Client.keys["d"],
    },
    mouseWorld: {
      x: Client.mouseWorld?.x ?? 0,
      y: Client.mouseWorld?.y ?? 0,
    },
    waypoint: Client.settings.movementControlMode === "waypoint" && Client.waypoint ? { ...Client.waypoint } : null,
    navCommand: Client.settings.movementControlMode === "waypoint" && Client.navCommand ? { ...Client.navCommand } : null,
    movementControlMode: Client.settings.movementControlMode,
    actions,
  };
}
