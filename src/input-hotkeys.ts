import type { Keybinds } from "./data/settings.js";

export function isOverviewToggleHotkey(code: string, keybinds: Keybinds): boolean {
  return code === keybinds.overview || code === "KeyP";
}

export function isEventLogToggleHotkey(
  code: string,
  keybinds: Keybinds,
  modifiers: { ctrlKey: boolean; metaKey: boolean; altKey: boolean },
): boolean {
  if (modifiers.ctrlKey || modifiers.metaKey || modifiers.altKey) return false;
  return code === keybinds.eventLog || code === "KeyC";
}
