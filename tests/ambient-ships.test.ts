import { describe, it, expect, beforeEach } from "vitest";
import { _G as G } from "../src/state.js";
import { makePlayer } from "../src/player/player-data.js";
import { installTestPlayer } from "../src/player-registry.js";
import { buildGalaxy, populateSystem } from "../src/world-gen.js";
import { clearSimulationEntities } from "../src/utils/entities.js";
import { buildFactionShip, processAmbientBehavior, updateAmbientDirector } from "../src/physics/ambient-ships.js";
import { getTaskState } from "../src/physics/npcs/task-state.js";
import { getAiState } from "../src/physics/npcs/ai-state.js";
import { applySnapshotToG } from "../src/net/snapshot-apply.js";
import type { Asteroid } from "../src/types/asteroid.js";
import type { Enemy } from "../src/types/enemy.js";

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

function addHostileNear(x: number, y: number): Enemy {
  const sys = G.GALAXY[0]!;
  const enemy: Enemy = {
    id: `hostile-${sys.enemies.length}`,
    type: "rat",
    name: "Rat",
    x,
    y,
    px: x,
    py: y,
    spawnX: x,
    spawnY: y,
    hp: 50,
    maxHp: 50,
    shield: 0,
    maxShield: 0,
    structure: 30,
    maxStructure: 30,
    weaponMult: 1,
    vx: 0,
    vy: 0,
    angle: 0,
    prevAngle: 0,
    angularVel: 0,
    speed: 100,
    credits: 0,
    loot: {},
    turretCds: [],
    alive: true,
    respawnTimer: 0,
    aggroRange: 200,
    weaponRange: 300,
    sigRadius: 20,
    accuracy: 1,
    fitting: { turret: [], high: [], med: [], low: [] },
    level: 1,
    faction: "hostile",
    hailable: false,
    commsRange: 0,
  };
  sys.enemies.push(enemy);
  if (!sys.enemyMap) sys.enemyMap = new Map();
  sys.enemyMap.set(enemy.id, enemy);
  return enemy;
}

describe("ambient ships", () => {
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

  it("miner creates a mining beam when in range of an asteroid", () => {
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

    G.beams.length = 0;
    processAmbientBehavior(miner, 0.016);

    expect(G.beams.length).toBeGreaterThan(0);
    expect(G.beams[0]!.color).toBe("#00ffcc");
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

    for (let i = 0; i < 120; i++) {
      processAmbientBehavior(miner, 0.016);
    }

    expect(asteroid.hp).toBeLessThan(initialHp);
  });

  it("escort fires at nearby hostile", () => {
    const sys = G.GALAXY[0]!;
    const hostile = addHostileNear(100, 0);
    const gate = sys.gates[0]!;
    const escort = buildFactionShip(sys, "faction_escort", gate, 0);
    escort.x = 0;
    escort.y = 0;
    sys.enemies.push(escort);
    if (!sys.enemyMap) sys.enemyMap = new Map();
    sys.enemyMap.set(escort.id, escort);

    const ts = getTaskState(escort.id);
    ts.task = "engage";
    const ai = getAiState(escort.id);
    ai.npcTarget = hostile;
    ai.npcHasLock = true;

    G.enemyBullets.length = 0;
    processAmbientBehavior(escort, 0.016);

    expect(G.enemyBullets.length).toBeGreaterThan(0);
  });

  it("scout beam weapon adds a combat beam", () => {
    const sys = G.GALAXY[0]!;
    const hostile = addHostileNear(100, 0);
    const gate = sys.gates[0]!;
    const scout = buildFactionShip(sys, "faction_scout", gate, 0);
    scout.x = 0;
    scout.y = 0;
    sys.enemies.push(scout);
    if (!sys.enemyMap) sys.enemyMap = new Map();
    sys.enemyMap.set(scout.id, scout);

    const ts = getTaskState(scout.id);
    ts.task = "engage";
    const ai = getAiState(scout.id);
    ai.npcTarget = hostile;
    ai.npcHasLock = true;

    G.beams.length = 0;
    processAmbientBehavior(scout, 0.016);

    expect(G.beams.length).toBeGreaterThan(0);
  });

  it("syncs ambient mining beams via snapshots", () => {
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
