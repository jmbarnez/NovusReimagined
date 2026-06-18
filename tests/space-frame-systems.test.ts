import { describe, expect, it } from "vitest";
import { perfStrings } from "../src/data/strings/perf.js";
import { SPACE_FRAME_SYSTEM_IDS } from "../src/render/space-frame-system-order.js";

describe("space frame render systems", () => {
  it("keeps the expected frame sync order stable", () => {
    expect([...SPACE_FRAME_SYSTEM_IDS]).toEqual([
      "decayVisuals",
      "bg",
      "particles",
      "stations",
      "entities",
      "player",
      "trails",
      "planets",
      "celestial",
      "combat",
      "effects",
      "asteroids",
      "hiteffects",
      "tutmarkers",
      "borders",
      "tuttrack",
      "tutgates",
      "stoverlays",
      "stturrets",
      "lensflare",
      "dmgflash",
      "shockwaves",
      "floattexts",
      "chat",
      "worldborder",
      "crosshair",
      "map",
      "thrust",
      "hud",
      "tarrows",
      "guidearrow",
      "vignette",
      "renderPixi",
      "mapoverlays",
      "minimap",
      "warpscreen",
    ]);
  });

  it("has perf labels for every timed frame render system", () => {
    for (const id of SPACE_FRAME_SYSTEM_IDS) {
      expect(perfStrings.en[`perf.section.${id}`]).toBeTruthy();
      expect(perfStrings.es[`perf.section.${id}`]).toBeTruthy();
    }
  });
});
