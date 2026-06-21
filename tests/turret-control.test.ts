import { beforeEach, describe, expect, it } from "vitest";
import { _G as G, Client } from "../src/state.js";
import { makePlayer } from "../src/player/player-data.js";
import { installTestPlayer } from "../src/player-registry.js";
import { updateTurretCooldowns } from "../src/combat/turret-control.js";
import { buildGalaxy, populateSystem } from "../src/world-gen.js";

describe("turret control hardpoint rack", () => {
  beforeEach(() => {
    G.GALAXY = buildGalaxy();
    populateSystem(G.GALAXY[0]!);
    installTestPlayer(makePlayer());
    G.P.sysIdx = 0;
    Client.showMap = false;
    Client.bridgeOpen = false;
  });

  it("does not auto-fire assigned combat weapons (manual fire only)", () => {
    G.P.energy = 1_000;
    G.P.ammo.hybrid = 1_000;
    G.P.fitting.high[0] = "start-tu-civ-cannon";

    updateTurretCooldowns(0.016, G.P);

    expect(G.P.turretCds[0]).toBe(0);
  });
});
