import { beforeEach, describe, expect, it } from "vitest";
import { createLocalInputFrame, queueFrameAction } from "../src/sim/input.js";

describe("frame action queue", () => {
  beforeEach(() => {
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
});
