import { describe, it, expect, beforeEach } from "vitest";
import { _G as G } from "../src/state.js";
import { makePlayer } from "../src/player/player-data.js";
import { installTestPlayer } from "../src/player-registry.js";
import { buildGalaxy, populateSystem } from "../src/world-gen.js";
import { clearSimulationEntities, addBullet, addEnemyBullet } from "../src/utils/entities.js";
import { updateEnemyBullets } from "../src/physics/npcs/combat.js";
import { updateProjectiles } from "../src/physics/combat-physics.js";
import { SpatialGrid } from "../src/utils/spatial.js";
import { WorldAccess } from "../src/state-access.js";
import type { Enemy } from "../src/types/enemy.js";

describe("bullet spawn immunity", () => {
  beforeEach(() => {
    G.GALAXY = buildGalaxy();
    populateSystem(G.GALAXY[0]!);
    installTestPlayer(makePlayer());
    G.P.x = 0;
    G.P.y = 0;
    G.P.sysIdx = 0;
    G.P.hp = 100;
    G.P.shield = 0;
    clearSimulationEntities();
    WorldAccess.setSpatialGrid(new SpatialGrid(128));
  });

  it("addBullet initializes age to 0", () => {
    addBullet({ x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, life: 1, dmg: 1, color: "#fff", sz: 1, trail: null, owner: null, kind: null, weaponId: null });
    expect(G.bullets[0]!.age).toBe(0);
  });

  it("addEnemyBullet initializes age to 0", () => {
    addEnemyBullet({ x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, life: 1, dmg: 1, color: "#fff", sz: 2, trail: null });
    expect(G.enemyBullets[0]!.age).toBe(0);
  });

  it("player bullet survives first tick even when spawned inside a target", () => {
    // Insert a hostile enemy into the spatial grid so the bullet can hit it
    const enemy: Enemy = {
      id: "test-enemy",
      type: "rat",
      name: "Test Rat",
      x: 0,
      y: 0,
      px: 0,
      py: 0,
      spawnX: 0,
      spawnY: 0,
      hp: 1000,
      maxHp: 1000,
      vx: 0,
      vy: 0,
      angle: 0,
      prevAngle: 0,
      speed: 0,
      credits: 0,
      loot: {},
      alive: true,
      respawnTimer: 0,
      aggroRange: 0,
      sigRadius: 20,
      fitting: {},
      turretCds: [],
      faction: "hostile",
    } as Enemy;
    G.spatialGrid!.insert("test-enemy", 0, 0, 20, "enemy", enemy);

    // Spawn a player-owned bullet directly on top of the enemy
    addBullet({
      x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0,
      life: 1, dmg: 10, color: "#f00", sz: 2, trail: null,
      owner: G.P, kind: "projectile", weaponId: null,
    });

    expect(G.bullets).toHaveLength(1);

    // First tick — bullet should NOT be removed despite overlapping the enemy
    updateProjectiles(0.016);

    expect(G.bullets).toHaveLength(1);
    expect(G.bullets[0]!.age).toBe(1);
  });

  it("enemy bullet survives first tick even when spawned inside a target", () => {
    const enemy: Enemy = {
      id: "test-enemy",
      type: "rat",
      name: "Test Rat",
      x: 0,
      y: 0,
      px: 0,
      py: 0,
      spawnX: 0,
      spawnY: 0,
      hp: 1000,
      maxHp: 1000,
      vx: 0,
      vy: 0,
      angle: 0,
      prevAngle: 0,
      speed: 0,
      credits: 0,
      loot: {},
      alive: true,
      respawnTimer: 0,
      aggroRange: 0,
      sigRadius: 20,
      fitting: {},
      turretCds: [],
      faction: "hostile",
    } as Enemy;
    G.spatialGrid!.insert("test-enemy", 0, 0, 20, "enemy", enemy);

    addEnemyBullet({
      x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0,
      life: 1, dmg: 10, color: "#f00", sz: 2, trail: null,
      ownerFaction: "player", ownerId: "player-1",
    });

    expect(G.enemyBullets).toHaveLength(1);

    // First tick — bullet should NOT be removed despite overlapping the enemy
    updateEnemyBullets(0.016, 0);

    expect(G.enemyBullets).toHaveLength(1);
    expect(G.enemyBullets[0]!.age).toBe(1);
  });

  it("enemy bullet is removed on second tick when still inside target", () => {
    const enemy: Enemy = {
      id: "test-enemy",
      type: "rat",
      name: "Test Rat",
      x: 0,
      y: 0,
      px: 0,
      py: 0,
      spawnX: 0,
      spawnY: 0,
      hp: 1000,
      maxHp: 1000,
      vx: 0,
      vy: 0,
      angle: 0,
      prevAngle: 0,
      speed: 0,
      credits: 0,
      loot: {},
      alive: true,
      respawnTimer: 0,
      aggroRange: 0,
      sigRadius: 20,
      fitting: {},
      turretCds: [],
      faction: "hostile",
    } as Enemy;
    G.spatialGrid!.insert("test-enemy", 0, 0, 20, "enemy", enemy);

    addEnemyBullet({
      x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0,
      life: 1, dmg: 10, color: "#f00", sz: 2, trail: null,
      ownerFaction: "player", ownerId: "player-1",
    });

    // First tick — survives
    updateEnemyBullets(0.016, 0);
    expect(G.enemyBullets).toHaveLength(1);

    // Second tick — collision resolves and bullet is removed
    updateEnemyBullets(0.016, 0);
    expect(G.enemyBullets).toHaveLength(0);
  });
});
