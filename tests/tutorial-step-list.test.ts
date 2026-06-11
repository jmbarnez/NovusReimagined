import { describe, it, expect } from "vitest";
import { TUTORIAL_STEPS, TUTORIAL_STEP_COUNT } from "../src/data/tutorial.js";
import { ENEMY_SPAWNS } from "../src/data/enemy-spawns.js";

describe("tutorial step list", () => {
  it("has fourteen steps with hangar fitting legs before mining and gunnery", () => {
    expect(TUTORIAL_STEP_COUNT).toBe(14);
    expect(TUTORIAL_STEPS.map((s) => s.id)).toEqual([
      "piloting-choice",
      "boost-try",
      "fly-academy",
      "hangar-high",
      "fly-mining",
      "targeting",
      "mining",
      "fly-station",
      "industry",
      "hangar-turrets",
      "fly-gunnery",
      "gunnery",
      "fly-gate",
      "graduation",
    ]);
  });

  it("uses only target dummies in the tutorial target range spawn", () => {
    expect(ENEMY_SPAWNS["sys-0"]).toEqual([
      expect.objectContaining({
        name: "Target Range",
        enemies: [{ type: "target_dummy", count: 3, level: 1 }],
      }),
    ]);
  });
});
