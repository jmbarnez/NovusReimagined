import { Client, type Player } from "../state.js";
import type { GameCommand } from "./commands.js";
export type GameAction = GameCommand;

import {
  MAX_INPUT_COORD,
  clampFinite,
  finiteOrZero,
  isRecord,
} from "./input/sanitize-helpers.js";
import { sanitizeCombatAction } from "./input/sanitizers/combat.js";
import { sanitizeScanningAction } from "./input/sanitizers/scanning.js";
import { sanitizeIndustryAction } from "./input/sanitizers/industry.js";
import { sanitizeSitesAction } from "./input/sanitizers/sites.js";
import { sanitizeDockingAction } from "./input/sanitizers/docking.js";
import { sanitizeWarpAction } from "./input/sanitizers/warp.js";
import { sanitizeTutorialAction } from "./input/sanitizers/tutorial.js";
import { setPlayerInput } from "../player/input-state.js";

const pendingFrameActions: GameCommand[] = [];

export interface InputFrame {
  tick: number;
  keys: {
    space: boolean;
    w: boolean;
    a: boolean;
    s: boolean;
    d: boolean;
    boost: boolean;
    warp: boolean;
    lmb: boolean;
  };
  mouseWorld: { x: number; y: number };
  actions: GameCommand[];
}

const MAX_ACTIONS_PER_FRAME = 16;

/**
 * Dispatch an untrusted action record to its domain sanitizer.
 *
 * The switch narrows `action.type` to a known command surface and delegates
 * to the matching per-domain sanitizer under `./input/sanitizers/`. Unknown
 * types fall through to `null` and are dropped by {@link sanitizeActions}.
 */
function sanitizeAction(action: Record<string, unknown>): GameCommand | null {
  switch (action.type) {
    case "fireSelectedTurret":
    case "setFireControlSlot":
    case "toggleSlotDefaultAction":
    case "setTractorTightness":
      return sanitizeCombatAction(action);

    case "setMapScannerPower":
    case "setMapScannerCone":
    case "setMapScannerStrength":
    case "startScanPulse":
      return sanitizeScanningAction(action);

    case "queueIndustryJob":
    case "cancelIndustryJob":
    case "buyBlueprint":
    case "buyAmmunition":
    case "sellCargoResource":
    case "setHomeSystem":
    case "jettisonItem":
    case "repairShip":
    case "fitModule":
    case "unfitModule":
    case "swapModule":
    case "turnInContract":
    case "abandonContract":
    case "buyModule":
    case "sellModule":
    case "acceptContract":
    case "processHubFloatingItem":
    case "processHubMixedOre":
    case "separateHubMaterial":
    case "alloyHubMaterial":
    case "collectHubOutput":
      return sanitizeIndustryAction(action);

    case "interactSite":
    case "completeSite":
      return sanitizeSitesAction(action);

    case "dock":
    case "undock":
      return sanitizeDockingAction(action);

    case "warp":
    case "warpGate":
      return sanitizeWarpAction(action);

    case "syncTutorialStep":
    case "skipTutorial":
      return sanitizeTutorialAction(action);

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

  return {
    tick: Number.isInteger(value.tick) ? finiteOrZero(value.tick) : 0,
    keys: {
      space: keys.space === true,
      w: keys.w === true,
      a: keys.a === true,
      s: keys.s === true,
      d: keys.d === true,
      boost: keys.boost === true,
      warp: keys.warp === true,
      lmb: keys.lmb === true,
    },
    mouseWorld,
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
  const id = p.netId ?? p.shipId;
  setPlayerInput(id, {
    space: frame.keys.space,
    w: frame.keys.w,
    a: frame.keys.a,
    s: frame.keys.s,
    d: frame.keys.d,
    boost: frame.keys.boost,
    warp: frame.keys.warp,
    lmb: frame.keys.lmb,
  }, { x: frame.mouseWorld.x, y: frame.mouseWorld.y });
}

export function createLocalInputFrame(tickNum: number): InputFrame {
  const actions = pendingFrameActions.splice(0, pendingFrameActions.length);

  return {
    tick: tickNum,
    keys: {
      space: !!Client.keys[" "],
      w: !!Client.keys["w"],
      a: !!Client.keys["a"],
      s: !!Client.keys["s"],
      d: !!Client.keys["d"],
      boost: !!Client.keys["boost"],
      warp: !!Client.keys["warp"],
      lmb: Client.mouse.lmb,
    },
    mouseWorld: {
      x: Client.mouseWorld?.x ?? 0,
      y: Client.mouseWorld?.y ?? 0,
    },
    actions,
  };
}
