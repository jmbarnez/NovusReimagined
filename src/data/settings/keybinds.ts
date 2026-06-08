import type { Keybinds, ControlSection } from "./types.js";

export const DEFAULT_KEYBINDS: Keybinds = {
  inventory: "Tab",
  overview: "KeyP",
  map: "KeyM",
  dock: "KeyF",
  warp: "KeyG",
  brake: "Space",
  engineBoost: "ShiftLeft",
  forwardThrust: "KeyW",
  reverseThrust: "KeyS",
  turnLeft: "KeyA",
  turnRight: "KeyD",
  settings: "Escape",
  skills: "KeyK",
  eventLog: "KeyC",
  perf: "Backquote",
};

export const CONTROL_SECTIONS: ControlSection[] = [
  {
    id: "navigation",
    titleKey: "settings.controls.section.navigation",
    actions: [
      { action: "brake", labelKey: "settings.controls.brake" },
      { action: "engineBoost", labelKey: "settings.controls.engineBoost" },
      { action: "forwardThrust", labelKey: "settings.controls.forwardThrust" },
      { action: "reverseThrust", labelKey: "settings.controls.reverseThrust" },
      { action: "turnLeft", labelKey: "settings.controls.turnLeft" },
      { action: "turnRight", labelKey: "settings.controls.turnRight" },
      { action: "dock", labelKey: "settings.controls.dock" },
      { action: "warp", labelKey: "settings.controls.warp" },
      { action: "map", labelKey: "settings.controls.map" },
    ],
  },
  {
    id: "awareness",
    titleKey: "settings.controls.section.awareness",
    actions: [
      { action: "overview", labelKey: "settings.controls.overview" },
      { action: "eventLog", labelKey: "settings.controls.eventLog" },
      { action: "perf", labelKey: "settings.controls.perf" },
    ],
  },
  {
    id: "systems",
    titleKey: "settings.controls.section.systems",
    actions: [
      { action: "inventory", labelKey: "settings.controls.inventory" },
      { action: "skills", labelKey: "settings.controls.skills" },
      { action: "settings", labelKey: "settings.controls.settings" },
    ],
  },
];

export function loadKeybinds(value: unknown): Keybinds {
  if (!value || typeof value !== "object") return { ...DEFAULT_KEYBINDS };
  const saved = value as Partial<Record<keyof Keybinds | "thrust", unknown>>;
  const migrated: Keybinds = { ...DEFAULT_KEYBINDS };
  for (const key of Object.keys(DEFAULT_KEYBINDS) as (keyof Keybinds)[]) {
    const savedValue = saved[key];
    if (typeof savedValue === "string") migrated[key] = savedValue;
  }
  if (typeof saved.thrust === "string" && saved.forwardThrust === undefined) {
    migrated.forwardThrust = saved.thrust;
  }
  return migrated;
}
