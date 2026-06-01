import { describe, expect, it } from "vitest";
import { PixiGeometryBufferPool } from "../src/render/pixi-geometry-buffer-pool.js";

describe("PixiGeometryBufferPool", () => {
  it("returns distinct buffers for separate polygon draws in the same frame", () => {
    const pool = new PixiGeometryBufferPool();
    const first = pool.writeTranslatedWorldPoints([[0, 0], [1, 1]], 10, 20);
    const second = pool.writeTranslatedWorldPoints([[2, 2], [3, 3]], -5, 4);

    expect(second).not.toBe(first);
    expect(first).toEqual([10, 20, 11, 21]);
    expect(second).toEqual([-3, 6, -2, 7]);
  });

  it("reuses prior buffers safely after a frame reset", () => {
    const pool = new PixiGeometryBufferPool();
    const firstFrame = pool.writeTranslatedWorldPoints([[0, 0], [1, 1]], 1, 2);
    pool.writeTranslatedWorldPoints([[5, 5], [6, 6]], 0, 0);

    pool.resetFrame();

    const secondFrame = pool.writeTranslatedWorldPoints([[2, 3], [4, 5]], 10, 20);
    expect(secondFrame).toBe(firstFrame);
    expect(secondFrame).toEqual([12, 23, 14, 25]);
  });

  it("writes rotated and scaled world-space points", () => {
    const pool = new PixiGeometryBufferPool();
    const flatPts = pool.writeRotatedScaledWorldPoints(
      [[1, 0], [0, 1], [-1, 0]],
      100,
      50,
      2,
      0,
      1,
    );

    expect(flatPts).toEqual([100, 52, 98, 50, 100, 48]);
  });

  it("writes translated world-space points", () => {
    const pool = new PixiGeometryBufferPool();
    const flatPts = pool.writeTranslatedWorldPoints(
      [[-1, 2], [3, -4], [0, 0]],
      7,
      9,
    );

    expect(flatPts).toEqual([6, 11, 10, 5, 7, 9]);
  });
});
