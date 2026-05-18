import { describe, it, expect } from "vitest";
import { dst, angleDiff, lerp, mulberry32, hashStr, rpick } from "../src/utils/math.js";

const TAU = Math.PI * 2;

describe("math utils", () => {
  it("dst computes Euclidean distance", () => {
    expect(dst(0, 0, 3, 4)).toBeCloseTo(5);
    expect(dst(1, 1, 1, 1)).toBe(0);
  });

  it("angleDiff returns shortest signed difference", () => {
    expect(angleDiff(0, 0)).toBe(0);
    expect(angleDiff(0, Math.PI)).toBeCloseTo(Math.PI);
    expect(angleDiff(0, -Math.PI)).toBeCloseTo(Math.PI);
    expect(angleDiff(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2);
    expect(angleDiff(Math.PI / 2, 0)).toBeCloseTo(-Math.PI / 2);
    expect(angleDiff(TAU - 0.1, 0.1)).toBeCloseTo(0.2);
  });

  it("lerp interpolates linearly", () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(0, 10, 0.5)).toBe(5);
  });

  it("mulberry32 is deterministic for same seed", () => {
    const rng1 = mulberry32(12345);
    const rng2 = mulberry32(12345);
    for (let i = 0; i < 10; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  it("hashStr returns consistent integers", () => {
    expect(hashStr("abc")).toBe(hashStr("abc"));
    expect(hashStr("a")).not.toBe(hashStr("b"));
  });

  it("rpick returns undefined on empty arrays", () => {
    expect(rpick(() => 0, [])).toBeUndefined();
  });

  it("rpick returns an element when array has items", () => {
    const v = rpick(() => 0, [10, 20, 30]);
    expect([10, 20, 30]).toContain(v);
  });
});
