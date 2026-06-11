import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { _G as G } from "../src/state.js";
import { makePlayer } from "../src/player/player-data.js";
import { installTestPlayer } from "../src/player-registry.js";
import { TUTORIAL_STEPS, TUTORIAL_STEP_COUNT } from "../src/data/tutorial.js";
import { TUTORIAL_STEP_REWARDS } from "../src/data/tutorial-mission.js";
import { skipTutorial } from "../src/tutorial/index.js";
import { SAVE_KEY } from "../src/constants.js";
import { buildGalaxy, populateSystem } from "../src/world-gen.js";

describe("tutorial mission contract", () => {
  it("starts new pilots with an active academy training mission", () => {
    const p = makePlayer();
    expect(p.contracts).toHaveLength(1);
    expect(p.contracts[0]?.type).toBe("tutorial");
    expect(p.contracts[0]?.objective.required).toBe(TUTORIAL_STEP_COUNT);
    expect(p.contracts[0]?.objective.current).toBe(0);
  });

  it("defines step rewards for every tutorial step", () => {
    for (const step of TUTORIAL_STEPS) {
      expect(TUTORIAL_STEP_REWARDS[step.id], step.id).toBeDefined();
    }
  });
});

describe("tutorial skip", () => {
  beforeEach(() => {
    installTestPlayer(makePlayer());
    G.P.tutorial.active = true;
    G.P.sysIdx = 0;
    G.GALAXY = buildGalaxy();
    populateSystem(G.GALAXY[0]!);
    localStorage.removeItem(SAVE_KEY);
  });

  afterEach(() => {
    localStorage.removeItem(SAVE_KEY);
  });

  it("marks tutorial complete and skipped immediately", () => {
    skipTutorial();
    expect(G.P.tutorial.active).toBe(false);
    expect(G.P.tutorial.completed).toBe(true);
    expect(G.P.tutorial.skipped).toBe(true);
    expect(G.P.homeSysIdx).toBe(1);
    expect(G.P.contracts.some((c) => c.id === "mc_academy_training")).toBe(false);
  });

  it("persists the skipped state to localStorage", () => {
    skipTutorial();
    const raw = localStorage.getItem(SAVE_KEY);
    expect(raw).not.toBeNull();
    const saved = JSON.parse(raw!) as { tutorial: { active: boolean; completed: boolean; skipped: boolean } };
    expect(saved.tutorial.active).toBe(false);
    expect(saved.tutorial.completed).toBe(true);
    expect(saved.tutorial.skipped).toBe(true);
  });
});
