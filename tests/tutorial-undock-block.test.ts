import { describe, it, expect, beforeEach } from "vitest";
import { _G as G, Client } from "../src/state.js";
import { makePlayer } from "../src/player/player-data.js";
import { installTestPlayer } from "../src/player-registry.js";
import { TUTORIAL_STEPS } from "../src/data/tutorial.js";
import { initTutorial, getTutorialSnapshot } from "../src/tutorial/index.js";
import { stepById, ctxAt } from "./tutorial-helpers.js";
import { canUndockFromTutorial } from "../src/ui/station/actions.js";

describe("tutorial undock blocking", () => {
  beforeEach(() => {
    installTestPlayer(makePlayer());
    G.P.tutorial.active = true;
    Client.stationOpen = true;
  });

  it("blocks undock during industry when step is incomplete", () => {
    G.P.tutorial.step = TUTORIAL_STEPS.findIndex((s) => s.id === "industry");
    initTutorial();
    const snapshot = getTutorialSnapshot();
    snapshot.refineryGuideComplete = false;
    expect(canUndockFromTutorial()).toBe(false);
  });

  it("allows undock during industry when step is complete", () => {
    G.P.tutorial.step = TUTORIAL_STEPS.findIndex((s) => s.id === "industry");
    initTutorial();
    G.P.craftQueue = [{ id: "job-1", recipeId: "r1", qty: 1, startTime: 0, duration: 10 }];
    const snapshot = getTutorialSnapshot();
    snapshot.refineryGuidePhase = 4;
    snapshot.refineryGuideComplete = true;
    expect(canUndockFromTutorial()).toBe(true);
  });

  it("blocks undock during hangar-turrets when step is incomplete", () => {
    G.P.tutorial.step = TUTORIAL_STEPS.findIndex((s) => s.id === "hangar-turrets");
    initTutorial();
    const snapshot = getTutorialSnapshot();
    snapshot.hangarReviewComplete = false;
    expect(canUndockFromTutorial()).toBe(false);
  });

  it("allows undock during hangar-turrets when step is complete", () => {
    G.P.tutorial.step = TUTORIAL_STEPS.findIndex((s) => s.id === "hangar-turrets");
    initTutorial();
    G.P.fitting.high[0] = "start-tu-civ-cannon";
    G.P.fitting.high[1] = "start-tu-civ-salvager";
    const snapshot = getTutorialSnapshot();
    snapshot.hangarReviewComplete = true;
    expect(canUndockFromTutorial()).toBe(true);
  });

  it("allows undock when tutorial is not active", () => {
    G.P.tutorial.active = false;
    expect(canUndockFromTutorial()).toBe(true);
  });

  it("allows undock during non-blocking steps", () => {
    G.P.tutorial.step = TUTORIAL_STEPS.findIndex((s) => s.id === "hangar-high");
    initTutorial();
    expect(canUndockFromTutorial()).toBe(true);
  });
});
