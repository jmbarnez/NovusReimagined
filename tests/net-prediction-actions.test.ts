import { beforeEach, describe, expect, it } from "vitest";
import { _G as G, Client } from "../src/state.js";;
import { makePlayer } from "../src/player/player-data.js";
import { installTestPlayer } from "../src/player-registry.js";
import { predictionManager } from "../src/net/prediction.js";
import { applySnapshotToG } from "../src/net/client.js";
import { createSnapshot } from "../src/sim/snapshot.js";
import { buildGalaxy, populateSystem } from "../src/world-gen.js";
import type { InputFrame } from "../src/sim/input.js";

function frameWithAction(actions: InputFrame["actions"]): InputFrame {
  return {
    tick: 1,
    keys: { space: false, w: false, a: false, s: false, d: false, boost: false, warp: false },
    mouseWorld: { x: 0, y: 0 },
    waypoint: null,
    navCommand: null,
    movementControlMode: "waypoint",
    actions,
  };
}

describe("prediction action replay", () => {
  beforeEach(() => {
    predictionManager.clear();
    const local = installTestPlayer(makePlayer());
    local.netId = "local-player";
    local.lockQueue = [];
    local.targetLock = null;
    local._assignTargetId = null;
    G.GALAXY = buildGalaxy();
    populateSystem(G.GALAXY[0]!);
  });

  it("reapplies a pending sensor-lock request after an older snapshot overwrites local state", () => {
    const authoritative = makePlayer();
    authoritative.netId = G.P.netId;
    authoritative.lockQueue = [];
    authoritative.targetLock = null;
    const asteroid = G.GALAXY[0]?.asteroids[0];
    const asteroidId = asteroid?.id;
    expect(asteroidId).toBeTruthy();
    if (!asteroidId) return;
    if (asteroid) {
      G.P.x = asteroid.x;
      G.P.y = asteroid.y;
      authoritative.x = asteroid.x;
      authoritative.y = asteroid.y;
    }

    predictionManager.addInput(frameWithAction([
      { type: "requestSensorLock", payload: { id: asteroidId } },
    ]));

    const snap = createSnapshot(0, G, authoritative);
    applySnapshotToG(snap, true);
    predictionManager.reconcile(snap);

    expect(G.P.lockQueue[0]?.id).toBe(asteroidId);
    expect(G.P.lockQueue[0]?.resolving).toBe(true);
  });

  it("does not toggle assignment off when replaying a pending second-click lock action", () => {
    const authoritative = makePlayer();
    authoritative.netId = G.P.netId;
    const asteroid = G.GALAXY[0]?.asteroids[0];
    const asteroidId = asteroid?.id;
    expect(asteroidId).toBeTruthy();
    if (!asteroidId) return;

    G.P.lockQueue = [{ id: asteroidId, resolving: false, acc: 1 }];
    G.P._assignTargetId = asteroidId;
    authoritative.lockQueue = [{ id: asteroidId, resolving: false, acc: 1 }];
    authoritative._assignTargetId = asteroidId;

    predictionManager.addInput(frameWithAction([
      { type: "requestSensorLock", payload: { id: asteroidId } },
    ]));

    const snap = createSnapshot(0, G, authoritative);
    applySnapshotToG(snap, true);
    predictionManager.reconcile(snap);

    expect(G.P._assignTargetId).toBe(asteroidId);
  });

  it("reapplies a pending module toggle after an older snapshot overwrites local power state", () => {
    const authoritative = makePlayer();
    authoritative.netId = G.P.netId;
    authoritative.turretPower[0] = false;
    authoritative.turretPowerCd[0] = 0;

    predictionManager.addInput(frameWithAction([
      { type: "toggleSlotDefaultAction", payload: { rack: "high", idx: 0 } },
    ]));

    const snap = createSnapshot(0, G, authoritative);
    applySnapshotToG(snap, true);
    predictionManager.reconcile(snap);

    expect(G.P.turretPower[0]).toBe(true);
    expect(G.P.turretPowerCd[0]).toBeGreaterThan(0);
  });

  it("applies mining laser snapshot state for host role on full snapshot", () => {
    const prevRole = Client.multiplayerRole;
    Client.multiplayerRole = "host";
    try {
      const authoritative = makePlayer();
      authoritative.netId = G.P.netId;
      authoritative.miningLaser = {
        active: true,
        x1: 10,
        y1: 20,
        x2: 30,
        y2: 40,
        phase: 1.25,
        hitR: 6,
        hitNx: 1,
        hitNy: 0,
      };

      G.P.miningLaser = null;
      const snap = createSnapshot(0, G, authoritative);
      applySnapshotToG(snap, true);

      const mining = G.P.miningLaser as
        | { active: boolean; x2: number; y2: number }
        | null
        | undefined;
      expect(mining).toBeTruthy();
      if (!mining) return;
      expect(mining.active).toBe(true);
      expect(mining.x2).toBe(30);
      expect(mining.y2).toBe(40);
    } finally {
      Client.multiplayerRole = prevRole;
    }
  });

  it("applies server-auth craft/resource state from snapshot", () => {
    const authoritative = makePlayer();
    authoritative.netId = G.P.netId;
    authoritative.ore = { iron: 4 };
    authoritative.bulkMaterialsCargo = [{
      id: "mat-1",
      materialId: "ferro_nickel_stock",
      kind: "alloy",
      label: "Ferro-nickel stock",
      volumeM3: 2,
      massKg: 16300,
      alloyFamilyId: "ferro_nickel_stock",
      composition: { iron: 0.64, nickel: 0.24, carbon: 0.08, silicate: 0.04 },
    }];
    authoritative.loot = { scrap: 7 };
    authoritative.components = { gear: 1 };
    authoritative.blueprints = { sensor_cluster: true };
    authoritative.craftQueue = [{
      id: "job-1",
      recipeId: "gear",
      startTime: Date.now(),
      duration: 8000,
      qty: 2,
    }];

    const snap = createSnapshot(0, G, authoritative);
    applySnapshotToG(snap, true);

    expect(G.P.ore.iron).toBe(4);
    expect(G.P.bulkMaterialsCargo[0]?.materialId).toBe("ferro_nickel_stock");
    expect(G.P.bulkMaterialsCargo[0]?.volumeM3).toBe(2);
    expect(G.P.loot.scrap).toBe(7);
    expect(G.P.components.gear).toBe(1);
    expect(G.P.blueprints.sensor_cluster).toBe(true);
    expect(G.P.craftQueue[0]?.id).toBe("job-1");
  });
});
