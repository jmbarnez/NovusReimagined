import { describe, it, expect, beforeEach } from "vitest";
import { _G as G } from "../src/state.js";
import { makePlayer } from "../src/player/player-data.js";
import { installTestPlayer } from "../src/player-registry.js";
import { buildGalaxy, populateSystem } from "../src/world-gen.js";
import { clearSimulationEntities } from "../src/utils/entities.js";
import { buildFactionShip, processAmbientBehavior, updateAmbientDirector } from "../src/physics/ambient-ships.js";
import { getTaskState } from "../src/physics/npcs/task-state.js";
import { applySnapshotToG } from "../src/net/snapshot-apply.js";
import type { Asteroid } from "../src/types/asteroid.js";

function addAsteroidNear(x: number, y: number): Asteroid {
  const sys = G.GALAXY[0]!;
  const asteroid: Asteroid = {
    id: `ast-${sys.asteroids.length}`,
    x,
    y,
    vx: 0,
    vy: 0,
    px: x,
    py: y,
    radius: 20,
    hp: 100,
    maxHp: 100,
    depleted: false,
    respawnTimer: 0,
    composition: { veldspar: 1 },
    richness: 1,
    shape: [],
    shapeMax: 1,
    spinAngle: 0,
    spinVel: 0,
    prevSpin: 0,
    tintHue: 30,
    tintSat: 13,
  };
  sys.asteroids.push(asteroid);
  return asteroid;
}

