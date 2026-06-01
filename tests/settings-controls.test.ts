import { describe, it, expect } from "vitest";
import { CONTROL_SECTIONS, DEFAULT_KEYBINDS, type Keybinds } from "../src/data/settings.js";

const ALL_ACTIONS = Object.keys(DEFAULT_KEYBINDS) as (keyof Keybinds)[];

describe("CONTROL_SECTIONS integrity", () => {
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
});
