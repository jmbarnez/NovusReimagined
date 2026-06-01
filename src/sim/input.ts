import { Client, type Player } from "../state.js";
import type { GameCommand, InputNavCommand } from "./commands.js";
export type GameAction = GameCommand;

const pendingFrameActions: GameCommand[] = [];

export interface InputFrame {
  tick: number;
  keys: {
    space: boolean;
  };
  mouseWorld: { x: number; y: number };
  waypoint: { x: number; y: number } | null;
  navCommand: InputNavCommand | null;
  actions: GameCommand[];
}

const MAX_INPUT_COORD = 1_000_000;
const MAX_NAV_RANGE = 10_000;
const MAX_ACTIONS_PER_FRAME = 16;

function finiteOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function clampFinite(value: unknown, min: number, max: number): number {
  return Math.max(min, Math.min(max, finiteOrZero(value)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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
    actions.push(action as unknown as GameCommand);
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
    },
    mouseWorld,
    waypoint,
    navCommand: sanitizeNavCommand(value.navCommand),
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
  p.inputKeys = { space: frame.keys.space };
  p.inputMouseWorld = { x: frame.mouseWorld.x, y: frame.mouseWorld.y };
  p.waypoint = frame.waypoint;
  p.navCommand = frame.navCommand;
}

export function createLocalInputFrame(tickNum: number): InputFrame {
  const actions = pendingFrameActions.splice(0, pendingFrameActions.length);

  return {
    tick: tickNum,
    keys: {
      space: !!Client.keys[" "],
    },
    mouseWorld: {
      x: Client.mouseWorld?.x ?? 0,
      y: Client.mouseWorld?.y ?? 0,
    },
    waypoint: Client.waypoint ? { ...Client.waypoint } : null,
    navCommand: Client.navCommand ? { ...Client.navCommand } : null,
    actions,
  };
}
