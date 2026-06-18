import { describe, it, expect } from "vitest";
import { dst, angleDiff, lerp, mulberry32, hashStr, rpick, rayCircleSurfaceHit, resolveElasticCollision, pointInPolygon, segmentsIntersect, polygonsIntersect, polygonCollisionInfo } from "../src/utils/math.js";
import { getPlayerColRadius, getEnemyColRadius } from "../src/utils/collision-helpers.js";

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

  it("rayCircleSurfaceHit returns the near-side circle intersection", () => {
    const hit = rayCircleSurfaceHit(0, 0, 100, 0, 20);
    expect(hit.x).toBeCloseTo(80);
    expect(hit.y).toBeCloseTo(0);
    expect(Math.hypot(hit.x - 100, hit.y)).toBeCloseTo(20);
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

  it("resolveElasticCollision returns 0 closing speed when dist is 0", () => {
    const a = { x: 0, y: 0, vx: 10, vy: 0 };
    const b = { x: 0, y: 0, vx: -5, vy: 0 };
    const closing = resolveElasticCollision(a, b, 800, 450, 0, 0, 0, 40, 0.28);
    expect(closing).toBe(0);
    expect(Number.isFinite(a.vx)).toBe(true);
    expect(Number.isFinite(b.vx)).toBe(true);
  });

  it("pointInPolygon detects inside and outside points", () => {
    const square = [[0, 0], [10, 0], [10, 10], [0, 10]];
    expect(pointInPolygon(5, 5, square)).toBe(true);
    expect(pointInPolygon(15, 5, square)).toBe(false);
  });

  it("segmentsIntersect detects crossing and non-crossing segments", () => {
    expect(segmentsIntersect(0, 0, 10, 10, 0, 10, 10, 0)).toBe(true);
    expect(segmentsIntersect(0, 0, 10, 0, 5, 1, 5, 10)).toBe(false);
  });

  it("polygonsIntersect detects overlapping polygons", () => {
    const a = [[0, 0], [10, 0], [10, 10], [0, 10]];
    const b = [[5, 5], [15, 5], [15, 15], [5, 15]];
    const c = [[20, 20], [30, 20], [30, 30], [20, 30]];
    expect(polygonsIntersect(a, b)).toBe(true);
    expect(polygonsIntersect(a, c)).toBe(false);
  });

  it("polygonCollisionInfo returns a separation normal for overlapping polygons", () => {
    const a = [[0, 0], [10, 0], [10, 10], [0, 10]];
    const b = [[5, 5], [15, 5], [15, 15], [5, 15]];
    const info = polygonCollisionInfo(a, b);
    expect(info).not.toBeNull();
    if (!info) return;
    expect(info.depth).toBeCloseTo(5);
    expect(info.nx).toBeCloseTo(-1 / Math.sqrt(2)); // normal points from b toward a
    expect(info.ny).toBeCloseTo(-1 / Math.sqrt(2));
    expect(polygonCollisionInfo(a, [[20, 20], [30, 20], [30, 30], [20, 30]])).toBeNull();
  });

  it("collision helpers derive radii from hull paths", () => {
    expect(getPlayerColRadius("scout")).toBe(14);
    expect(getEnemyColRadius("rat_drone")).toBe(14);
    expect(getEnemyColRadius("drone")).toBe(13);
    expect(getEnemyColRadius("pirate")).toBe(18);
    expect(getEnemyColRadius("raider")).toBe(23);
  });
});
