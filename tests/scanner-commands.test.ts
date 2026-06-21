import { beforeEach, describe, expect, it } from "vitest";
import { _G as G } from "../src/state.js";
import { installTestPlayer } from "../src/player-registry.js";
import { makePlayer } from "../src/player/player-data.js";
import { executeGameCommand } from "../src/sim/commands.js";
import { buildGalaxy, populateSystem } from "../src/world-gen.js";

describe("scanner commands", () => {
  beforeEach(() => {
    installTestPlayer(makePlayer());
    G.GALAXY = buildGalaxy();
    populateSystem(G.GALAXY[0]!);
  });

  it("applies map scanner settings through authoritative commands", () => {
    executeGameCommand({ type: "setMapScannerPower", payload: { active: true } }, G.P);
    executeGameCommand({ type: "setMapScannerCone", payload: { coneDeg: 45 } }, G.P);
    executeGameCommand({ type: "setMapScannerStrength", payload: { strength: 0.8 } }, G.P);

    expect(G.P.mapScannerActive).toBe(true);
    expect(G.P.scannerConeDeg).toBe(45);
    expect(G.P.mapScannerStrength).toBeCloseTo(0.8);
  });

  it("starts a scan pulse from the command layer", () => {
    G.P.fitting.low[0] = "start-tu-civ-scanner";
    G.P.mapScannerActive = true;
    G.P.energy = 100;

    executeGameCommand({ type: "startScanPulse", payload: { angleDeg: 90 } }, G.P);

    expect(G.P.activeScan).toBeTruthy();
    expect(G.P.activeScan?.angle).toBe(90);
    expect(G.P.energy).toBeLessThan(100);
  });
});
