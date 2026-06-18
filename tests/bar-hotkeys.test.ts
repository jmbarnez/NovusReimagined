import { beforeEach, describe, expect, it } from "vitest";
import { _G as G } from "../src/state.js";
import { makePlayer } from "../src/player/player-data.js";
import { installTestPlayer } from "../src/player-registry.js";
import { applyBarHotkey, barHotkeySlotList } from "../src/player/player-fitting.js";
import { createLocalInputFrame } from "../src/sim/input.js";
import { setAssignTargetId } from "../src/player/target-selection.js";
import { playerHardpointRack } from "../src/utils/hardpoints.js";

describe("bar hotkeys", () => {
  beforeEach(() => {
    installTestPlayer(makePlayer());
    createLocalInputFrame(0);
    setAssignTargetId(G.P.netId ?? G.P.shipId, null);
  });

  it("queues hardpoint selection through the command path", () => {
    const hardpointRack = playerHardpointRack(G.P);
    G.P.turretPower[0] = false;

    applyBarHotkey(0);
    const frame = createLocalInputFrame(1);

    expect(frame.actions).toEqual([
      { type: "toggleSlotDefaultAction", payload: { rack: hardpointRack, idx: 0 } },
      { type: "setFireControlSlot", payload: { slot: 0 } },
    ]);
  });

  it("queues hardpoint target assignment when an assignment target is selected", () => {
    G.P.turretPower[0] = true;
    setAssignTargetId(G.P.netId ?? G.P.shipId, "rat-1");

    applyBarHotkey(0);
    const frame = createLocalInputFrame(1);

    expect(frame.actions).toEqual([
      { type: "setFireControlSlot", payload: { slot: 0 } },
      { type: "assignModuleSlotToTarget", payload: { slotIdx: 0, targetId: "rat-1" } },
      { type: "selectLockTarget", payload: { id: "rat-1" } },
    ]);
  });

  it("keeps non-hardpoint slots on their default action path", () => {
    const hardpointRack = playerHardpointRack(G.P);
    const slotIndex = barHotkeySlotList().findIndex((slot) => slot.rack !== hardpointRack);
    expect(slotIndex).toBeGreaterThanOrEqual(0);
    if (slotIndex < 0) return;

    const { rack, idx } = barHotkeySlotList()[slotIndex]!;
    applyBarHotkey(slotIndex);
    const frame = createLocalInputFrame(1);

    expect(frame.actions).toEqual([
      { type: "toggleSlotDefaultAction", payload: { rack, idx } },
    ]);
  });
});
