import { describe, it, expect, beforeEach } from "vitest";
import { _G as G } from "../src/state.js";;
import { makePlayer, loadPlayer } from "../src/player/player-data.js";
import { installTestPlayer } from "../src/player-registry.js";
import { computeStats, getStats, invalidate } from "../src/player/player-stats.js";
import { MODULE_HP_MAX } from "../src/constants.js";
import { ModuleRarity } from "../src/data/moduleRarity.js";
import { ModuleInstance } from "../src/types/moduleInstance.js";

function makeTestInstance(uid: string, baseId: string): ModuleInstance {
  return { uid, baseId, rarity: ModuleRarity.Stock, itemLevel: 1, durability: 100, maxDurability: 100, affixes: [] };
}

describe("player-stats computeStats", () => {
  beforeEach(() => {
    installTestPlayer(makePlayer());
    invalidate(G.P);
  });

  it("baseline scout stats are valid", () => {
    const st = computeStats(G.P);
    expect(st.maxHp).toBeGreaterThan(0);
    expect(st.maxShield).toBeGreaterThanOrEqual(0);
    expect(st.maxEnergy).toBeGreaterThan(0);
    expect(st.maxSpeed).toBeGreaterThan(0);
    expect(st.turnRate).toBeGreaterThan(0);
    expect(st.weaponMult).toBeGreaterThan(0);
    expect(st.totalPG).toBeGreaterThan(0);
    expect(st.totalCPU).toBeGreaterThan(0);
  });

  it("fitting a weapon mult bonus increases weaponMult", () => {
    const baseline = computeStats(G.P).weaponMult;
    const inst = makeTestInstance("test-hi-link", "hi-link");
    G.P.moduleCargo.push(inst);
    G.P.fitting.high[0] = inst.uid;
    G.P.turretPower[0] = true;
    G.P.moduleHp.high[0] = MODULE_HP_MAX;
    invalidate(G.P);
    const withLink = computeStats(G.P).weaponMult;
    expect(withLink).toBeGreaterThan(baseline);
  });

  it("afterburner toggle changes thrustScale", () => {
    const inst = makeTestInstance("test-me-ab1", "me-ab1");
    G.P.moduleCargo.push(inst);
    G.P.fitting.med[0] = inst.uid;
    G.P.slotActive.med[0] = true;
    G.P.moduleHp.med[0] = MODULE_HP_MAX;
    invalidate(G.P);
    const on = computeStats(G.P);
    expect(on.thrustScale).toBeGreaterThan(0);

    G.P.slotActive.med[0] = false;
    invalidate(G.P);
    const off = computeStats(G.P);
    expect(off.thrustScale).toBeLessThan(on.thrustScale);
  });

  it("skill levels increase HP and energy", () => {
    const base = computeStats(G.P);
    // Need enough XP for engineering level 5 (3085 XP) so that
    // floor(hull * (1 + 5 * 0.025)) = floor(12 * 1.125) = 13 > 12.
    G.P.skillXp.engineering = 3085;
    invalidate(G.P);
    const skilled = computeStats(G.P);
    expect(skilled.maxHp).toBeGreaterThan(base.maxHp);
    expect(skilled.maxEnergy).toBeGreaterThanOrEqual(base.maxEnergy);
  });

  it("getStats caches result", () => {
    const a = getStats(G.P);
    const b = getStats(G.P);
    expect(a).toBe(b);
    invalidate(G.P);
    expect(getStats(G.P)).not.toBe(a);
  });

  it("mass_reduce affix lowers massMult without NaN", () => {
    const baseline = computeStats(G.P).massMult;
    const inst = makeTestInstance("test-lo-mass", "lo-nano");
    inst.affixes = [{
      id: "mass_reduce",
      name: "Mass Reduction",
      affectedStat: "structuralMassMult",
      value: -0.03,
    }];
    G.P.moduleCargo.push(inst);
    G.P.fitting.low[0] = inst.uid;
    G.P.slotActive.low[0] = true;
    G.P.moduleHp.low[0] = MODULE_HP_MAX;
    invalidate(G.P);
    const st = computeStats(G.P);
    expect(Number.isFinite(st.massMult)).toBe(true);
    expect(st.massMult).toBeLessThan(baseline);
  });
});

describe("player-data loadPlayer migrations", () => {
  beforeEach(() => {
    localStorage.removeItem("ss2-sim-v1");
  });

  it("fresh load returns makePlayer when no save", () => {
    localStorage.removeItem("ss2-sim-v1");
    const p = loadPlayer();
    expect(p.shipId).toBe("scout");
    // makePlayer now issues civilian starter modules with this uid.
    expect(p.fitting.high[0]).toBe("start-tu-civ-miner");
    expect(p.fitting.high[1]).toBe("start-tu-tractor");
    expect(p.fitting.med[0]).toBeNull();
    expect(p.fitting.low[0]).toBeNull();
    expect(p.moduleCargo.length).toBe(10);
  });

  it("migrates moduleInventory to moduleCargo", () => {
    const raw = JSON.stringify({
      shipId: "scout",
      moduleInventory: { "tu-cannon": 2, "me-ab1": 1 },
      fitting: { turret: [], high: [null, null], med: [null], low: [null] },
    });
    localStorage.setItem("ss2-sim-v1", raw);
    const p = loadPlayer();
    expect(p.moduleCargo.length).toBe(13);
    expect((p as any).moduleInventory).toBeUndefined();
  });

  it("migrates missing moduleHp arrays", () => {
    const raw = JSON.stringify({
      shipId: "scout",
      fitting: { turret: [], high: [null, null], med: [null], low: [null] },
      moduleHp: undefined,
    });
    localStorage.setItem("ss2-sim-v1", raw);
    const p = loadPlayer();
    expect(p.moduleHp).toBeDefined();
    expect(Array.isArray(p.moduleHp.turret)).toBe(true);
  });

  it("falls back to makePlayer on corrupted JSON", () => {
    localStorage.setItem("ss2-sim-v1", "not json");
    const p = loadPlayer();
    expect(p.shipId).toBe("scout");
  });

  it("derives skills from skillXp after legacy gunnery migration", () => {
    const raw = JSON.stringify({
      shipId: "scout",
      skillXp: { gunnery: 900 },
      skills: { ballistics: 0, beam_weapons: 0, missile_guidance: 0 },
      fitting: { turret: [], high: [null, null], med: [null], low: [null] },
    });
    localStorage.setItem("ss2-sim-v1", raw);
    const p = loadPlayer();
    expect(p.skills.ballistics).toBeGreaterThan(0);
    expect(p.skills.beam_weapons).toBeGreaterThan(0);
    expect(p.skills.missile_guidance).toBeGreaterThan(0);
  });
});
