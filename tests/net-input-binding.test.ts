import { describe, expect, it } from "vitest";
import { bindPlayerNetInput } from "../src/physics/net-input.js";
import { makePlayer } from "../src/player/player-data.js";
import { getPlayerInputKeys } from "../src/player/input-state.js";
import type { InputFrame } from "../src/sim/input.js";

describe("bindPlayerNetInput", () => {
  it("copies expanded movement keys to the input state store", () => {
    const player = makePlayer();
    const frame: InputFrame = {
      tick: 1,
      keys: { space: true, w: true, a: true, s: false, d: true, boost: true, warp: false, lmb: false },
      mouseWorld: { x: 10, y: 20 },
      actions: [],
    };

    bindPlayerNetInput(player, frame);

    expect(getPlayerInputKeys(player.netId ?? player.shipId)).toEqual({ space: true, w: true, a: true, s: false, d: true, boost: true, warp: false, lmb: false });
  });
});
