import { describe, it, expect, beforeEach } from "vitest";
import { _G as G, Client } from "../src/state.js";
import { makePlayer } from "../src/player/player-data.js";
import { installTestPlayer } from "../src/player-registry.js";
import {
  TUTORIAL_STEPS,
  buildTutorialCtx,
  hasLockOnAsteroid,
  isZoneStepComplete,
  getTutorialNavRemainingM,
  getCurrentTutorialStep,
  getTourPanel,
} from "../src/data/tutorial.js";
import { TUTORIAL_SPAWN, TUTORIAL_BELT_CENTER, TUTORIAL_MINING_ZONE_R, TUTORIAL_HUB, TUTORIAL_GUNNERY_CENTER } from "../src/data/tutorial-layout.js";
import { hasTutorialCombatLoadout } from "../src/data/tutorial.js";
import { getTutorialSnapshot, tickTutorial, canAdvanceTour, advanceTour, initTutorial } from "../src/tutorial/index.js";
import type { Enemy } from "../src/types/enemy.js";
import { stepById, ctxAt, makeSys } from "./tutorial-helpers.js";

describe("fly-academy step completion", () => {
  beforeEach(() => {
    installTestPlayer(makePlayer());
    G.P.tutorial.active = true;
  });

  it("requires reaching the academy hub zone", () => {
    const flyAcademy = stepById("fly-academy");
    G.P.x = TUTORIAL_HUB.x;
    G.P.y = TUTORIAL_HUB.y;
    expect(flyAcademy.isComplete(buildTutorialCtx(0, 0, {}, G.P))).toBe(true);
    G.P.x = TUTORIAL_SPAWN.x;
    G.P.y = TUTORIAL_SPAWN.y;
    expect(flyAcademy.isComplete(buildTutorialCtx(0, 0, {}, G.P))).toBe(false);
  });
});

describe("fly-mining step completion", () => {
  beforeEach(() => {
    installTestPlayer(makePlayer());
    G.P.tutorial.active = true;
  });

  it("completes near an asteroid offset from belt center", () => {
    const flyMining = stepById("fly-mining");
    G.P.x = TUTORIAL_BELT_CENTER.x;
    G.P.y = TUTORIAL_BELT_CENTER.y;
    expect(flyMining.isComplete(ctxAt(G.P.x, G.P.y))).toBe(true);
    expect(TUTORIAL_MINING_ZONE_R).toBe(3000);
  });

  it("stays complete after leaving zone when zoneReached is latched", () => {
    const flyMining = stepById("fly-mining");
    const zone = flyMining.zone;
    G.P.x = TUTORIAL_BELT_CENTER.x;
    G.P.y = TUTORIAL_BELT_CENTER.y;
    expect(flyMining.isComplete(ctxAt(G.P.x, G.P.y, { zoneReached: true }))).toBe(true);
    G.P.x = TUTORIAL_BELT_CENTER.x;
    G.P.y = TUTORIAL_BELT_CENTER.y + zone.r + 200;
    expect(flyMining.isComplete(ctxAt(G.P.x, G.P.y, { zoneReached: true }))).toBe(true);
    expect(flyMining.isComplete(ctxAt(G.P.x, G.P.y, {}))).toBe(false);
  });

  it("isZoneStepComplete respects latch and live position", () => {
    const zone = stepById("fly-mining").zone;
    expect(isZoneStepComplete(ctxAt(5000, 5000, {}), zone)).toBe(false);
    expect(isZoneStepComplete(ctxAt(5000, 5000, { zoneReached: true }), zone)).toBe(true);
    G.P.x = TUTORIAL_BELT_CENTER.x;
    G.P.y = TUTORIAL_BELT_CENTER.y;
    expect(isZoneStepComplete(ctxAt(G.P.x, G.P.y, {}), zone)).toBe(true);
  });

  it("nav remaining uses zone edge distance when track arc is exhausted", () => {
    G.P.tutorial.step = TUTORIAL_STEPS.findIndex((s) => s.id === "fly-mining");
    G.P.x = TUTORIAL_BELT_CENTER.x;
    G.P.y = TUTORIAL_BELT_CENTER.y + TUTORIAL_MINING_ZONE_R + 120;
    const step = getCurrentTutorialStep(G.P);
    const remaining = getTutorialNavRemainingM(step, G.P);
    expect(remaining).not.toBeNull();
    expect(remaining!).toBeGreaterThan(0);
    expect(remaining!).toBeCloseTo(120, 0);
  });
});

