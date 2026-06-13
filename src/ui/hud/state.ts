import type { SlotNode } from "./slots.js";
import type { LockCard } from "./targeting/index.js";

export const hudState = {
  root: null as HTMLElement | null,
  sysName: null as HTMLElement | null,
  secEl: null as HTMLElement | null,
  lockRail: null as HTMLElement | null,
  ovEntries: null as HTMLElement | null,
  ovPanel: null as HTMLElement | null,
  ovSortKey: "dist" as "state" | "class" | "name" | "dist",
  ovSortDir: 1 as 1 | -1,
  dockPrompt: null as HTMLElement | null,
  statusGroups: [] as HTMLElement[],
  statusFills: [] as HTMLElement[],
  boostStatus: null as HTMLElement | null,
  slotsContainer: null as HTMLElement | null,
  slotNodes: new Map<string, SlotNode>(),
  lockCards: new Map<string, LockCard>(),
  lastLockCount: 0,
  lastSlotState: "",

  turretCtxMenu: null as HTMLElement | null,
  enemyCtxMenu: null as HTMLElement | null,

  logEntries: null as HTMLElement | null,
  logPanel: null as HTMLElement | null,
  logBody: null as HTMLElement | null,
  logTab: null as HTMLElement | null,

  xpPopup: null as HTMLElement | null,
  xpAccum: new Map<string, number>(),
  xpBefore: new Map<string, number>(),
  xpHideTimer: null as number | null,
  xpClearTimer: null as number | null,

  minimapContainer: null as HTMLElement | null,
  pickupContainer: null as HTMLElement | null,
};

export const MAX_LOG_ENTRIES = 50;
export const XP_VISIBLE_MS = 1500;
export const XP_FADE_MS = 600;

export const RACK_ORDER = ["turret", "high", "med", "low"];
export const RACK_COLORS: Record<string, string> = {
  turret: "#a08058",
  high: "#9c9048",
  med: "#4890a0",
  low: "#6a7888",
};

import { SKILL_IDS, SKILL_DEF } from "../../data/skills.js";

export const SKILL_NAMES: Record<string, string> = Object.fromEntries(SKILL_IDS.map(id => [id, SKILL_DEF[id].name]));
export const SKILL_ICONS: Record<string, string> = Object.fromEntries(SKILL_IDS.map(id => [id, SKILL_DEF[id].icon]));
