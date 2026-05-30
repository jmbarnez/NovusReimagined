import { describe, it, expect, beforeEach } from "vitest";
import { _G as G } from "../src/state.js";;
import { clearSimulationEntities, addBullet } from "../src/utils/entities.js";

describe("entity lifecycle", () => {
  beforeEach(() => {
    G.bullets = [];
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
});
