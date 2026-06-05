import { beforeEach, describe, it, expect } from "vitest";
import { CONTROL_SECTIONS, DEFAULT_KEYBINDS, DEFAULT_SETTINGS, loadSettings, type Keybinds } from "../src/data/settings.js";

const ALL_ACTIONS = Object.keys(DEFAULT_KEYBINDS) as (keyof Keybinds)[];

describe("CONTROL_SECTIONS integrity", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("lists every keybind exactly once", () => {
    const seen: string[] = [];

    for (const section of CONTROL_SECTIONS) {
      for (const action of section.actions) {
        seen.push(action.action);
      }
    }

    const deduped = new Set(seen);
    expect(deduped.size).toBe(seen.length);
    expect([...deduped].sort()).toEqual([...ALL_ACTIONS].sort());
  });

  it("provides human-readable metadata keys for each section and action", () => {
    for (const section of CONTROL_SECTIONS) {
      expect(section.titleKey.trim().length).toBeGreaterThan(0);
      expect(section.actions.length).toBeGreaterThan(0);
      for (const action of section.actions) {
        expect(action.labelKey.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("migrates legacy thrust keybind saves to forward thrust", () => {
    localStorage.setItem("novus-settings-v1", JSON.stringify({ keybinds: { thrust: "KeyT" } }));

    const settings = loadSettings();

    expect(settings.keybinds.forwardThrust).toBe("KeyT");
    expect(settings.keybinds.reverseThrust).toBe(DEFAULT_KEYBINDS.reverseThrust);
  });

  it("defaults new settings to VSync render cadence", () => {
    const settings = loadSettings();

    expect(DEFAULT_SETTINGS.fpsLimit).toBe(0);
    expect(settings.fpsLimit).toBe(0);
  });

  it("falls back invalid saved FPS limits to VSync", () => {
    localStorage.setItem("novus-settings-v1", JSON.stringify({ fpsLimit: "fast" }));

    const settings = loadSettings();

    expect(settings.fpsLimit).toBe(0);
  });

  it("preserves finite saved FPS limits", () => {
    localStorage.setItem("novus-settings-v1", JSON.stringify({ fpsLimit: 240 }));

    const settings = loadSettings();

    expect(settings.fpsLimit).toBe(240);
  });
});
