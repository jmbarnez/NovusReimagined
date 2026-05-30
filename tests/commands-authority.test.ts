import { describe, expect, it } from "vitest";
import { executeGameCommand } from "../src/sim/commands.js";
import { makePlayer } from "../src/player/player-data.js";
import { _G as G } from "../src/state.js";;
import { WorldAccess } from "../src/state-access.js";
import { allActivePlayers, activeSystemIndices } from "../src/utils/game.js";
import { buildGalaxy, populateSystem } from "../src/world-gen.js";

describe("authoritative command validation", () => {
  it("rejects invalid hardpoint indexes", () => {
    const p = makePlayer();
    p.fireControlSlot = 0;

    executeGameCommand({ type: "setFireControlSlot", payload: { slot: 999 } }, p);

    expect(p.fireControlSlot).toBe(0);
  });

  it("rejects invalid rack names for slot toggles", () => {
    const p = makePlayer();
    const before = [...p.turretPower];

    executeGameCommand({ type: "toggleSlotDefaultAction", payload: { rack: "bogus", idx: 0 } }, p);

    expect(p.turretPower).toEqual(before);
  });

  it("does not silently simulate an unregistered local singleton", () => {
    const p = makePlayer();
    p.sysIdx = 2;
    G.P = p;
    G.players = new Map();

    expect(allActivePlayers()).toEqual([]);
    expect(activeSystemIndices()).toEqual([]);
  });

  it("registers the local player through the world boot path", () => {
    const p = makePlayer();
    p.sysIdx = 2;

    WorldAccess.initPlayer(p);

    expect(allActivePlayers()).toEqual([p]);
    expect(activeSystemIndices()).toEqual([2]);
  });

  it("queues industry jobs on the authoritative player only", () => {
    const p = makePlayer();
    p.ore.iron = 9;

    executeGameCommand({ type: "queueIndustryJob", payload: { recipeId: "bar", qty: 2 } }, p);

    expect(p.craftQueue).toHaveLength(1);
    expect(p.ore.iron).toBe(3);
  });

  it("executes ammo/resource/home commands against authoritative player state", () => {
    const p = makePlayer();
    p.credits = 1_000;
    p.ore.iron = 5;
    p.sysIdx = 3;
    p.homeSysIdx = 0;

    executeGameCommand({ type: "buyAmmunition", payload: { ammoType: "hybrid" } }, p);
    executeGameCommand({ type: "sellCargoResource", payload: { category: "ore", key: "iron" } }, p);
    executeGameCommand({ type: "setHomeSystem" }, p);

    expect(p.ammo.hybrid).toBeGreaterThan(0);
    expect(p.ore.iron).toBe(0);
    expect(p.homeSysIdx).toBe(3);
  });

  it("accepts validated contract proposals via authoritative command", () => {
    G.GALAXY = buildGalaxy();
    populateSystem(G.GALAXY[0]!);
    const p = makePlayer();
    p.sysIdx = 0;
    p.x = 0;
    p.y = 0;
    const station = G.GALAXY[0]?.stations?.find((s) => !s.isProcessingHub);
    if (!station) return;
    p.x = station.x;
    p.y = station.y;
    p.stationOfferStationId = station.id;
    p.stationOffers = [{
      id: "mc_test_1",
      type: "mining",
      title: "Mine Iron Ore",
      description: "Collect 10 iron",
      reward: 500,
      stationId: station.id,
      sysIdx: 0,
      objective: { type: "mining", target: "iron", required: 10, current: 0 },
      status: "available",
    }];

    executeGameCommand({
      type: "acceptContract",
      payload: { contractId: "mc_test_1" },
    }, p);

    expect(p.contracts.some((c) => c.id === "mc_test_1" && c.status === "active")).toBe(true);
  });
});
