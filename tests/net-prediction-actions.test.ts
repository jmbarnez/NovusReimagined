import { beforeEach, describe, expect, it } from "vitest";
import { _G as G, Client } from "../src/state.js";
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
    keys: { space: false, w: false, a: false, s: false, d: false, boost: false, warp: false, lmb: false },
    mouseWorld: { x: 0, y: 0 },
    actions,
  };
}

describe("prediction action replay", () => {
  beforeEach(() => {
    predictionManager.clear();
    const local = installTestPlayer(makePlayer());
    local.netId = "local-player";
    G.GALAXY = buildGalaxy();
    populateSystem(G.GALAXY[0]!);
  });

  it("reapplies a pending hardpoint selection after an older snapshot overwrites local fire slot", () => {
    const authoritative = makePlayer();
    authoritative.netId = G.P.netId;
    authoritative.fireControlSlot = 0;

    predictionManager.addInput(frameWithAction([
      { type: "toggleSlotDefaultAction", payload: { rack: "high", idx: 0 } },
    ]));

    const snap = createSnapshot(0, G, authoritative);
    applySnapshotToG(snap, true);
    predictionManager.reconcile(snap);

    expect(G.P.fireControlSlot).toBe(0);
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
