import { beforeEach, describe, expect, it } from "vitest";
import { createLocalInputFrame, queueFrameAction, sanitizeInputFrame } from "../src/sim/input.js";
import { Client } from "../src/state.js";

describe("frame action queue", () => {
  beforeEach(() => {
    Client.keys = {};
    Client.waypoint = null;
    Client.navCommand = null;
    Client.mouse.lmb = false;
    Client.gameStarted = false;
    Client.settings.movementControlMode = "waypoint";
    createLocalInputFrame(0);
  });

  it("replaces prior commands of the same type when requested", () => {
    queueFrameAction({ type: "setTractorTightness", payload: { value: 0.2 } }, { replaceByType: true });
    queueFrameAction({ type: "setTractorTightness", payload: { value: 0.7 } }, { replaceByType: true });
    queueFrameAction({ type: "setMapScannerStrength", payload: { strength: 0.1 } }, { replaceByType: true });
    queueFrameAction({ type: "setMapScannerStrength", payload: { strength: 0.9 } }, { replaceByType: true });

    const frame = createLocalInputFrame(1);

    expect(frame.actions).toEqual([
      { type: "setTractorTightness", payload: { value: 0.7 } },
      { type: "setMapScannerStrength", payload: { strength: 0.9 } },
    ]);
  });

  it("keeps distinct command types alongside replaced settings", () => {
    queueFrameAction({ type: "setMapScannerPower", payload: { active: true } }, { replaceByType: true });
    queueFrameAction({ type: "setMapScannerPower", payload: { active: false } }, { replaceByType: true });
    queueFrameAction({ type: "requestSensorLock", payload: { id: "rat-1" } });

    const frame = createLocalInputFrame(1);

    expect(frame.actions).toEqual([
      { type: "setMapScannerPower", payload: { active: false } },
      { type: "requestSensorLock", payload: { id: "rat-1" } },
    ]);
  });

  it("includes WASD only in direct movement mode", () => {
    Client.settings.movementControlMode = "direct";
    Client.keys["w"] = true;
    Client.keys["a"] = true;
    Client.keys["s"] = true;
    Client.keys["d"] = true;

    const directFrame = createLocalInputFrame(1);

    expect(directFrame.keys).toEqual({ space: false, w: true, a: true, s: true, d: true });

    Client.settings.movementControlMode = "waypoint";
    const waypointFrame = createLocalInputFrame(2);

    expect(waypointFrame.keys).toEqual({ space: false, w: false, a: false, s: false, d: false });
  });

  it("sends waypoints only in waypoint movement mode", () => {
    Client.waypoint = { x: 12, y: 34 };

    const waypointFrame = createLocalInputFrame(1);

    expect(waypointFrame.waypoint).toEqual({ x: 12, y: 34 });

    Client.settings.movementControlMode = "direct";
    const directFrame = createLocalInputFrame(2);

    expect(directFrame.waypoint).toBeNull();
  });

  it("defaults missing legacy movement keys to false when sanitizing input", () => {
    const frame = sanitizeInputFrame({
      tick: 1,
      keys: { space: true, w: true },
      mouseWorld: { x: 0, y: 0 },
      waypoint: null,
      navCommand: null,
      actions: [],
    });

    expect(frame?.keys).toEqual({ space: true, w: true, a: false, s: false, d: false });
  });

  it("does not queue weapon fire while shift is held for click-to-lock", () => {
    Client.gameStarted = true;
    Client.mouse.lmb = true;
    Client.keys["shift"] = true;
    Client.settings.movementControlMode = "direct";

    const frame = createLocalInputFrame(1);

    expect(frame.actions).toEqual([]);
  });
});
