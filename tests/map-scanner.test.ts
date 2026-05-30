import { describe, it, expect, beforeEach } from "vitest";
import { _G as G, Client } from "../src/state.js";;
import { PlayerAccess } from "../src/state-access.js";
import { makePlayer } from "../src/player/player-data.js";
import { installTestPlayer } from "../src/player-registry.js";
import { C } from "../src/config/index.js";
import {
  getMapScannerDrainMult,
  getMapScannerDrainPerSec,
  getMapScannerSignatureMult,
  getEffectiveSignatureRadius,
  setMapScannerStrengthFromStep,
  mapScannerStrengthStepIndex,
  isMapScannerEmitting,
} from "../src/scanning.js";
import { SHIPS } from "../src/data/ships.js";

describe("map scanner strength", () => {
  beforeEach(() => {
    installTestPlayer(makePlayer());
    G.P.shipId = "scout";
    PlayerAccess.setMapScannerStrength(0);
    PlayerAccess.setMapScannerActive(false);
    Client.showMap = false;
    Client.showSystemMap = true;
  });

  it("maps dial steps to 0–1 strength", () => {
    setMapScannerStrengthFromStep(0, G.P);
    expect(mapScannerStrengthStepIndex(G.P)).toBe(0);
    setMapScannerStrengthFromStep(C.SCANNING.MAP_STRENGTH_STEPS - 1, G.P);
    expect(mapScannerStrengthStepIndex(G.P)).toBe(C.SCANNING.MAP_STRENGTH_STEPS - 1);
  });

  it("scales drain and signature at max strength", () => {
    PlayerAccess.setMapScannerStrength(1);
    expect(getMapScannerDrainMult(G.P)).toBeCloseTo(C.SCANNING.MAP_STRENGTH.drainMax);
    expect(getMapScannerSignatureMult(G.P)).toBeCloseTo(C.SCANNING.MAP_STRENGTH.signatureMax);
    const base = SHIPS.scout.signatureRadius;
    Client.showMap = true;
    PlayerAccess.setMapScannerActive(true);
    expect(getEffectiveSignatureRadius(G.P)).toBe(Math.round(base * C.SCANNING.MAP_STRENGTH.signatureMax));
  });

  it("uses base signature when scanner is off", () => {
    Client.showMap = true;
    PlayerAccess.setMapScannerActive(false);
    expect(getEffectiveSignatureRadius(G.P)).toBe(SHIPS.scout.signatureRadius);
    expect(isMapScannerEmitting(G.P)).toBe(false);
  });

  it("drain per second follows config base", () => {
    PlayerAccess.setMapScannerStrength(0.5);
    const expected = C.SCANNING.MAP_DRAIN.basePerSec * getMapScannerDrainMult(G.P);
    expect(getMapScannerDrainPerSec(G.P)).toBeCloseTo(expected);
  });
});
