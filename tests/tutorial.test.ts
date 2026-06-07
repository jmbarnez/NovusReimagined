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
  getRefineryTourPanel,
  isZoneStepComplete,
  getTutorialNavRemainingM,
  getCurrentTutorialStep,
  getTutorialStepObjective,
} from "../src/data/tutorial.js";
import { tutorialKeyStyled, tutorialBarKeyStyled } from "../src/data/tutorial-controls.js";
import { TUTORIAL_SPAWN, TUTORIAL_BELT_CENTER, TUTORIAL_MINING_ZONE_R, TUTORIAL_GATE, TUTORIAL_LOCAL_REGIONS } from "../src/data/tutorial-layout.js";
import type { System, Enemy, Gate, Station } from "../src/types/world.js";
import { getNovusPrimeIdx } from "../src/world/galaxy-build.js";
import {
  HANGAR_REVIEW_PHASE_COUNT,
  HANGAR_COMBAT_SWAP_PHASE_COUNT,
  hasTutorialCombatLoadout,
} from "../src/data/tutorial.js";
import { TUTORIAL_STEP_REWARDS } from "../src/data/tutorial-mission.js";
import { getTutorialSnapshot, initTutorial, skipTutorial, tickTutorial } from "../src/tutorial.js";
import { SAVE_KEY } from "../src/constants.js";
import { buildGalaxy, populateSystem } from "../src/world-gen.js";
import { ENEMY_SPAWNS } from "../src/data/enemy-spawns.js";
import { executeGameCommand } from "../src/sim/commands.js";
import { updateWarp } from "../src/dock.js";
import { syncHangarTutorialGuide, clearHangarTutorialGuide } from "../src/ui/tutorial-hangar-guide.js";
import { syncRefineryTutorialGuide, clearRefineryTutorialGuide } from "../src/ui/tutorial-refinery-guide.js";
import { stationState } from "../src/ui/station/shared.js";
import { activateStationTab } from "../src/ui/station/tabs.js";
import { emit, on } from "../src/events.js";

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

function makeStation(): Station {
  return {
    id: "station-tutorial",
    name: "Tutorial Station",
    x: 0,
    y: 0,
    radius: 100,
    spin: 0,
    isHome: true,
    services: ["market", "industry", "repair"],
    safeRadius: 180,
    turrets: [],
  };
}

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
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

