import { describe, expect, it } from "vitest";
import { executeGameCommand } from "../src/sim/commands.js";
import { makePlayer } from "../src/player/player-data.js";
import { _G as G } from "../src/state.js";;
import { WorldAccess } from "../src/state-access.js";
import { allActivePlayers, activeSystemIndices } from "../src/utils/game.js";
import { buildGalaxy, populateSystem } from "../src/world-gen.js";
import { updateWarp } from "../src/docking/index.js";

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

  it("accepts turret modules in unified high slots but rejects incompatible rack fits", () => {
    const p = makePlayer();
    p.fitting.high[0] = null;

    executeGameCommand({ type: "fitModule", payload: { rack: "high", slotIdx: 0, instanceId: "start-tu-civ-cannon" } }, p);
    expect(p.fitting.high[0]).toBe("start-tu-civ-cannon");

    executeGameCommand({ type: "fitModule", payload: { rack: "med", slotIdx: 0, instanceId: "start-hi-comms" } }, p);
    expect(p.fitting.med[0]).toBeNull();
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

  it("starts and completes warp from an authoritative gate crossing", () => {
    G.GALAXY = buildGalaxy();
    populateSystem(G.GALAXY[0]!);
    const p = makePlayer();
    p.tutorial.active = false;
    p.sysIdx = 0;
    WorldAccess.initPlayer(p);
    const gate = G.GALAXY[0]?.gates.find((entry) => entry.targetSysIdx != null);
    expect(gate).toBeTruthy();
    if (!gate || gate.targetSysIdx == null) return;

    executeGameCommand({ type: "warp", payload: { targetIdx: gate.targetSysIdx } }, p);
    expect(p.warpTargetIdx).toBe(gate.targetSysIdx);
    expect(p.warpCooldown).toBeGreaterThan(0);

    updateWarp(999);
    expect(p.sysIdx).toBe(gate.targetSysIdx);
    expect(p.warpTargetIdx).toBe(-1);
    expect(p.warpCooldown).toBeGreaterThan(0);
  });

  it("queues industry jobs on the authoritative player only", () => {
    const p = makePlayer();
    p.bulkMaterialsCargo = [{
      id: "bulk-1",
      materialId: "ferro_nickel_stock",
      alloyFamilyId: "ferro_nickel_stock",
      kind: "alloy",
      label: "Ferro-nickel stock",
      volumeM3: 1.2,
      massKg: 9_780,
      composition: { iron: 0.66, nickel: 0.24, carbon: 0.1 },
    }];
    p.loot.scrap = 4;

    executeGameCommand({ type: "queueIndustryJob", payload: { recipeId: "gear", qty: 2 } }, p);

    expect(p.craftQueue).toHaveLength(1);
    expect((p.bulkMaterialsCargo[0]?.volumeM3 ?? 0)).toBeCloseTo(0, 3);
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

  it("validates dock commands against nearby station range", () => {
    G.GALAXY = buildGalaxy();
    populateSystem(G.GALAXY[0]!);
    const p = makePlayer();
    p.sysIdx = 0;
    const station = G.GALAXY[0]?.stations?.find((s) => !s.isProcessingHub);
    if (!station) return;

    p.x = station.x + station.radius * 4;
    p.y = station.y;
    executeGameCommand({ type: "dock", payload: { stationId: station.id } }, p);
    expect(p.stationOfferStationId).toBeNull();

    p.x = station.x;
    p.y = station.y;
    executeGameCommand({ type: "dock", payload: { stationId: station.id } }, p);
    expect(p.stationOfferStationId).toBe(station.id);
    expect(p.invincible).toBeGreaterThan(0);
  });

  it("turns in complete contracts from authoritative station state", () => {
    G.GALAXY = buildGalaxy();
    populateSystem(G.GALAXY[0]!);
    const p = makePlayer();
    p.sysIdx = 0;
    p.credits = 100;
    const station = G.GALAXY[0]?.stations?.find((s) => !s.isProcessingHub);
    if (!station) return;

    p.x = station.x;
    p.y = station.y;
    p.stationOfferStationId = station.id;
    p.contracts = [{
      id: "mc_complete_1",
      type: "mining",
      title: "Mine Iron Ore",
      description: "Collect 10 iron",
      reward: 500,
      stationId: station.id,
      sysIdx: 0,
      objective: { type: "mining", target: "iron", required: 10, current: 10 },
      status: "complete",
    }];

    executeGameCommand({ type: "turnInContract", payload: { contractId: "mc_complete_1" } }, p);

    expect(p.credits).toBe(600);
    expect(p.contracts).toHaveLength(0);
  });

  it("skipTutorial does not double-warp when already in target system", () => {
    G.GALAXY = buildGalaxy();
    populateSystem(G.GALAXY[0]!);
    const p = makePlayer();
    p.sysIdx = 1; // already in Novus Prime
    p.homeSysIdx = 0;
    p.tutorial.active = true;
    p.tutorial.completed = false;
    p.tutorial.skipped = false;

    executeGameCommand({ type: "skipTutorial", payload: { primeIdx: 1 } }, p);

    expect(p.tutorial.active).toBe(false);
    expect(p.tutorial.completed).toBe(true);
    expect(p.tutorial.skipped).toBe(true);
    expect(p.homeSysIdx).toBe(1);
    // warpTo sets invincible = 2.0; if it was skipped, invincible stays at 0
    expect(p.invincible).toBe(0);
  });
});
