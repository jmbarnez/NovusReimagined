import { describe, it, expect } from "vitest";
import { ClientSession } from "../src/server/client-session.js";
import { makePlayer } from "../src/player/player-data.js";
import type { InputFrame } from "../src/sim/input.js";

function makeFrame(tick: number, actions: InputFrame["actions"] = []): InputFrame {
  return {
    tick,
    keys: { space: false, w: false, a: false, s: false, d: false },
    mouseWorld: { x: 0, y: 0 },
    waypoint: null,
    navCommand: null,
    movementControlMode: "waypoint",
    actions,
  };
}

describe("ClientSession.consumeInputForTick", () => {
  it("consumes a slightly ahead client frame when server tick leads", () => {
    const session = new ClientSession("client_a", "scout", makePlayer());
    session.addInput(makeFrame(105));
    const { frame, staleActions } = session.consumeInputForTick(100);
    expect(frame?.tick).toBe(105);
    expect(staleActions).toEqual([]);
    expect(session.inputBuffer).toHaveLength(0);
  });

  it("reuses latest lagged frame for continuous movement when server tick is far ahead", () => {
    const session = new ClientSession("client_a", "scout", makePlayer());
    session.addInput(makeFrame(1));
    session.addInput(makeFrame(2));
    const { frame, staleActions } = session.consumeInputForTick(500);
    expect(frame?.tick).toBe(2);
    expect(frame?.actions).toEqual([]);
    expect(staleActions).toEqual([]);
    expect(session.inputBuffer).toHaveLength(0);
  });

  it("returns stale actions while still preserving latest lagged movement frame", () => {
    const session = new ClientSession("c1", "Pilot", makePlayer());
    session.addInput(
      makeFrame(5, [{ type: "requestSensorLock", payload: { id: "rat-1" } }]),
    );

    const { frame, staleActions } = session.consumeInputForTick(20);

    expect(frame?.tick).toBe(5);
    expect(frame?.actions).toEqual([]);
    expect(staleActions).toEqual([{ type: "requestSensorLock", payload: { id: "rat-1" } }]);
    expect(session.inputBuffer).toHaveLength(0);
  });
});
