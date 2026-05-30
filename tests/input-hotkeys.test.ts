import { describe, expect, it } from "vitest";
import { DEFAULT_KEYBINDS } from "../src/data/settings.js";
import { isEventLogToggleHotkey, isOverviewToggleHotkey } from "../src/input-hotkeys.js";

describe("HUD panel hotkeys", () => {
  it("accepts the configured overview key and the legacy P alias", () => {
    expect(isOverviewToggleHotkey(DEFAULT_KEYBINDS.overview, DEFAULT_KEYBINDS)).toBe(true);
    expect(isOverviewToggleHotkey("KeyP", { ...DEFAULT_KEYBINDS, overview: "KeyO" })).toBe(true);
  });

  it("accepts the configured comms-log key and the legacy C alias", () => {
    const keybinds = { ...DEFAULT_KEYBINDS, eventLog: "KeyL" };
    const noMods = { ctrlKey: false, metaKey: false, altKey: false };
    expect(isEventLogToggleHotkey("KeyL", keybinds, noMods)).toBe(true);
    expect(isEventLogToggleHotkey("KeyC", keybinds, noMods)).toBe(true);
  });

  it("rejects comms-log toggles while ctrl/cmd/alt are held", () => {
    const keybinds = { ...DEFAULT_KEYBINDS, eventLog: "KeyL" };
    expect(isEventLogToggleHotkey("KeyC", keybinds, { ctrlKey: true, metaKey: false, altKey: false })).toBe(false);
    expect(isEventLogToggleHotkey("KeyL", keybinds, { ctrlKey: false, metaKey: true, altKey: false })).toBe(false);
    expect(isEventLogToggleHotkey("KeyL", keybinds, { ctrlKey: false, metaKey: false, altKey: true })).toBe(false);
  });
});
