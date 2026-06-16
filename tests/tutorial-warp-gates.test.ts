import { describe, it, expect, beforeEach } from "vitest";
import { _G as G } from "../src/state.js";
import { makePlayer } from "../src/player/player-data.js";
import { installTestPlayer } from "../src/player-registry.js";
import {
  TUTORIAL_STATION,
  TUTORIAL_GATE,
  TUTORIAL_LOCAL_REGIONS,
} from "../src/data/tutorial-layout.js";
import { buildGalaxy } from "../src/world/galaxy-build.js";
import { getNovusPrimeIdx } from "../src/world/galaxy-build.js";
import { populateSystem } from "../src/world-gen.js";
import { initTutorial } from "../src/tutorial/index.js";
import { tick } from "../src/physics.js";
import { canWarpThroughGate, shouldShowWarpGate } from "../src/data/tutorial.js";
import type { Gate } from "../src/types/world.js";

describe("tutorial warp gates", () => {
  beforeEach(() => {
    installTestPlayer(makePlayer());
    G.P.tutorial.active = true;
    G.GALAXY = buildGalaxy();
    populateSystem(G.GALAXY[0]!);
    populateSystem(G.GALAXY[1]!);
    initTutorial();
  });

  it("prevents warping through the exit gate before graduation step", () => {
    const primeIdx = getNovusPrimeIdx();
    if (primeIdx < 0) return;
    const gate = G.GALAXY[0]?.gates.find((g) => g.targetSysIdx === primeIdx);
    expect(gate).toBeDefined();
    expect(canWarpThroughGate(gate!, 0, G.P)).toBe(false);
  });

  it("allows warping through the exit gate when the graduation step is active", () => {
    const primeIdx = getNovusPrimeIdx();
    if (primeIdx < 0) return;
    G.P.tutorial.step = 13; // graduation step
    tick(0.016);
    const gate = G.GALAXY[0]?.gates.find((g) => g.targetSysIdx === primeIdx);
    expect(gate).toBeDefined();
    expect(canWarpThroughGate(gate!, 0, G.P)).toBe(true);
  });

  it("generates one graduation gate and local return gates for remote tutorial zones", () => {
    const primeIdx = getNovusPrimeIdx();
    if (primeIdx < 0) return;
    const tutorialGates = G.GALAXY[0]?.gates ?? [];
    const graduationGates = tutorialGates.filter((gate) => gate.targetSysIdx === primeIdx);
    const localReturnGates = tutorialGates.filter((gate) =>
      gate.targetSysIdx === undefined && (gate.id ?? "").startsWith("gate-sys-0-return-"),
    );
    const remoteRegionCount = TUTORIAL_LOCAL_REGIONS.filter((reg) =>
      reg.id !== "tut-flight" && Math.hypot(reg.x - TUTORIAL_STATION.x, reg.y - TUTORIAL_STATION.y) >= 1,
    ).length;

    expect(graduationGates).toHaveLength(1);
    expect(graduationGates[0]?.x).toBe(TUTORIAL_GATE.x);
    expect(graduationGates[0]?.y).toBe(TUTORIAL_GATE.y);
    expect(localReturnGates).toHaveLength(remoteRegionCount);
    expect(localReturnGates.some((gate) => gate.id === "gate-sys-0-return-tut-flight")).toBe(false);
    expect(tutorialGates.some((gate) => gate.targetSysIdx === primeIdx && Math.hypot(gate.x + 500, gate.y) < 200)).toBe(false);
  });

  it("tutorial system has exactly one planet at the start planet location", () => {
    const tutorialSys = G.GALAXY[0]!;
    expect(tutorialSys.planets).toHaveLength(1);
    const planet = tutorialSys.planets[0];
    expect(planet.x).toBe(-2200);
    expect(planet.y).toBe(-500);
  });

  it("does not generate a return gate from Novus Prime to the tutorial system", () => {
    expect(G.GALAXY[1]?.gates.some((gate) => gate.targetSysIdx === 0)).toBe(false);
  });

  it("shows the exit gate after tutorial ends", () => {
    G.P.tutorial.active = false;
    const primeIdx = getNovusPrimeIdx();
    if (primeIdx < 0) return;
    const gate: Gate = {
      x: 0, y: 0, px: 0, py: 0,
      target: { kind: "local", x: 0, y: 0, label: `sector-${primeIdx}` },
      targetSysIdx: primeIdx,
      radius: 100, spin: 0,
    };
    expect(shouldShowWarpGate(gate, 0, G.P)).toBe(true);
  });
});
