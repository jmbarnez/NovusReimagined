import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { _G as G, Client } from "../src/state.js";;
import { makePlayer } from "../src/player/player-data.js";
import { installTestPlayer } from "../src/player-registry.js";
import {
  TUTORIAL_STEPS,
  TUTORIAL_STEP_COUNT,
  buildTutorialCtx,
  hasLockOnAsteroid,
  shouldShowWarpGate,
  canWarpThroughGate,
  isTutorialExitGateRevealed,
  getHangarGuidePanel,
  getHangarTourPanel,
  isZoneStepComplete,
  getTutorialNavRemainingM,
  getCurrentTutorialStep,
} from "../src/data/tutorial.js";
import { TUTORIAL_SPAWN, TUTORIAL_BELT_CENTER, TUTORIAL_MINING_ZONE_R } from "../src/data/tutorial-layout.js";
import type { System, Enemy, Gate } from "../src/types/world.js";
import { getNovusPrimeIdx } from "../src/world/galaxy-build.js";
import {
  HANGAR_REVIEW_PHASE_COUNT,
  HANGAR_COMBAT_SWAP_PHASE_COUNT,
  hasTutorialCombatLoadout,
} from "../src/data/tutorial.js";
import { TUTORIAL_STEP_REWARDS } from "../src/data/tutorial-mission.js";
import { skipTutorial } from "../src/tutorial.js";
import { SAVE_KEY } from "../src/constants.js";
import { buildGalaxy, populateSystem } from "../src/world-gen.js";
import { ENEMY_SPAWNS } from "../src/data/enemy-spawns.js";

function stepById(id: string) {
  const step = TUTORIAL_STEPS.find((s) => s.id === id);
  if (!step) throw new Error(`missing step ${id}`);
  return step;
}

function ctxAt(x: number, y: number, snapshot: Record<string, unknown> = {}) {
  G.P.x = x;
  G.P.y = y;
  return buildTutorialCtx(0, 0, snapshot, G.P);
}

function makeSys(enemies: Enemy[]): System {
  return {
    id: "sys-0",
    idx: 0,
    name: "S.T.A.R.T System",
    mapX: 0,
    mapY: 0,
    ring: 0,
    security: 1,
    links: [],
    stations: [],
    planets: [],
    asteroids: [],
    enemies,
    gates: [],
    nebulaHues: [],
    starHue: 0,
    _ready: true,
  };
}

describe("tutorial step list", () => {
  it("has thirteen steps with hangar fitting legs before mining and gunnery", () => {
    expect(TUTORIAL_STEP_COUNT).toBe(13);
    expect(TUTORIAL_STEPS.map((s) => s.id)).toEqual([
      "hud-tour",
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

  it("defines hangar review panels for cargo, fitting, stats, training mission, and undock", () => {
    expect(HANGAR_REVIEW_PHASE_COUNT).toBe(5);
    expect(getHangarGuidePanel("hangar-high", 0)?.target).toBe("hangar-cargo");
    expect(getHangarGuidePanel("hangar-high", 0)?.body).toMatch(/autocannon/i);
    expect(getHangarGuidePanel("hangar-high", 1)?.target).toBe("hangar-fitting");
    expect(getHangarGuidePanel("hangar-high", 1)?.body).toMatch(/mining laser/i);
    expect(getHangarGuidePanel("hangar-high", 2)?.target).toBe("hangar-stats");
    expect(getHangarGuidePanel("hangar-high", 3)?.target).toBe("hud-missions");
    expect(getHangarGuidePanel("hangar-high", 3)?.label).toBe("Training Mission");
    expect(getHangarGuidePanel("hangar-high", 4)?.target).toBe("hangar-undock");
    Client.stationOpen = true;
    const tour = getHangarTourPanel(stepById("hangar-high"), { hangarReviewPhase: 0 });
    expect(tour?.label).toBe("Ship Cargo");
    expect(tour?.index).toBe(1);
  });

  it("defines combat swap panels for unfit, fit, and undock", () => {
    expect(HANGAR_COMBAT_SWAP_PHASE_COUNT).toBe(6);
    expect(getHangarGuidePanel("hangar-turrets", 0)?.label).toMatch(/Combat Loadout/i);
    expect(getHangarGuidePanel("hangar-turrets", 1)?.target).toBe("hangar-slot-high-0");
    expect(getHangarGuidePanel("hangar-turrets", 3)?.body).toMatch(/Autocannon/i);
    expect(getHangarGuidePanel("hangar-turrets", 5)?.target).toBe("hangar-undock");
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

  it("industry completes on craft queue or bar gain anywhere", () => {
    const industry = stepById("industry");
    G.P.craftQueue = [{ id: "job-1", recipeId: "bar", startTime: 0, duration: 10, qty: 1 }];
    expect(industry.isComplete(ctxAt(5000, 5000, { craftQueue: 0, refined: 0 }))).toBe(true);
    G.P.craftQueue = [];
    G.P.refined.bar = 1;
    expect(industry.isComplete(ctxAt(300, -300, { craftQueue: 0, refined: 0 }))).toBe(true);
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

describe("tutorial exit gate", () => {
  beforeEach(() => {
    installTestPlayer(makePlayer());
    G.P.sysIdx = 0;
    G.P.tutorial.active = true;
  });

  function stepIndex(id: string): number {
    return TUTORIAL_STEPS.findIndex((s) => s.id === id);
  }

  it("stays hidden until the fly-gate approach step", () => {
    G.P.tutorial.step = stepIndex("gunnery");
    expect(isTutorialExitGateRevealed(G.P)).toBe(false);
    G.P.tutorial.step = stepIndex("fly-gate");
    expect(isTutorialExitGateRevealed(G.P)).toBe(true);
    G.P.tutorial.step = stepIndex("graduation");
    expect(isTutorialExitGateRevealed(G.P)).toBe(true);
  });

  it("blocks warp until graduation when exiting tutorial", () => {
    const primeIdx = getNovusPrimeIdx();
    if (primeIdx < 0) return;
    const gate = { targetSysIdx: primeIdx } as Gate;
    G.P.tutorial.step = stepIndex("fly-gate");
    expect(canWarpThroughGate(gate, 0, G.P)).toBe(false);
    G.P.tutorial.step = stepIndex("graduation");
    expect(canWarpThroughGate(gate, 0, G.P)).toBe(true);
  });

  it("shows the exit gate after tutorial ends", () => {
    G.P.tutorial.active = false;
    const primeIdx = getNovusPrimeIdx();
    if (primeIdx < 0) return;
    expect(shouldShowWarpGate({ targetSysIdx: primeIdx } as Gate, 0, G.P)).toBe(true);
  });
});

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
