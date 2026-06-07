import { describe, it, expect, beforeEach } from "vitest";
import { _G as G } from "../src/state.js";;
import { createSnapshot } from "../src/sim/snapshot.js";
import { makePlayer } from "../src/player/player-data.js";
import { registerPlayer } from "../src/player-registry.js";
import { buildGalaxy, populateSystem } from "../src/world-gen.js";

describe("createSnapshot other players", () => {
  beforeEach(() => {
    G.GALAXY = buildGalaxy();
    populateSystem(G.GALAXY[0]!);
    const host = makePlayer();
    host.netId = "client_host";
    G.P = registerPlayer(host, "client_host");
    G.P.x = 100;
    G.P.y = 200;
    G.P.sysIdx = 0;

    const joiner = makePlayer();
    joiner.netId = "client_joiner";
    joiner.x = 500;
    joiner.y = 600;
    joiner.sysIdx = 0;
    G.players = new Map([["client_joiner", joiner]]);

    G.bullets = [];
    G.enemyBullets = [];
    G.wreckPieces = [];
    G.salvagePickups = [];
  });

  it("includes other players with the same ship class when netIds differ", () => {
    const snap = createSnapshot(1, G, G.P);
    const remote = snap.entities.filter((e) => e.type === "player");
    expect(remote).toHaveLength(1);
    expect(remote[0]?.id).toBe("client_joiner");
    expect(remote[0]?.shipType).toBe("scout");
    expect(remote[0]?.x).toBe(500);
  });

  it("excludes the local player from entity list", () => {
    const selfCopy = makePlayer();
    selfCopy.netId = "client_host";
    G.players.set("client_host", selfCopy);
    const snap = createSnapshot(1, G, G.P);
    const remote = snap.entities.filter((e) => e.type === "player");
    expect(remote).toHaveLength(1);
    expect(remote[0]?.id).toBe("client_joiner");
  });

});
