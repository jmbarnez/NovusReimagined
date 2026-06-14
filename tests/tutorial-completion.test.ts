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
import { TUTORIAL_SPAWN, TUTORIAL_BELT_CENTER, TUTORIAL_MINING_ZONE_R } from "../src/data/tutorial-layout.js";
import { hasTutorialCombatLoadout } from "../src/data/tutorial.js";
import { getTutorialSnapshot, tickTutorial, canAdvanceTour, advanceTour, initTutorial } from "../src/tutorial/index.js";
import type { Enemy } from "../src/types/world.js";
import { stepById, ctxAt, makeSys } from "./tutorial-helpers.js";

describe("fly-academy step completion", () => {
  beforeEach(() => {
    installTestPlayer(makePlayer());
    G.P.tutorial.active = true;
  });

  it("requires reaching the academy hub zone", () => {
    const flyAcademy = stepById("fly-academy");
    G.P.x = 0;
    G.P.y = 0;
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
    G.P.y = 400;
    expect(flyMining.isComplete(ctxAt(G.P.x, G.P.y))).toBe(true);
    expect(TUTORIAL_MINING_ZONE_R).toBeGreaterThanOrEqual(620);
  });

  it("stays complete after leaving zone when zoneReached is latched", () => {
    const flyMining = stepById("fly-mining");
    const zone = flyMining.zone;
    G.P.x = TUTORIAL_BELT_CENTER.x;
    G.P.y = 0;
    expect(flyMining.isComplete(ctxAt(G.P.x, G.P.y, { zoneReached: true }))).toBe(true);
    G.P.x = TUTORIAL_BELT_CENTER.x + zone.r + 200;
    G.P.y = 0;
    expect(flyMining.isComplete(ctxAt(G.P.x, G.P.y, { zoneReached: true }))).toBe(true);
    expect(flyMining.isComplete(ctxAt(G.P.x, G.P.y, {}))).toBe(false);
  });

  it("isZoneStepComplete respects latch and live position", () => {
    const zone = stepById("fly-mining").zone;
    expect(isZoneStepComplete(ctxAt(5000, 5000, {}), zone)).toBe(false);
    expect(isZoneStepComplete(ctxAt(5000, 5000, { zoneReached: true }), zone)).toBe(true);
    G.P.x = TUTORIAL_BELT_CENTER.x;
    G.P.y = 0;
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
    }, G.P))).toBe(true);
  });
});

describe("canAdvanceTour", () => {
  beforeEach(() => {
    installTestPlayer(makePlayer());
    G.P.tutorial.active = true;
    Client.stationOpen = false;
  });

  it("returns false for hangar-high before docking", () => {
    G.P.tutorial.step = TUTORIAL_STEPS.findIndex((s) => s.id === "hangar-high");
    expect(canAdvanceTour()).toBe(false);
  });

  it("returns true for hangar-high while docked and incomplete", () => {
    G.P.tutorial.step = TUTORIAL_STEPS.findIndex((s) => s.id === "hangar-high");
    Client.stationOpen = true;
    expect(canAdvanceTour()).toBe(true);
  });

  it("returns false for hangar-high when review is complete", () => {
    G.P.tutorial.step = TUTORIAL_STEPS.findIndex((s) => s.id === "hangar-high");
    Client.stationOpen = true;
    const snapshot = getTutorialSnapshot();
    snapshot.hangarReviewComplete = true;
    expect(canAdvanceTour()).toBe(false);
  });

  it("returns false for hangar-turrets before docking", () => {
    G.P.tutorial.step = TUTORIAL_STEPS.findIndex((s) => s.id === "hangar-turrets");
    expect(canAdvanceTour()).toBe(false);
  });

  it("returns false for industry before docking", () => {
    G.P.tutorial.step = TUTORIAL_STEPS.findIndex((s) => s.id === "industry");
    expect(canAdvanceTour()).toBe(false);
  });
});

describe("advanceTour", () => {
  beforeEach(() => {
    installTestPlayer(makePlayer());
    G.P.tutorial.active = true;
    Client.stationOpen = false;
  });

  it("does not mark hangar review complete until the last phase is finished", () => {
    G.P.tutorial.step = TUTORIAL_STEPS.findIndex((s) => s.id === "hangar-high");
    Client.stationOpen = true;
    initTutorial();

    const snapshot = getTutorialSnapshot();
    expect(snapshot.hangarReviewPhase).toBe(0);
    expect(snapshot.hangarReviewComplete).toBe(false);

    // Advance through phases 0-4
    for (let i = 0; i < 5; i++) {
      advanceTour();
      expect(snapshot.hangarReviewPhase).toBe(i + 1);
    }

    // After entering the last phase (undock), review should NOT be complete
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
    G.P.hubDeposit.materials = [{
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
      { id: "d1", type: "target_dummy", x: 2200, y: 1600, alive: true, radius: 20 } as Enemy,
    ];
    expect(gunnery.isComplete(ctxAt(2200, 1600, { dummyCount: 1 }))).toBe(false);
    G.GALAXY[0].enemies[0].alive = false;
    expect(gunnery.isComplete(ctxAt(2200, 1600, { dummyCount: 1 }))).toBe(true);
    expect(gunnery.isComplete(ctxAt(5000, 5000, { dummyCount: 1 }))).toBe(false);
  });
});
