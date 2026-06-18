import { describe, it, expect, beforeEach } from "vitest";
import { _G as G, Client } from "../src/state.js";
import { makePlayer } from "../src/player/player-data.js";
import { installTestPlayer } from "../src/player-registry.js";
import { updateShip } from "../src/physics/ship.js";
import { PlayerAccess } from "../src/state-access.js";
import { getStats, invalidate } from "../src/player/player-stats.js";
import { setPlayerInput } from "../src/player/input-state.js";
import { C } from "../src/config/index.js";

function removeIonBoostModule(): void {
  G.P.fitting.med = G.P.fitting.med.map((uid) => uid === "start-me-ab1" ? null : uid);
}

describe("ship physics", () => {
  beforeEach(() => {
    installTestPlayer(makePlayer());
    invalidate(G.P);
    Client.stationOpen = false;
    Client.bridgeOpen = false;
    Client.settingsOpen = false;
  });

  it("gate boost exempts player from boost speed cap", () => {
    const st = getStats(G.P);
    const boostedCap = (st.maxSpeed || 0) * C.PHYSICS.SHIP.boostBaseSpeedMult;
    expect(boostedCap).toBeGreaterThan(0);

    // Set velocity above boosted cap
    PlayerAccess.updatePhysics({ vx: boostedCap + 50, vy: 0 }, G.P);

    // Enable boost input and thrust
    setPlayerInput(G.P.netId ?? G.P.shipId, { space: false, w: true, a: false, s: false, d: false, boost: true, warp: false, lmb: false }, { x: 0, y: 0 });
    PlayerAccess.setEnergy(100, G.P);
    PlayerAccess.setGateBoostRemaining(1.5, G.P);

    updateShip(0.016, G.P);

    const speedAfter = Math.hypot(G.P.vx, G.P.vy);
    expect(speedAfter).toBeGreaterThan(boostedCap);
  });

  it("boost speed cap clamps when gate boost has expired", () => {
    removeIonBoostModule();
    invalidate(G.P);
    const st = getStats(G.P);
    const boostedCap = (st.maxSpeed || 0) * C.PHYSICS.SHIP.boostBaseSpeedMult;
    expect(boostedCap).toBeGreaterThan(0);

    // Set velocity above boosted cap without gate boost
    PlayerAccess.updatePhysics({ vx: boostedCap + 50, vy: 0 }, G.P);

    setPlayerInput(G.P.netId ?? G.P.shipId, { space: false, w: true, a: false, s: false, d: false, boost: true, warp: false, lmb: false }, { x: 0, y: 0 });
    PlayerAccess.setEnergy(100, G.P);
    PlayerAccess.setGateBoostRemaining(0, G.P);

    updateShip(0.016, G.P);

    const speedAfter = Math.hypot(G.P.vx, G.P.vy);
    expect(speedAfter).toBeLessThanOrEqual(boostedCap + 1); // allow small tolerance
  });

  it("gate boost remaining decays each frame", () => {
    PlayerAccess.setGateBoostRemaining(1.0, G.P);
    updateShip(0.016, G.P);
    expect(G.P.gateBoostRemaining).toBeCloseTo(0.984, 3);
  });
});
