import type { Keybinds } from "./data/settings.js";

const LEGACY_PANEL_TOGGLE_KEYS = {
  overview: "KeyP",
  eventLog: "KeyC",
} as const;

export function isOverviewToggleHotkey(code: string, keybinds: Keybinds): boolean {
  return code === keybinds.overview || code === LEGACY_PANEL_TOGGLE_KEYS.overview;
}

export function isEventLogToggleHotkey(
  code: string,
  keybinds: Keybinds,
  modifiers: { ctrlKey: boolean; metaKey: boolean; altKey: boolean },
): boolean {
  if (modifiers.ctrlKey || modifiers.metaKey || modifiers.altKey) return false;
  return code === keybinds.eventLog || code === LEGACY_PANEL_TOGGLE_KEYS.eventLog;
}
