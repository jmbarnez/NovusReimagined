import { describe, expect, it } from "vitest";
import { makePlayer } from "../src/player/player-data.js";
import type { Gate } from "../src/types/station.js";
import { didCrossGateAperture, gateActivationRadius } from "../src/utils/warp-gates.js";

function makeGate(): Gate {
  return {
    id: "gate-test",
    x: 0,
    y: 0,
    px: 0,
    py: 0,
    target: { kind: "local", x: 0, y: 0, label: "sector-1" },
    targetSysIdx: 1,
    radius: 100,
    spin: 0,
  };
}

function playerSegment(px: number, py: number, x: number, y: number) {
  const p = makePlayer();
  p.px = px;
  p.py = py;
  p.x = x;
  p.y = y;
  return p;
}

describe("warp gate aperture crossing", () => {
  it("uses an inner activation radius", () => {
    expect(gateActivationRadius(makeGate())).toBeCloseTo(78);
  });

  it("triggers when the player crosses from outside into the aperture", () => {
    expect(didCrossGateAperture(makeGate(), playerSegment(-160, 0, 0, 0))).toBe(true);
  });

  it("triggers when a fast segment passes through the aperture", () => {
    expect(didCrossGateAperture(makeGate(), playerSegment(-160, 0, 160, 0))).toBe(true);
  });

  it("does not trigger while stationary inside the aperture", () => {
    expect(didCrossGateAperture(makeGate(), playerSegment(0, 0, 0, 0))).toBe(false);
  });

  it("does not trigger when passing beside the ring opening", () => {
    expect(didCrossGateAperture(makeGate(), playerSegment(-160, 90, 160, 90))).toBe(false);
  });

  it("does not falsely trigger for a stationary gate at a non-zero position", () => {
    const gate: Gate = {
      id: "gate-tutorial-return",
      x: -260,
      y: 0,
      px: -260,
      py: 0,
      target: { kind: "local", x: 0, y: 0, label: "Academy" },
      radius: 100,
      spin: 0,
    };
    // Player at origin moving slightly — previously triggered because gate px/py was (0,0)
    expect(didCrossGateAperture(gate, playerSegment(0, 0, 5, 0))).toBe(false);
  });

  it("triggers crossing even at very slow speeds (no minimum speed requirement)", () => {
    // Previously this would fail due to WARP_GATE_MIN_CROSS_SPEED check
    // Move from just outside to just inside the ~78 unit activation radius
    expect(didCrossGateAperture(makeGate(), playerSegment(-80, 0, -76, 0))).toBe(true);
  });
});
