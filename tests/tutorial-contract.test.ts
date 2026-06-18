import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { _G as G } from "../src/state.js";
import { makePlayer } from "../src/player/player-data.js";
import { installTestPlayer } from "../src/player-registry.js";
import { TUTORIAL_STEPS } from "../src/data/tutorial.js";
import { TUTORIAL_STEP_REWARDS, TUTORIAL_MISSION_CHAIN, TUTORIAL_MISSION_IDS, getTutorialMissionStepCounter } from "../src/tutorial/data/mission.js";
import { skipTutorial, initTutorial, advanceStep } from "../src/tutorial/index.js";
import { SAVE_KEY } from "../src/constants.js";
import { buildGalaxy, populateSystem } from "../src/world-gen.js";
import { isTutorialContract } from "../src/data/missions.js";

function setStepComplete(stepIdx: number): void {
  const step = TUTORIAL_STEPS[stepIdx];
  if (!step) throw new Error(`invalid step ${stepIdx}`);
  const original = step.isComplete;
  step.isComplete = () => true;
  try {
    advanceStep();
  } finally {
    step.isComplete = original;
  }
}

describe("tutorial mission contract", () => {
  it("starts new pilots with an active getting-started tutorial mission", () => {
    const p = installTestPlayer(makePlayer());
    initTutorial();
    expect(p.contracts).toHaveLength(1);
    expect(p.contracts[0]?.type).toBe("tutorial");
    expect(p.contracts[0]?.title).toBe(TUTORIAL_MISSION_CHAIN[0]!.title);
    expect(p.contracts[0]?.objective.required).toBe(TUTORIAL_MISSION_CHAIN[0]!.lastStep - TUTORIAL_MISSION_CHAIN[0]!.firstStep + 1);
    expect(p.contracts[0]?.objective.current).toBe(0);
  });

  it("defines step rewards for every tutorial step", () => {
    for (const step of TUTORIAL_STEPS) {
      expect(TUTORIAL_STEP_REWARDS[step.id], step.id).toBeDefined();
    }
  });

  it("grants the remaining tutorial missions after the first mission completes", () => {
    const p = installTestPlayer(makePlayer());
    initTutorial();
    expect(p.contracts).toHaveLength(1);

    for (let i = 0; i <= 2; i++) {
      setStepComplete(i);
    }

    const tutorialContracts = p.contracts.filter((c) => isTutorialContract(c));
    expect(tutorialContracts).toHaveLength(TUTORIAL_MISSION_CHAIN.length);
    for (const def of TUTORIAL_MISSION_CHAIN) {
      expect(tutorialContracts.some((c) => c.id === def.id)).toBe(true);
    }
  });

  it("updates tutorial mission progress as the player advances steps", () => {
    const p = installTestPlayer(makePlayer());
    initTutorial();

    setStepComplete(0);
    const mission1 = p.contracts.find((c) => c.id === TUTORIAL_MISSION_CHAIN[0]!.id);
    expect(mission1?.objective.current).toBe(1);

    setStepComplete(1);
    expect(mission1?.objective.current).toBe(2);

    setStepComplete(2);
    expect(mission1?.status).toBe("complete");
  });

  it("counts steps within the current tutorial mission", () => {
    expect(getTutorialMissionStepCounter(0)).toEqual({ n: 1, total: 3 });
    expect(getTutorialMissionStepCounter(2)).toEqual({ n: 3, total: 3 });
    expect(getTutorialMissionStepCounter(3)).toEqual({ n: 1, total: 5 });
    expect(getTutorialMissionStepCounter(7)).toEqual({ n: 5, total: 5 });
    expect(getTutorialMissionStepCounter(8)).toEqual({ n: 1, total: 1 });
    expect(getTutorialMissionStepCounter(13)).toEqual({ n: 2, total: 2 });
  });

  it("lists all tutorial missions as active after the first mission completes", () => {
    const p = installTestPlayer(makePlayer());
    initTutorial();

    setStepComplete(0);
    setStepComplete(1);
    setStepComplete(2);

    const tutorialContracts = p.contracts.filter((c) => isTutorialContract(c));
    expect(tutorialContracts.length).toBe(TUTORIAL_MISSION_CHAIN.length);
    expect(tutorialContracts.every((c) => c.status === "active" || c.status === "complete")).toBe(true);
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
    expect(G.P.contracts.some((c) => TUTORIAL_MISSION_IDS.includes(c.id))).toBe(false);
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
