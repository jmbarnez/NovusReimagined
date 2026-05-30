import { describe, it, expect } from "vitest";
import {
  angularDistanceDeg,
  applyProgressCap,
  isInScanCone,
  normalizeAngleDeg,
  PROGRESS_CAP_UNTIL_TRIANG,
  getConeRangeMult,
  getScanEnergyCost,
} from "../src/scanning.js";

describe("isInScanCone", () => {
  it("includes bearings inside half-width", () => {
    expect(isInScanCone(10, 0, 90)).toBe(true);
    expect(isInScanCone(350, 0, 90)).toBe(true);
  });

  it("excludes bearings outside half-width", () => {
    expect(isInScanCone(100, 0, 90)).toBe(false);
    expect(isInScanCone(270, 0, 90)).toBe(false);
  });

  it("wraps across 0°", () => {
    expect(isInScanCone(355, 5, 20)).toBe(true);
    expect(isInScanCone(340, 5, 20)).toBe(false);
  });

  it("covers ±90° with a 180° cone", () => {
    expect(isInScanCone(80, 10, 180)).toBe(true);
    expect(isInScanCone(200, 10, 180)).toBe(false);
  });
});

describe("angularDistanceDeg", () => {
  it("uses shortest arc", () => {
    expect(angularDistanceDeg(10, 350)).toBe(20);
    expect(angularDistanceDeg(0, 180)).toBe(180);
  });
});

describe("normalizeAngleDeg", () => {
  it("normalizes negative and overflow angles", () => {
    expect(normalizeAngleDeg(-10)).toBe(350);
    expect(normalizeAngleDeg(370)).toBe(10);
  });
});

describe("getConeRangeMult", () => {
  it("gives longer range for tighter cones", () => {
    expect(getConeRangeMult(15)).toBeGreaterThan(getConeRangeMult(180));
    expect(getConeRangeMult(15)).toBe(1.4);
    expect(getConeRangeMult(180)).toBe(0.75);
  });
});

describe("getScanEnergyCost", () => {
  it("costs more cap for tighter cones", () => {
    expect(getScanEnergyCost(15)).toBeGreaterThan(getScanEnergyCost(180));
  });
});

describe("applyProgressCap", () => {
  it("caps progress at 55% until second pulse", () => {
    expect(applyProgressCap(0.9, 1, false)).toBe(PROGRESS_CAP_UNTIL_TRIANG);
    expect(applyProgressCap(0.4, 1, false)).toBe(0.4);
  });

  it("allows full progress after two pulses", () => {
    expect(applyProgressCap(0.9, 2, false)).toBe(0.9);
  });

  it("exempts tutorial sites", () => {
    expect(applyProgressCap(0.9, 1, true)).toBe(0.9);
  });
});
