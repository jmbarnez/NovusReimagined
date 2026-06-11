import { describe, it, expect, beforeEach } from "vitest";
import { _G as G, Client } from "../src/state.js";
import { makePlayer } from "../src/player/player-data.js";
import { installTestPlayer } from "../src/player-registry.js";
import {
  TUTORIAL_STEPS,
  shouldShowWarpGate,
  canWarpThroughGate,
  isTutorialExitGateRevealed,
} from "../src/data/tutorial.js";
import { TUTORIAL_GATE, TUTORIAL_LOCAL_REGIONS } from "../src/data/tutorial-layout.js";
import type { Gate } from "../src/types/world.js";
import { getNovusPrimeIdx } from "../src/world/galaxy-build.js";
import { tickTutorial } from "../src/tutorial/index.js";
import { executeGameCommand } from "../src/sim/commands.js";
import { updateWarp } from "../src/docking/index.js";
import { buildGalaxy, populateSystem } from "../src/world-gen.js";
import { stepIndex } from "./tutorial-helpers.js";

describe("tutorial exit gate", () => {
  beforeEach(() => {
    installTestPlayer(makePlayer());
    G.GALAXY = buildGalaxy();
    populateSystem(G.GALAXY[0]!);
    populateSystem(G.GALAXY[1]!);
    G.P.sysIdx = 0;
    G.P.tutorial.active = true;
  });

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
    const gate: Gate = {
      x: 0, y: 0, px: 0, py: 0,
      target: { kind: "local", x: 0, y: 0, label: `sector-${primeIdx}` },
      targetSysIdx: primeIdx,
      radius: 100, spin: 0,
    };
    G.P.tutorial.step = stepIndex("fly-gate");
    expect(canWarpThroughGate(gate, 0, G.P)).toBe(false);
    G.P.tutorial.step = stepIndex("graduation");
    expect(canWarpThroughGate(gate, 0, G.P)).toBe(true);
  });

  it("shows the graduation gate before it is warpable", () => {
    const primeIdx = getNovusPrimeIdx();
    if (primeIdx < 0) return;
    const gate: Gate = {
      x: 0, y: 0, px: 0, py: 0,
      target: { kind: "local", x: 0, y: 0, label: `sector-${primeIdx}` },
      targetSysIdx: primeIdx,
      radius: 100, spin: 0,
    };
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

    executeGameCommand({ type: "warp", payload: { targetIdx: primeIdx } }, G.P);
    expect(G.P.warpTargetIdx).toBe(-1);
    expect(G.P.warpCooldown).toBeGreaterThan(0);
    expect(G.P.sysIdx).toBe(primeIdx);
  });

  it("graduates after using the final one-way gate to Novus Prime", () => {
    const primeIdx = getNovusPrimeIdx();
    if (primeIdx < 0) return;
    const gate = G.GALAXY[0]?.gates.find((entry) => entry.targetSysIdx === primeIdx);
    expect(gate).toBeTruthy();
    if (!gate) return;
    G.P.tutorial.step = stepIndex("graduation");

    executeGameCommand({ type: "warp", payload: { targetIdx: primeIdx } }, G.P);
    expect(G.P.warpTargetIdx).toBe(-1);
    expect(G.P.sysIdx).toBe(primeIdx);

    updateWarp(999);
    tickTutorial(0);

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
    G.P.targetLock = { id: localGate.id ?? "gate-local", x: localGate.x, y: localGate.y, hp: 1, alive: true, sigRadius: localGate.radius * 3, radius: localGate.radius };
    Client.keys["warp"] = true;

    updateWarp(10);

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
    const gate: Gate = {
      x: 0, y: 0, px: 0, py: 0,
      target: { kind: "local", x: 0, y: 0, label: `sector-${primeIdx}` },
      targetSysIdx: primeIdx,
      radius: 100, spin: 0,
    };
    expect(shouldShowWarpGate(gate, 0, G.P)).toBe(true);
  });

  it("does not generate a return gate from Novus Prime to the tutorial system", () => {
    expect(G.GALAXY[1]?.gates.some((gate) => gate.targetSysIdx === 0)).toBe(false);
  });

  it("generates one graduation gate and local return gates for remote tutorial zones", () => {
    const primeIdx = getNovusPrimeIdx();
    if (primeIdx < 0) return;
    const tutorialGates = G.GALAXY[0]?.gates ?? [];
    const graduationGates = tutorialGates.filter((gate) => gate.targetSysIdx === primeIdx);
    const localReturnGates = tutorialGates.filter((gate) => gate.targetSysIdx === undefined);
    const remoteRegionCount = TUTORIAL_LOCAL_REGIONS.filter((reg) => reg.id !== "tut-flight" && Math.hypot(reg.x, reg.y) >= 1).length;

    expect(graduationGates).toHaveLength(1);
    expect(graduationGates[0]?.x).toBe(TUTORIAL_GATE.x);
    expect(graduationGates[0]?.y).toBe(TUTORIAL_GATE.y);
    expect(localReturnGates).toHaveLength(remoteRegionCount);
    expect(localReturnGates.some((gate) => gate.id === "gate-sys-0-return-tut-flight")).toBe(false);
    expect(tutorialGates.some((gate) => gate.targetSysIdx === primeIdx && Math.hypot(gate.x + 500, gate.y) < 200)).toBe(false);
  });
});