describe("targeting step completion", () => {
  beforeEach(() => {
    installTestPlayer(makePlayer());
    G.P.tutorial.active = true;
    G.P.lockQueue = [];
    G.P.targetLock = null;
  });

  it("completes with resolving lock outside zone", () => {
    const targeting = stepById("targeting");
    G.P.lockQueue = [{ id: "ast-1", resolving: true, acc: 0 }];
    G.P.x = 0;
    G.P.y = 0;
    expect(hasLockOnAsteroid(G.P)).toBe(true);
    expect(targeting.isComplete(buildTutorialCtx(0, 0, {}, G.P))).toBe(true);
  });

  it("completes with resolved lock outside zone", () => {
    const targeting = stepById("targeting");
    G.P.targetLock = { id: "ast-42", x: 1200, y: -200, hp: 100 };
    G.P.x = 5000;
    G.P.y = 5000;
    expect(targeting.isComplete(buildTutorialCtx(0, 0, {}, G.P))).toBe(true);
  });

  it("fails with no asteroid lock", () => {
    const targeting = stepById("targeting");
    G.P.lockQueue = [{ id: "rat-1", resolving: false, acc: 1 }];
    expect(hasLockOnAsteroid(G.P)).toBe(false);
    expect(targeting.isComplete(buildTutorialCtx(0, 0, {}, G.P))).toBe(false);
  });
});

describe("hangar-high step completion", () => {
  beforeEach(() => {
    installTestPlayer(makePlayer());
    G.P.tutorial.active = true;
    Client.stationOpen = false;
  });

  it("does not complete until the player undocks after opening hangar", () => {
    const hangar = stepById("hangar-high");
    expect(hangar.isComplete(buildTutorialCtx(0, 0, {}, G.P))).toBe(false);

    Client.stationOpen = true;
    expect(hangar.isComplete(buildTutorialCtx(0, 0, {
      hangarReviewStarted: true,
    }, G.P))).toBe(false);

    Client.stationOpen = false;
    expect(hangar.isComplete(buildTutorialCtx(0, 0, {
      hangarReviewStarted: true,
    }, G.P))).toBe(true);

    expect(hangar.isComplete(buildTutorialCtx(0, 0, {
      hangarReviewStarted: true,
      hangarReviewComplete: true,
    }, G.P))).toBe(true);
  });

  it("auto-advances to fly-mining immediately after hangar-high completes on undock", () => {
    const hangarIdx = TUTORIAL_STEPS.findIndex((s) => s.id === "hangar-high");
    const flyMiningIdx = TUTORIAL_STEPS.findIndex((s) => s.id === "fly-mining");
    G.P.tutorial.step = hangarIdx;
    initTutorial();

    Client.stationOpen = true;
    tickTutorial(0.016);
    expect(G.P.tutorial.step).toBe(hangarIdx);

    // Simulate that the player has already entered the hangar review flow.
    const snapshot = getTutorialSnapshot();
    snapshot.hangarReviewStarted = true;

    Client.stationOpen = false;
    tickTutorial(0.016);
    expect(G.P.tutorial.step).toBe(flyMiningIdx);
  });

  it("defines hangar review panels for fitting, high slot, cargo, stats, training mission, and undock", () => {
    const step = stepById("hangar-high");
    expect(step.tour?.phases.length).toBe(6);
    expect(step.tour?.phases[0].target).toBe("#hangar-pane-cargo");
    expect(step.tour?.phases[0].body).toMatch(/spare modules/i);
    expect(step.tour?.phases[1].target).toBe("#hangar-fitting-panel");
    expect(step.tour?.phases[1].body).toMatch(/mining laser/i);
    expect(step.tour?.phases[2].target).toBe("#hangar-slot-high-0");
    expect(step.tour?.phases[2].body).toMatch(/mining laser/i);
    expect(step.tour?.phases[3].target).toBe("#hangar-stats-panel");
    expect(step.tour?.phases[4].target).toBe("#hangar-missions-panel");
    expect(step.tour?.phases[4].label).toBe("Training Mission");
    expect(step.tour?.phases[5].target).toBe("#st-undock");
    Client.stationOpen = true;
    const tour = getTourPanel(step, { hangarReviewPhase: 0 });
    expect(tour?.label).toBe("Ship Cargo");
    expect(tour?.index).toBe(1);
  });

  it("defines combat swap panels for unfit, fit, and undock", () => {
    const step = stepById("hangar-turrets");
    expect(step.tour?.phases.length).toBe(6);
    expect(step.tour?.phases[0].label).toMatch(/Combat Loadout/i);
    expect(step.tour?.phases[1].target).toBe("#hangar-slot-high-0");
    expect(step.tour?.phases[3].body).toMatch(/Autocannon/i);
    expect(step.tour?.phases[5].target).toBe("#st-undock");
  });
});

describe("hangar-turrets step completion", () => {
  beforeEach(() => {
    installTestPlayer(makePlayer());
    G.P.tutorial.active = true;
    Client.stationOpen = false;
  });

  it("requires combat loadout and undock after opening hangar", () => {
    const hangar = stepById("hangar-turrets");
    expect(hangar.isComplete(buildTutorialCtx(0, 0, {}, G.P))).toBe(false);

    G.P.fitting.high[0] = "start-tu-civ-cannon";
    G.P.fitting.high[1] = "start-tu-civ-salvager";
    expect(hasTutorialCombatLoadout(G.P)).toBe(true);

    Client.stationOpen = true;
    expect(hangar.isComplete(buildTutorialCtx(0, 0, {
      hangarReviewStarted: true,
    }, G.P))).toBe(false);

    Client.stationOpen = false;
    expect(hangar.isComplete(buildTutorialCtx(0, 0, {
      hangarReviewStarted: true,
      hangarReviewComplete: true,
    }, G.P))).toBe(true);
  });
});

