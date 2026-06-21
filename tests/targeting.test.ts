import { describe, it, expect } from "vitest";
import {
  acceptsSpecialResourceTarget,
  isAsteroidTarget,
  isWreckPieceTarget,
  getPassiveScanRangePx,
  getSensorContactRangePx,
} from "../src/targeting.js";
import { SHIPS } from "../src/data/ships.js";
import { MODULES } from "../src/data/modules.js";

describe("acceptsSpecialResourceTarget", () => {
  it("weapon turrets do not accept asteroid or wreck piece targets", () => {
    const cannon = MODULES["tu-civilian-cannon"];
    expect(acceptsSpecialResourceTarget(cannon, true, false)).toBe(false);
    expect(acceptsSpecialResourceTarget(cannon, false, true)).toBe(false);
  });

  it("mining turrets accept asteroid targets only", () => {
    const miner = MODULES["tu-civilian-miner"];
    expect(acceptsSpecialResourceTarget(miner, true, false)).toBe(true);
    expect(acceptsSpecialResourceTarget(miner, false, true)).toBe(false);
  });

  it("salvagers accept wreck piece targets only", () => {
    const salv = Object.values(MODULES).find((m) => m.isSalvager);
    expect(salv).toBeTruthy();
    if (!salv) return;
    expect(acceptsSpecialResourceTarget(salv, false, true)).toBe(true);
    expect(acceptsSpecialResourceTarget(salv, true, false)).toBe(false);
  });

  it("tractors accept both asteroid and wreck piece targets", () => {
    const tractor = Object.values(MODULES).find((m) => m.isTractor);
    expect(tractor).toBeTruthy();
    if (!tractor) return;
    expect(acceptsSpecialResourceTarget(tractor, true, false)).toBe(true);
    expect(acceptsSpecialResourceTarget(tractor, false, true)).toBe(true);
  });
});

describe("target id helpers", () => {
  it("classifies asteroid and wreck ids", () => {
    expect(isAsteroidTarget("ast-42")).toBe(true);
    expect(isWreckPieceTarget("piece-7")).toBe(true);
    expect(isAsteroidTarget("piece-7")).toBe(false);
  });
});

describe("passive scan range", () => {
  it("uses hull passive km, not active sensor contact range", () => {
    const scout = SHIPS.scout;
    const passive = getPassiveScanRangePx(scout);
    const activeContact = getSensorContactRangePx(scout);
    const ifUsedActiveSensor = 2900 * ((scout.sensorContactRangeKm ?? 72) / 72);
    expect(passive).toBeCloseTo(2900 * (54 / 72), 5);
    expect(passive).not.toBeCloseTo(ifUsedActiveSensor, 1);
    expect(passive).toBeGreaterThan(activeContact);
  });
});
