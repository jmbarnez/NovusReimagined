/**
 * Lightweight typed event bus for cross-module communication.
 */

import type { Station } from "./types/world.js";
import type { AppMode } from "./state.js";
import type { Gate } from "./types/world.js";

export interface EventMap {
  "simulation:clear": void;
  "ui:close-overlays": void;
  "module:toggle": { rack: string; idx: number; active: boolean; moduleId: string };
  "player:respawn": { homeIdx: number; penalty: number };
  "mission:accepted": { contract: import("./data/missions.js").MissionContract };
  "mission:completed": { contract: import("./data/missions.js").MissionContract };
  "station:open": { station: Station };
  "station:close": void;
  "sector:crossed": { toIdx: number };
  "net:tick-sync": { tick: number; resetPrediction?: boolean };
  "app:mode-change": { mode: AppMode; prevMode: AppMode };
  "tutorial:step-change": { step: number };
  "tutorial:step-complete": { step: number; id: string };
  "tutorial:hangar-tour-change": void;
  "tutorial:refinery-tour-change": void;

  "tutorial:complete": { sysIdx: number };
  "tutorial:skip": { sysIdx: number };
  "inventory:changed": void;
  "inventory:grid-move": { containerId: string; fromSlot: number; toSlot: number };
  "inventory:grid-swap": { containerId: string; fromSlot: number; toSlot: number };
  "inventory:grid-insert": { containerId: string; fromSlot: number; toVisualIndex: number };
  "warp:request": { gateId: string };
  "warp:charging": { gateId: string; duration: number; targetX: number; targetY: number };
  "warp:complete": { playerId: string; targetX: number; targetY: number };
  "warp:exit-spawn": { gate: Gate; duration: number };
  "warp:exit-despawn": { gateId: string };
}

const _handlers: Partial<Record<string, Array<(data: unknown) => void>>> = {};

export function on<K extends keyof EventMap>(event: K, cb: (data: EventMap[K]) => void): () => void {
  const key = event as string;
  if (!_handlers[key]) _handlers[key] = [];
  _handlers[key]!.push(cb as (data: unknown) => void);
  return () => off(event, cb);
}

export function off<K extends keyof EventMap>(event: K, cb: (data: EventMap[K]) => void) {
  const key = event as string;
  if (!_handlers[key]) return;
  _handlers[key] = _handlers[key]!.filter((h) => h !== cb);
}

export function emit<K extends keyof EventMap>(event: K, data?: EventMap[K]) {
  const key = event as string;
  if (!_handlers[key]) return;
  for (const cb of _handlers[key]!) {
    try {
      cb(data);
    } catch (err) {
      console.error(`[events] error in handler for "${key}":`, err);
    }
  }
}

export function offAll(event?: string) {
  if (event) {
    delete _handlers[event];
  } else {
    for (const key of Object.keys(_handlers)) {
      delete _handlers[key];
    }
  }
}
