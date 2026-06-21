import { beforeEach, describe, expect, it } from "vitest";
import { _G as G } from "../src/state.js";
import { makePlayer } from "../src/player/player-data.js";
import { installTestPlayer } from "../src/player-registry.js";
import { createLocalInputFrame } from "../src/sim/input.js";
import { onCtxItemClick } from "../src/ui/hud/turret-menu.js";


function clickEventWithTarget(target: HTMLElement): Event {
  const event = new Event("click");
  Object.defineProperty(event, "target", { value: target });
  return event;
}

describe("turret menu command queueing", () => {
  beforeEach(() => {
    installTestPlayer(makePlayer());
    createLocalInputFrame(0);
  });

  it("queues target clearing through assignModuleSlotToTarget", () => {
    const target = document.createElement("div");
    target.dataset.action = "clear-target";
    target.dataset.idx = "0";

    onCtxItemClick(clickEventWithTarget(target));
    const frame = createLocalInputFrame(1);

    expect(frame.actions).toEqual([
      { type: "assignModuleSlotToTarget", payload: { slotIdx: 0, targetId: null } },
    ]);
  });
});
