import { describe, it, expect, beforeEach } from "vitest";
import { _G as G } from "../src/state.js";;
import { makePlayer } from "../src/player/player-data.js";
import { installTestPlayer } from "../src/player-registry.js";
import { normalizeProfile, applyResists, computeHitQuality } from "../src/combat.js";
import { damageEnemy } from "../src/combat/damage-enemy.js";
import { fireMissile } from "../src/combat/missile.js";
import { computeScaledWeaponProfile } from "../src/player/player-stats.js";
import { MODULES } from "../src/data/modules.js";
import { SHIPS } from "../src/data/ships.js";
import { WEAPON_PROFILES } from "../src/data/weaponProfiles.js";
import type { Enemy } from "../src/types/world.js";

const noResist = { em: 0, therm: 0, kin: 0, exp: 0 };

describe("normalizeProfile", () => {
  it("splits a relative profile into fractions summing to 1", () => {
    const f = normalizeProfile({ em: 6, therm: 6 })!;
    expect(f.em).toBeCloseTo(0.5);
    expect(f.therm).toBeCloseTo(0.5);
    expect(f.kin).toBe(0);
    expect(f.em + f.therm + f.kin + f.exp).toBeCloseTo(1);
  });
  it("returns null for missing or empty profiles", () => {
    expect(normalizeProfile(undefined)).toBeNull();
    expect(normalizeProfile({})).toBeNull();
  });
});

describe("applyResists", () => {
  it("mitigates by the matching resist fraction", () => {
    expect(applyResists(100, { kin: 1 }, { ...noResist, kin: 0.5 })).toBeCloseTo(50);
  });
  it("passes through when there is no profile or no resists", () => {
    expect(applyResists(100, undefined, { ...noResist, kin: 0.5 })).toBe(100);
    expect(applyResists(100, { kin: 1 }, undefined)).toBe(100);
  });
  it("clamps resist to the configured max", () => {
    // resist 0.99 clamps to 0.85 → 15% gets through
    expect(applyResists(100, { em: 1 }, { ...noResist, em: 0.99 })).toBeCloseTo(15);
  });
  it("blends mixed damage types against mixed resists", () => {
    // 50% em (0 resist) + 50% kin (0.4 resist) → 0.5*1 + 0.5*0.6 = 0.8
    expect(applyResists(100, { em: 1, kin: 1 }, { ...noResist, kin: 0.4 })).toBeCloseTo(80);
  });
});

describe("computeScaledWeaponProfile optimal/falloff", () => {
  const ship = SHIPS["scout"];
  it("splits range into optimal + falloff for a profiled weapon", () => {
    const p = computeScaledWeaponProfile("tu-ion", MODULES["tu-ion"], ship);
    expect(p.optimalPx!).toBeGreaterThan(0);
    expect(p.optimalPx!).toBeLessThan(p.range);
    // range ≈ optimal + edgeFalloffs(2) × falloff
    expect(Math.abs(p.optimalPx! + 2 * p.falloffPx! - p.range)).toBeLessThanOrEqual(4);
  });
  it("falls back to optimalPx == range for a profileless weapon", () => {
    const p = computeScaledWeaponProfile("default", null, ship);
    expect(p.optimalPx).toBe(p.range);
  });
});

describe("computeHitQuality", () => {
  beforeEach(() => {
    installTestPlayer(makePlayer());
    G.P.x = 0; G.P.y = 0; G.P.vx = 0; G.P.vy = 0;
  });

  const ship = SHIPS["scout"];
  const mod = MODULES["tu-ion"];
  const wProf = computeScaledWeaponProfile("tu-ion", mod, ship);
  const enemyAt = (x: number, opts: Partial<Enemy> = {}): Enemy =>
    ({ x, y: 0, vx: 0, vy: 0, sigRadius: 30, ...opts } as Enemy);

  it("is ~1 for a stationary target inside optimal", () => {
    const q = computeHitQuality(enemyAt(wProf.optimalPx!), mod, wProf, G.P);
    expect(q).toBeGreaterThan(0.95);
  });
  it("halves roughly one falloff band past optimal (no transversal)", () => {
    const q = computeHitQuality(enemyAt(wProf.optimalPx! + wProf.falloffPx!), mod, wProf, G.P);
    expect(q).toBeGreaterThan(0.4);
    expect(q).toBeLessThan(0.6);
  });
  it("drops when the target has transversal velocity", () => {
    const still = computeHitQuality(enemyAt(wProf.optimalPx!), mod, wProf, G.P);
    const moving = computeHitQuality(enemyAt(wProf.optimalPx!, { vy: 300 }), mod, wProf, G.P);
    expect(moving).toBeLessThan(still);
  });
  it("is more forgiving against a larger signature", () => {
    const small = computeHitQuality(enemyAt(wProf.optimalPx!, { vy: 300, sigRadius: 20 }), mod, wProf, G.P);
    const big = computeHitQuality(enemyAt(wProf.optimalPx!, { vy: 300, sigRadius: 80 }), mod, wProf, G.P);
    expect(big).toBeGreaterThan(small);
  });

  it("uses the passed player position instead of the local singleton", () => {
    const remote = makePlayer();
    remote.x = 1000;
    remote.y = 0;
    const q = computeHitQuality(enemyAt(remote.x + wProf.optimalPx!), mod, wProf, remote);
    expect(q).toBeGreaterThan(0.95);
  });
});

describe("server-side weapon ownership", () => {
  beforeEach(() => {
    installTestPlayer(makePlayer());
    G.bullets = [];
  });

  it("does not credit player participation when damage has no player owner", () => {
    const enemy = { hp: 100, maxHp: 100, x: 0, y: 0, resists: noResist } as Enemy;
    damageEnemy(enemy, 5, 0, 0, undefined, "projectile");
    expect(enemy._lastHitByPlayer).toBeUndefined();
    expect(enemy._lastPlayerHitAt).toBeUndefined();
  });

  it("assigns fired missiles to the explicit firing player", () => {
    const remote = makePlayer();
    const mod = MODULES["tu-missile"];
    fireMissile(0, 0, 0, WEAPON_PROFILES["tu-missile"], 10, mod, null, 0, remote);
    expect(G.bullets[0]?.owner).toBe(remote);
  });
});
