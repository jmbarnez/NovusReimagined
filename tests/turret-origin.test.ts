import { describe, it, expect } from "vitest";
import { shipLocalToWorld, turretOriginToWorld } from "../src/combat/turret-origin.js";

describe("turret origin", () => {
  it("matches nozzle transform: forward +X, down +Y when nose points right", () => {
    const p = shipLocalToWorld(0, 0, 0, 9, 11);
    expect(p.x).toBeCloseTo(9);
    expect(p.y).toBeCloseTo(11);
  });

  it("places origin on the belly when nose points up", () => {
    const p = turretOriginToWorld(100, 200, Math.PI / 2, { forwardPx: 9, localDownPx: 11 });
    expect(p.x).toBeCloseTo(89);
    expect(p.y).toBeCloseTo(209);
  });
});