describe("ambient mining vessels", () => {
  beforeEach(() => {
    G.GALAXY = buildGalaxy();
    populateSystem(G.GALAXY[0]!);
    installTestPlayer(makePlayer());
    G.P.x = 0;
    G.P.y = 0;
    G.P.hp = 100;
    G.P.sysIdx = 0;
    clearSimulationEntities();
  });

  it("miner activates mining laser when in range of an asteroid", () => {
    const sys = G.GALAXY[0]!;
    const asteroid = addAsteroidNear(100, 0);
    const gate = sys.gates[0]!;
    const miner = buildFactionShip(sys, "faction_miner", gate, 0);
    miner.x = 100;
    miner.y = 0;
    sys.enemies.push(miner);
    if (!sys.enemyMap) sys.enemyMap = new Map();
    sys.enemyMap.set(miner.id, miner);

    const ts = getTaskState(miner.id);
    ts.task = "mine";
    ts.taskTimer = 30;
    ts.mineTargetId = asteroid.id;

    processAmbientBehavior(miner, 0.016);

    expect(ts.miningLaser.active).toBe(true);
    expect(ts.miningLaser.hitR).toBe(asteroid.radius);
    // Beam endpoint should be near the asteroid surface, not at its center
    const beamLen = Math.hypot(ts.miningLaser.x2 - ts.miningLaser.x1, ts.miningLaser.y2 - ts.miningLaser.y1);
    expect(beamLen).toBeLessThan(100); // ship is at (100,0), asteroid at (100,0) — very close
  });

  it("miner damages asteroid while mining", () => {
    const sys = G.GALAXY[0]!;
    const asteroid = addAsteroidNear(100, 0);
    const gate = sys.gates[0]!;
    const miner = buildFactionShip(sys, "faction_miner", gate, 0);
    miner.x = 100;
    miner.y = 0;
    sys.enemies.push(miner);
    if (!sys.enemyMap) sys.enemyMap = new Map();
    sys.enemyMap.set(miner.id, miner);

    const ts = getTaskState(miner.id);
    ts.task = "mine";
    ts.taskTimer = 30;
    ts.mineTargetId = asteroid.id;

    const initialHp = asteroid.hp;

    // With miningMult=1.0 and 0.5s cd, ~6 dmg/hit → depletes 100hp in ~8s (~530 ticks)
    for (let i = 0; i < 600; i++) {
      processAmbientBehavior(miner, 0.016);
    }

    expect(asteroid.hp).toBeLessThan(initialHp);
    expect(asteroid.hp).toBeLessThanOrEqual(0);
    expect(asteroid.depleted).toBe(true);
  });

  it("AI-mined asteroids drop no ore pickups for the player", () => {
    const sys = G.GALAXY[0]!;
    const asteroid = addAsteroidNear(100, 0);
    const gate = sys.gates[0]!;
    const miner = buildFactionShip(sys, "faction_miner", gate, 0);
    miner.x = 100;
    miner.y = 0;
    sys.enemies.push(miner);
    if (!sys.enemyMap) sys.enemyMap = new Map();
    sys.enemyMap.set(miner.id, miner);

    const ts = getTaskState(miner.id);
    ts.task = "mine";
    ts.taskTimer = 30;
    ts.mineTargetId = asteroid.id;

    const salvageBefore = G.salvagePickups?.length ?? 0;

    // Run until depleted (~600 ticks at 0.016 = ~10s)
    for (let i = 0; i < 600; i++) {
      processAmbientBehavior(miner, 0.016);
    }

    expect(asteroid.depleted).toBe(true);
    // No ore pickups should have been spawned for the player
    expect(G.salvagePickups?.length ?? 0).toBe(salvageBefore);
  });

  it("miner picks a new asteroid after depleting one", () => {
    const sys = G.GALAXY[0]!;
    const asteroid1 = addAsteroidNear(100, 0);
    const asteroid2 = addAsteroidNear(200, 0);
    const gate = sys.gates[0]!;
    const miner = buildFactionShip(sys, "faction_miner", gate, 0);
    miner.x = 100;
    miner.y = 0;
    sys.enemies.push(miner);
    if (!sys.enemyMap) sys.enemyMap = new Map();
    sys.enemyMap.set(miner.id, miner);

    const ts = getTaskState(miner.id);
    ts.task = "mine";
    ts.taskTimer = 60; // Long enough to mine both
    ts.mineTargetId = asteroid1.id;

    // Mine first asteroid to depletion
    for (let i = 0; i < 600; i++) {
      processAmbientBehavior(miner, 0.016);
    }

    expect(asteroid1.depleted).toBe(true);
    // Miner should have picked a new target
    expect(ts.mineTargetId).toBe(asteroid2.id);
    expect(ts.task).toBe("mine");
  });

  it("miner departs when task timer expires", () => {
    const sys = G.GALAXY[0]!;
    const gate = sys.gates[0]!;
    const miner = buildFactionShip(sys, "faction_miner", gate, 0);
    miner.x = 100;
    miner.y = 0;
    sys.enemies.push(miner);
    if (!sys.enemyMap) sys.enemyMap = new Map();
    sys.enemyMap.set(miner.id, miner);

    const ts = getTaskState(miner.id);
    ts.task = "mine";
    ts.taskTimer = 0.01; // Expire almost immediately
    ts.mineTargetId = undefined; // No asteroid

    processAmbientBehavior(miner, 0.016);

    expect(ts.task).toBe("depart");
    expect(ts.miningLaser.active).toBe(false);
  });

  it("director spawns at most 3 miners", () => {
    const sys = G.GALAXY[0]!;
    // Pre-populate with 3 miners
    for (let i = 0; i < 3; i++) {
      const gate = sys.gates[0]!;
      const miner = buildFactionShip(sys, "faction_miner", gate, 0);
      miner.x = 100 + i * 50;
      sys.enemies.push(miner);
      if (!sys.enemyMap) sys.enemyMap = new Map();
      sys.enemyMap.set(miner.id, miner);
      const ts = getTaskState(miner.id);
      ts.task = "mine"; // Not transiting
    }

    const countBefore = sys.enemies.filter(e => e.faction === "neutral").length;
    updateAmbientDirector(100); // Large dt to trigger spawn check
    const countAfter = sys.enemies.filter(e => e.faction === "neutral").length;

    expect(countAfter).toBe(countBefore); // No new spawn
  });

  it("syncs beams via snapshots", () => {
    G.beams.length = 0;
    const snap = {
      tick: 1,
      player: {
        netId: G.P.netId,
        x: G.P.x, y: G.P.y, vx: 0, vy: 0, va: 0, angle: 0,
        hp: G.P.hp, maxHp: G.P.maxHp,
        shield: G.P.shield, maxShield: G.P.maxShield ?? 100,
        energy: G.P.energy, maxEnergy: 100,
        boostLockout: false,
        credits: G.P.credits,
        sysIdx: G.P.sysIdx,
      },
      entities: [
        {
          id: 1,
          type: "beam" as const,
          x: 0, y: 0, vx: 100, vy: 0,
          x1: 0, y1: 0, x2: 100, y2: 0,
          color: "#00ffcc", width: 3, life: 0.5,
        },
      ],
    };

    applySnapshotToG(snap, true);

    expect(G.beams.length).toBe(1);
    expect(G.beams[0]!.color).toBe("#00ffcc");
    expect(G.beams[0]!.x1).toBe(0);
    expect(G.beams[0]!.x2).toBe(100);
  });
});