describe("styled keybind helpers", () => {
  it("tutorialKeyStyled wraps keybind in a span", () => {
    const result = tutorialKeyStyled("brake");
    expect(result).toMatch(/<span class="tutorial-keybind">/);
    expect(result).toMatch(/<\/span>/);
  });

  it("tutorialBarKeyStyled wraps bar slot in a span", () => {
    const result = tutorialBarKeyStyled(0);
    expect(result).toMatch(/<span class="tutorial-keybind">1<\/span>/);
  });

  it("renders keybinds as styled markup in step objectives", () => {
    installTestPlayer(makePlayer());
    G.P.tutorial.active = true;
    const industry = stepById("industry");
    const obj = getTutorialStepObjective(industry, {});
    expect(obj).toContain('<span class="tutorial-keybind">');
  });

  it("returns a refinery tour panel for the industry step", () => {
    Client.stationOpen = true;
    const tour = getRefineryTourPanel(stepById("industry"), { refineryGuidePhase: 0 });
    expect(tour?.label).toContain("Refining");
    expect(tour?.index).toBe(1);
    Client.stationOpen = false;
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

describe("tutorial exit gate", () => {
  beforeEach(() => {
    installTestPlayer(makePlayer());
    G.GALAXY = buildGalaxy();
    populateSystem(G.GALAXY[0]!);
    populateSystem(G.GALAXY[1]!);
    G.P.sysIdx = 0;
    G.P.tutorial.active = true;
  });

  function stepIndex(id: string): number {
    return TUTORIAL_STEPS.findIndex((s) => s.id === id);
  }

  it("reveals the exit gate only for tutorial pulse logic", () => {
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

  it("shows the graduation gate before it is warpable", () => {
    const primeIdx = getNovusPrimeIdx();
    if (primeIdx < 0) return;
    const gate = { targetSysIdx: primeIdx } as Gate;
    G.P.tutorial.step = stepIndex("gunnery");
    expect(shouldShowWarpGate(gate, 0, G.P)).toBe(true);
    expect(canWarpThroughGate(gate, 0, G.P)).toBe(false);
  });

  it("allows local tutorial return gates during tutorial", () => {
    const localGate = G.GALAXY[0]?.gates.find((gate) => gate.id === "gate-sys-0-return-tut-mining");
    expect(localGate).toBeTruthy();
    if (!localGate) return;
    G.P.tutorial.step = stepIndex("gunnery");
    expect(shouldShowWarpGate(localGate, 0, G.P)).toBe(true);
    expect(canWarpThroughGate(localGate, 0, G.P)).toBe(true);
  });

  it("rejects authoritative warp commands before graduation", () => {
    const primeIdx = getNovusPrimeIdx();
    if (primeIdx < 0) return;
    G.P.tutorial.step = stepIndex("fly-gate");
    G.P.x = TUTORIAL_GATE.x;
    G.P.y = TUTORIAL_GATE.y;

    executeGameCommand({ type: "warp", payload: { targetIdx: primeIdx } }, G.P);

    expect(G.P.sysIdx).toBe(0);
    expect(G.P.warpTargetIdx).toBe(-1);
  });

  it("arms graduation warp after flying through the gate", () => {
    const primeIdx = getNovusPrimeIdx();
    if (primeIdx < 0) return;
    const gate = G.GALAXY[0]?.gates.find((entry) => entry.targetSysIdx === primeIdx);
    expect(gate).toBeTruthy();
    if (!gate) return;
    G.P.tutorial.step = stepIndex("graduation");
    G.P.px = gate.x - gate.radius * 2;
    G.P.py = gate.y;
    G.P.x = gate.x;
    G.P.y = gate.y;

    updateWarp(1 / 60);
    expect(G.P.warpTargetIdx).toBe(primeIdx);
    expect(G.P.warpCooldown).toBeGreaterThan(0);
  });

  it("graduates after using the final one-way gate to Novus Prime", () => {
    const primeIdx = getNovusPrimeIdx();
    if (primeIdx < 0) return;
    const gate = G.GALAXY[0]?.gates.find((entry) => entry.targetSysIdx === primeIdx);
    expect(gate).toBeTruthy();
    if (!gate) return;
    G.P.tutorial.step = stepIndex("graduation");
    G.P.px = gate.x - gate.radius * 2;
    G.P.py = gate.y;
    G.P.x = gate.x;
    G.P.y = gate.y;

    updateWarp(1 / 60);
    expect(G.P.warpTargetIdx).toBe(primeIdx);

    updateWarp(999);
    tickTutorial(0);

    expect(G.P.sysIdx).toBe(primeIdx);
    expect(G.P.tutorial.active).toBe(false);
    expect(G.P.tutorial.completed).toBe(true);
    expect(G.P.homeSysIdx).toBe(primeIdx);
    expect(Math.hypot(G.P.x, G.P.y)).toBeGreaterThan(100);
  });

  it("uses local return gates without changing systems", () => {
    const localGate = G.GALAXY[0]?.gates.find((gate) => gate.id === "gate-sys-0-return-tut-mining");
    expect(localGate).toBeTruthy();
    if (!localGate) return;
    G.P.tutorial.step = stepIndex("gunnery");
    G.P.px = localGate.x - localGate.radius * 2;
    G.P.py = localGate.y;
    G.P.x = localGate.x;
    G.P.y = localGate.y;
    G.P.vx = 12;
    G.P.vy = 9;

    updateWarp(1 / 60);

    expect(G.P.sysIdx).toBe(0);
    expect(G.P.warpTargetIdx).toBe(-1);
    expect(G.P.x).toBe(localGate.target?.x);
    expect(G.P.y).toBe((localGate.target?.y ?? 0) - 320);
    expect(G.P.vx).toBe(0);
    expect(G.P.vy).toBe(0);
  });

  it("shows the exit gate after tutorial ends", () => {
    G.P.tutorial.active = false;
    const primeIdx = getNovusPrimeIdx();
    if (primeIdx < 0) return;
    expect(shouldShowWarpGate({ targetSysIdx: primeIdx } as Gate, 0, G.P)).toBe(true);
  });

  it("does not generate a return gate from Novus Prime to the tutorial system", () => {
    expect(G.GALAXY[1]?.gates.some((gate) => gate.targetSysIdx === 0)).toBe(false);
  });

  it("generates one graduation gate and local return gates for remote tutorial zones", () => {
    const primeIdx = getNovusPrimeIdx();
    if (primeIdx < 0) return;
    const tutorialGates = G.GALAXY[0]?.gates ?? [];
    const graduationGates = tutorialGates.filter((gate) => gate.targetSysIdx === primeIdx);
    const localReturnGates = tutorialGates.filter((gate) => gate.target?.kind === "local");
    const remoteRegionCount = TUTORIAL_LOCAL_REGIONS.filter((reg) => reg.id !== "tut-flight" && Math.hypot(reg.x, reg.y) >= 1).length;

    expect(graduationGates).toHaveLength(1);
    expect(graduationGates[0]?.x).toBe(TUTORIAL_GATE.x);
    expect(graduationGates[0]?.y).toBe(TUTORIAL_GATE.y);
    expect(localReturnGates).toHaveLength(remoteRegionCount);
    expect(localReturnGates.some((gate) => gate.id === "gate-sys-0-return-tut-flight")).toBe(false);
    expect(tutorialGates.some((gate) => gate.targetSysIdx === primeIdx && Math.hypot(gate.x + 500, gate.y) < 200)).toBe(false);
  });
});

describe("station tutorial spotlight", () => {
  beforeEach(() => {
    installTestPlayer(makePlayer());
    G.P.tutorial.active = true;
    G.P.tutorial.step = TUTORIAL_STEPS.findIndex((s) => s.id === "hangar-high");
    Client.stationOpen = true;
    document.body.innerHTML = `
      <div id="station-overlay">
        <div id="st-dimmer"></div>
        <div id="st-ui">
          <button class="st-tab active" data-tab="hangar"></button>
          <button class="st-tab" data-tab="market"></button>
          <div id="panel-hangar" class="panel active"></div>
          <div id="panel-market" class="panel"></div>
          <div id="hangar-pane-cargo"></div>
          <div data-tutorial-slot="high-0"></div>
          <div data-tutorial-slot="high-1"></div>
        </div>
      </div>
    `;
  });

  afterEach(() => {
    clearHangarTutorialGuide();
    clearRefineryTutorialGuide();
    Client.stationOpen = false;
    document.getElementById("station-overlay")?.remove();
    if (!document.getElementById("c")) {
      const canvas = document.createElement("canvas");
      canvas.id = "c";
      document.body.appendChild(canvas);
    }
  });

  it("cuts the station dimmer around the highlighted hangar target", () => {
    const dimmer = document.getElementById("st-dimmer")!;
    const target = document.getElementById("hangar-pane-cargo")!;
    Object.defineProperty(dimmer, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }),
    });
    Object.defineProperty(target, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ left: 100, top: 120, right: 300, bottom: 220, width: 200, height: 100 }),
    });

    syncHangarTutorialGuide({ hangarReviewPhase: 0 });

    const segments = Array.from(dimmer.querySelectorAll<HTMLElement>(".tutorial-dimmer-segment"));
    expect(segments).toHaveLength(4);
    expect(target.classList.contains("tutorial-hangar-highlight")).toBe(true);
    expect(segments[0].style.height).toBe("112px");
    expect(segments[1].style.top).toBe("228px");
    expect(segments[2].style.width).toBe("92px");
    expect(segments[3].style.left).toBe("308px");

    clearHangarTutorialGuide();

    expect(dimmer.classList.contains("active")).toBe(false);
    expect(target.classList.contains("tutorial-hangar-highlight")).toBe(false);
    for (const segment of segments) {
      expect(segment.getAttribute("style")).toBeNull();
    }
  });

  it("resyncs the hangar highlight after deferred station-open tutorial setup", async () => {
    const events: string[] = [];
    const off = on("tutorial:hangar-tour-change", () => {
      events.push("change");
      syncHangarTutorialGuide(getTutorialSnapshot());
    });

    try {
      initTutorial();
      emit("station:open", { station: makeStation() });

      await nextAnimationFrame();

      const snapshot = getTutorialSnapshot();
      const target = document.getElementById("hangar-pane-cargo")!;
      expect(snapshot.hangarReviewStarted).toBe(true);
      expect(snapshot.hangarReviewPhase).toBe(0);
      expect(events.length).toBeGreaterThan(0);
      expect(target.classList.contains("tutorial-hangar-highlight")).toBe(true);
    } finally {
      off();
    }
  });

  it("restores the current hangar target highlight after station tab changes", () => {
    const root = document.getElementById("station-overlay")!;
    const target = document.getElementById("hangar-pane-cargo")!;

    syncHangarTutorialGuide({ hangarReviewPhase: 0 });
    expect(target.classList.contains("tutorial-hangar-highlight")).toBe(true);

    activateStationTab("market", root);
    expect(document.getElementById("panel-market")?.classList.contains("active")).toBe(true);

    syncHangarTutorialGuide({ hangarReviewPhase: 0 });

    expect(document.getElementById("panel-hangar")?.classList.contains("active")).toBe(true);
    expect(target.classList.contains("tutorial-hangar-highlight")).toBe(true);
  });

  it("uses the combat hangar phase to highlight high-slot tutorial targets", () => {
    G.P.tutorial.step = TUTORIAL_STEPS.findIndex((s) => s.id === "hangar-turrets");
    const firstSlot = document.querySelector<HTMLElement>('[data-tutorial-slot="high-0"]')!;
    const secondSlot = document.querySelector<HTMLElement>('[data-tutorial-slot="high-1"]')!;

    syncHangarTutorialGuide({ hangarCombatPhase: 1 });
    expect(firstSlot.classList.contains("tutorial-hangar-highlight")).toBe(true);
    expect(secondSlot.classList.contains("tutorial-hangar-highlight")).toBe(false);

    syncHangarTutorialGuide({ hangarCombatPhase: 2 });
    expect(firstSlot.classList.contains("tutorial-hangar-highlight")).toBe(false);
    expect(secondSlot.classList.contains("tutorial-hangar-highlight")).toBe(true);
  });

  it("cuts the station dimmer around the highlighted refinery target", () => {
    Client.stationOpen = true;
    Client.activeStation = {
      id: "academy",
      name: "S.T.A.R.T Academy",
      x: 0,
      y: 0,
      radius: 240,
      spin: 0,
      isHome: true,
      safeRadius: 420,
      turrets: [],
      services: ["market", "industry", "repair"],
    };
    G.P.tutorial.step = TUTORIAL_STEPS.findIndex((s) => s.id === "industry");
    document.body.innerHTML = `
      <div id="station-overlay">
        <div id="st-dimmer"></div>
        <div id="st-ui">
          <button class="st-tab active" data-tab="industry"></button>
          <div id="panel-industry" class="panel active">
            <div id="refinery-pipeline"></div>
            <div id="refinery-process-source"></div>
            <div id="refinery-process-controls"></div>
            <aside id="refinery-right-rail"></aside>
          </div>
        </div>
      </div>
    `;

    const dimmer = document.getElementById("st-dimmer")!;
    const originalTarget = document.getElementById("refinery-process-controls")!;
    Object.defineProperty(dimmer, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }),
    });
    Object.defineProperty(originalTarget, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ left: 160, top: 260, right: 420, bottom: 340, width: 260, height: 80 }),
    });

    syncRefineryTutorialGuide({ refineryGuidePhase: 3 });

    const target = document.getElementById("refinery-process-controls")!;
    Object.defineProperty(target, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ left: 160, top: 260, right: 420, bottom: 340, width: 260, height: 80 }),
    });
    syncRefineryTutorialGuide({ refineryGuidePhase: 3 });

    const segments = Array.from(dimmer.querySelectorAll<HTMLElement>(".tutorial-dimmer-segment"));
    expect(segments).toHaveLength(4);
    expect(target.classList.contains("tutorial-hangar-highlight")).toBe(true);
    expect(segments[0].style.height).toBe("252px");
    expect(segments[1].style.top).toBe("348px");
    expect(segments[2].style.width).toBe("152px");
    expect(segments[3].style.left).toBe("428px");
    expect(stationState.indRailTab).toBe("queue");

    syncRefineryTutorialGuide({ refineryGuidePhase: 4 });
    expect(stationState.indRailTab).toBe("queue");
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