describe("canAdvanceTour", () => {
  beforeEach(() => {
    installTestPlayer(makePlayer());
    G.P.tutorial.active = true;
    Client.stationOpen = true;
  });

  it("returns false when the tour is undefined", () => {
    expect(canAdvanceTour()).toBe(false);
  });

  it("returns true when docked and phase < maxPhase", () => {
    const step = stepById("hangar-high");
    G.P.tutorial.step = TUTORIAL_STEPS.indexOf(step);
    initTutorial();
    expect(canAdvanceTour()).toBe(true);
  });

  it("advances the phase when advanceTour is called", () => {
    const step = stepById("hangar-high");
    G.P.tutorial.step = TUTORIAL_STEPS.indexOf(step);
    initTutorial();
    const snapshot = getTutorialSnapshot();
    snapshot.hangarReviewPhase = 0;
    snapshot.hangarReviewPhaseAt = 0;

    expect(canAdvanceTour()).toBe(true);
    advanceTour();
    expect(snapshot.hangarReviewPhase).toBe(1);
  });
});

describe("hangar review tour phase progression", () => {
  beforeEach(() => {
    installTestPlayer(makePlayer());
    G.P.tutorial.active = true;
    Client.stationOpen = true;
  });

  it("advances through cargo, fitting, high-slot, stats, mission and undock", () => {
    const step = stepById("hangar-high");
    G.P.tutorial.step = TUTORIAL_STEPS.indexOf(step);
    initTutorial();
    const snapshot = getTutorialSnapshot();

    expect(canAdvanceTour()).toBe(true);
    advanceTour();
    expect(snapshot.hangarReviewPhase).toBe(1);

    // Advance to the last phase (phase 4 → 5). Hangar tour does not auto-complete;
    // completion requires the player to undock.
    snapshot.hangarReviewPhase = 4;
    snapshot.hangarReviewPhaseAt = 0;
    expect(canAdvanceTour()).toBe(true);
    advanceTour();
    expect(snapshot.hangarReviewPhase).toBe(5);
    expect(snapshot.hangarReviewComplete).toBe(false);

    // Cannot advance past the last phase
    expect(canAdvanceTour()).toBe(false);
  });
});

describe("tutorial step completion", () => {
  beforeEach(() => {
    installTestPlayer(makePlayer());
    G.P.tutorial.active = true;
    G.GALAXY = [makeSys([])];
    G.P.sysIdx = 0;
  });

  it("mining completes on ore gain anywhere", () => {
    const mining = stepById("mining");
    expect(mining.isComplete(ctxAt(5000, 5000, { ore: 0 }))).toBe(false);
    G.P.ore.iron = 5;
    expect(mining.isComplete(ctxAt(5000, 5000, { ore: 0 }))).toBe(true);
    expect(mining.isComplete(ctxAt(1200, -200, { ore: 0 }))).toBe(true);
  });

  it("industry completes on refinery queue or material gain anywhere", () => {
    const industry = stepById("industry");
    G.P.hubQueue = [{ id: "hub-job-1", kind: "processMixed", startTime: 0, duration: 10, mass: 4000, sourceQty: 1, heatMode: "stable" }];
    expect(industry.isComplete(ctxAt(5000, 5000, { hubQueue: 0, materialVolume: 0, refineryMaterialVolume: 0, refineryGuidePhase: 4 }))).toBe(true);
    G.P.hubQueue = [];
    G.P.hubOutput.materials = [{
      id: "mat-1",
      materialId: "processed_stock",
      kind: "processed",
      label: "Mixed stock",
      volumeM3: 1.2,
      massKg: 4200,
      composition: { iron: 0.7, nickel: 0.2, carbon: 0.1 },
    }];
    expect(industry.isComplete(ctxAt(300, -300, { hubQueue: 0, materialVolume: 0, refineryMaterialVolume: 0, refineryGuidePhase: 4 }))).toBe(true);
  });

  it("gunnery requires in-zone dummy kill", () => {
    const gunnery = stepById("gunnery");
    G.GALAXY[0].enemies = [
      { id: "d1", type: "target_dummy", x: TUTORIAL_GUNNERY_CENTER.x, y: TUTORIAL_GUNNERY_CENTER.y, alive: true, radius: 20 } as Enemy,
    ];
    expect(gunnery.isComplete(ctxAt(TUTORIAL_GUNNERY_CENTER.x, TUTORIAL_GUNNERY_CENTER.y, { dummyCount: 1 }))).toBe(false);
    G.GALAXY[0].enemies[0].alive = false;
    expect(gunnery.isComplete(ctxAt(TUTORIAL_GUNNERY_CENTER.x, TUTORIAL_GUNNERY_CENTER.y, { dummyCount: 1 }))).toBe(true);
    expect(gunnery.isComplete(ctxAt(5000, 5000, { dummyCount: 1 }))).toBe(false);
  });
});
