import { describe, expect, it } from "vitest";
import { bindPlayerNetInput } from "../src/physics/net-input.js";
import { makePlayer } from "../src/player/player-data.js";
import type { InputFrame } from "../src/sim/input.js";

describe("bindPlayerNetInput", () => {
  it("copies expanded movement keys to the player", () => {
    const player = makePlayer();
    const frame: InputFrame = {
      tick: 1,
      keys: { space: true, w: true, a: true, s: false, d: true, boost: true },
      mouseWorld: { x: 10, y: 20 },
      waypoint: null,
      navCommand: null,
      movementControlMode: "waypoint",
      actions: [],
    };

    bindPlayerNetInput(player, frame);

    expect(player.inputKeys).toEqual({ space: true, w: true, a: true, s: false, d: true, boost: true });
  });
});
