import { beforeEach, describe, expect, it } from "vitest";
import { _G as G } from "../src/state.js";;
import { makePlayer } from "../src/player/player-data.js";
import { installTestPlayer, isLocalPlayer, LOCAL_PLAYER_ID } from "../src/player-registry.js";
import { PlayerAccess } from "../src/state-access.js";
import { buildGalaxy, populateSystem } from "../src/world-gen.js";
import { createSnapshot } from "../src/sim/snapshot.js";
import { applySnapshotToG } from "../src/net/client.js";

describe("local player registry stability", () => {
  beforeEach(() => {
    const local = installTestPlayer(makePlayer());
    G.GALAXY = buildGalaxy();
    populateSystem(G.GALAXY[0]!);
    PlayerAccess.setNetId("client-local", local);
  });

  it("keeps LOCAL_PLAYER_ID mapped to G.P after snapshot apply", () => {
    const authoritative = makePlayer();
    authoritative.netId = G.P.netId;
    authoritative.x = G.P.x;
    authoritative.y = G.P.y;
    authoritative.sysIdx = G.P.sysIdx;
    const snap = createSnapshot(1, G, authoritative);

    applySnapshotToG(snap, true);

    expect(G.players.get(LOCAL_PLAYER_ID)).toBe(G.P);
    expect(isLocalPlayer(G.P)).toBe(true);
  });
});

