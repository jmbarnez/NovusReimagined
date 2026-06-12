import { describe, it, expect, beforeEach } from "vitest";
import { _G as G } from "../src/state.js";
import {
  clearSimulationEntities,
  addBullet,
  addEnemyBullet,
  addParticle,
  _getBulletPoolSize,
  _getEnemyBulletPoolSize,
  _getParticlePoolSize,
} from "../src/utils/entities.js";

describe("entity lifecycle", () => {
  beforeEach(() => {
    clearSimulationEntities();
  });

  it("clearSimulationEntities empties all arrays", () => {
    addBullet({ x: 0, y: 0, px: 0, py: 0, vx: 1, vy: 0, life: 1, dmg: 1, color: "#fff", sz: 1, trail: null, owner: null, kind: null, weaponId: null });
    expect(G.bullets.length).toBe(1);
    clearSimulationEntities();
    expect(G.bullets.length).toBe(0);
  });

  it("addBullet generates unique ids", () => {
    addBullet({ x: 0, y: 0, px: 0, py: 0, vx: 1, vy: 0, life: 1, dmg: 1, color: "#fff", sz: 1, trail: null, owner: null, kind: null, weaponId: null });
    addBullet({ x: 0, y: 0, px: 0, py: 0, vx: 1, vy: 0, life: 1, dmg: 1, color: "#fff", sz: 1, trail: null, owner: null, kind: null, weaponId: null });
    expect(G.bullets[0].id).not.toBe(G.bullets[1].id);
  });

  it("addBullet reuses pooled objects after clearSimulationEntities", () => {
    addBullet({ x: 0, y: 0, px: 0, py: 0, vx: 1, vy: 0, life: 1, dmg: 1, color: "#fff", sz: 1, trail: null, owner: null, kind: null, weaponId: null });
    const firstRef = G.bullets[0];
    expect(firstRef).toBeDefined();

    clearSimulationEntities();
    const poolSizeAfterClear = _getBulletPoolSize();
    expect(poolSizeAfterClear).toBeGreaterThanOrEqual(1);

    addBullet({ x: 0, y: 0, px: 0, py: 0, vx: 1, vy: 0, life: 1, dmg: 1, color: "#fff", sz: 1, trail: null, owner: null, kind: null, weaponId: null });
    const secondRef = G.bullets[0];
    expect(secondRef).toBe(firstRef); // same object reference reused from pool
  });

  it("pooled bullet resets optional fields to prevent stale values", () => {
    addBullet({
      x: 0, y: 0, px: 0, py: 0, vx: 1, vy: 0, life: 1, dmg: 1,
      color: "#fff", sz: 1, trail: null, owner: null, kind: null, weaponId: null,
      targetId: "rat-1", homingTurnRate: 2.5, accel: 1.0, maxSpeed: 300,
    });
    const first = G.bullets[0];
    expect(first.targetId).toBe("rat-1");
    expect(first.homingTurnRate).toBe(2.5);
    expect(first.accel).toBe(1.0);
    expect(first.maxSpeed).toBe(300);

    clearSimulationEntities();
    addBullet({
      x: 0, y: 0, px: 0, py: 0, vx: 1, vy: 0, life: 1, dmg: 1,
      color: "#fff", sz: 1, trail: null, owner: null, kind: null, weaponId: null,
      // no optional fields this time
    });
    const second = G.bullets[0];
    expect(second.targetId).toBeNull();
    expect(second.homingTurnRate).toBeUndefined();
    expect(second.accel).toBeUndefined();
    expect(second.maxSpeed).toBeUndefined();
  });

  it("enemy bullet pool reuse works after clearSimulationEntities", () => {
    addEnemyBullet({ x: 0, y: 0, px: 0, py: 0, vx: 1, vy: 0, life: 1, dmg: 1, color: "#fff", sz: 2, trail: null });
    const firstRef = G.enemyBullets[0];
    clearSimulationEntities();
    expect(_getEnemyBulletPoolSize()).toBeGreaterThanOrEqual(1);
    addEnemyBullet({ x: 0, y: 0, px: 0, py: 0, vx: 1, vy: 0, life: 1, dmg: 1, color: "#fff", sz: 2, trail: null });
    expect(G.enemyBullets[0]).toBe(firstRef);
  });

  it("particle pool reuse works after clearSimulationEntities", () => {
    addParticle({ x: 0, y: 0, color: "#fff", vx: 1, vy: 0, r: 3, life: 1, drag: 0.9, decay: 1 });
    const firstRef = G.particles[0];
    clearSimulationEntities();
    expect(_getParticlePoolSize()).toBeGreaterThanOrEqual(1);
    addParticle({ x: 0, y: 0, color: "#fff" });
    expect(G.particles[0]).toBe(firstRef);
  });
});
