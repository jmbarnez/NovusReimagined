import { beforeEach, describe, expect, it } from "vitest";
import { createLocalInputFrame, queueFrameAction, sanitizeInputFrame } from "../src/sim/input.js";
import { Client } from "../src/state.js";

describe("frame action queue", () => {
  beforeEach(() => {
    Client.keys = {};
    Client.mouse.lmb = false;
    Client.gameStarted = false;
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

  it("always includes WASD keys", () => {
    Client.keys["w"] = true;
    Client.keys["a"] = true;
    Client.keys["s"] = true;
    Client.keys["d"] = true;

    const frame = createLocalInputFrame(1);

    expect(frame.keys).toEqual({ space: false, w: true, a: true, s: true, d: true, boost: false, warp: false, lmb: false });
  });

  it("defaults missing legacy movement keys to false when sanitizing input", () => {
    const frame = sanitizeInputFrame({
      tick: 1,
      keys: { space: true, w: true },
      mouseWorld: { x: 0, y: 0 },
      actions: [],
    });

    expect(frame?.keys).toEqual({ space: true, w: true, a: false, s: false, d: false, boost: false, warp: false, lmb: false });
  });

  it("includes held engine boost input in local frames", () => {
    Client.keys["boost"] = true;

    const frame = createLocalInputFrame(1);

    expect(frame.keys.boost).toBe(true);
  });

  it("does not queue weapon fire while shift is held for click-to-lock", () => {
    Client.gameStarted = true;
    Client.mouse.lmb = true;
    Client.keys["shift"] = true;

    const frame = createLocalInputFrame(1);

    expect(frame.actions).toEqual([]);
  });
});
