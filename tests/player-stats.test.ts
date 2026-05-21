import { describe, it, expect, beforeEach } from "vitest";
import { G } from "../src/state.js";
import { makePlayer, loadPlayer } from "../src/player/player-data.js";
import { computeStats, getStats, invalidate } from "../src/player/player-stats.js";
import { MODULE_HP_MAX } from "../src/constants.js";
import { ModuleRarity } from "../src/data/moduleRarity.js";
import { ModuleInstance } from "../src/types/moduleInstance.js";

function makeTestInstance(uid: string, baseId: string): ModuleInstance {
  return { uid, baseId, rarity: ModuleRarity.Stock, itemLevel: 1, durability: 100, maxDurability: 100, affixes: [] };
}

describe("player-stats computeStats", () => {
  beforeEach(() => {
    G.P = makePlayer();
    invalidate();
  });

  it("baseline scout stats are valid", () => {
    const st = computeStats();
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
    const baseline = computeStats().weaponMult;
    const inst = makeTestInstance("test-hi-link", "hi-link");
    G.P.moduleCargo.push(inst);
    G.P.fitting.high[0] = inst.uid;
    G.P.slotActive.high[0] = true;
    G.P.moduleHp.high[0] = MODULE_HP_MAX;
    invalidate();
    const withLink = computeStats().weaponMult;
    expect(withLink).toBeGreaterThan(baseline);
  });

  it("afterburner toggle changes thrustScale", () => {
    const inst = makeTestInstance("test-me-ab1", "me-ab1");
    G.P.moduleCargo.push(inst);
    G.P.fitting.med[0] = inst.uid;
    G.P.slotActive.med[0] = true;
    G.P.moduleHp.med[0] = MODULE_HP_MAX;
    invalidate();
    const on = computeStats();
    expect(on.thrustScale).toBeGreaterThan(0);

    G.P.slotActive.med[0] = false;
    invalidate();
    const off = computeStats();
    expect(off.thrustScale).toBeLessThan(on.thrustScale);
  });

  it("skill levels increase HP and energy", () => {
    const base = computeStats();
    // Need enough XP for engineering level 5 (3085 XP) so that
    // floor(hull * (1 + 5 * 0.025)) = floor(12 * 1.125) = 13 > 12.
    G.P.skillXp.engineering = 3085;
    invalidate();
    const skilled = computeStats();
    expect(skilled.maxHp).toBeGreaterThan(base.maxHp);
    expect(skilled.maxEnergy).toBeGreaterThanOrEqual(base.maxEnergy);
  });

  it("getStats caches result", () => {
    const a = getStats();
    const b = getStats();
    expect(a).toBe(b);
    invalidate();
    expect(getStats()).not.toBe(a);
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
    expect(p.fitting.turret[0]).toBe("start-tu-civ-cannon");
    expect(p.moduleCargo.length).toBe(2);
  });

  it("migrates moduleInventory to moduleCargo", () => {
    const raw = JSON.stringify({
      shipId: "scout",
      moduleInventory: { "tu-cannon": 2, "me-ab1": 1 },
      fitting: { turret: [null, null], high: [null, null], med: [null, null, null], low: [null, null, null] },
    });
    localStorage.setItem("ss2-sim-v1", raw);
    const p = loadPlayer();
    expect(p.moduleCargo.length).toBe(3);
    expect((p as any).moduleInventory).toBeUndefined();
  });

  it("migrates missing moduleHp arrays", () => {
    const raw = JSON.stringify({
      shipId: "scout",
      fitting: { turret: [null, null], high: [null, null], med: [null, null, null], low: [null, null, null] },
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
});
