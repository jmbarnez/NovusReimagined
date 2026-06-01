import { describe, it, expect, beforeEach } from "vitest";
import { _G as G } from "../src/state.js";;
import { makePlayer } from "../src/player/player-data.js";
import { installTestPlayer } from "../src/player-registry.js";
import {
  turretModuleAcceptsTarget,
  isAsteroidTarget,
  isWreckPieceTarget,
  requestSensorLock,
  selectLockTarget,
  assignModuleSlotToTarget,
  getPassiveScanRangePx,
  getSensorContactRangePx,
  updateSensorLocks,
} from "../src/targeting.js";
import { SHIPS } from "../src/data/ships.js";
import { MODULES } from "../src/data/modules.js";
import { toggleSlotDefaultAction } from "../src/player/player-fitting.js";
import { respawnPlayer } from "../src/utils/game.js";
import { buildGalaxy, populateSystem } from "../src/world-gen.js";
import { getStats } from "../src/player/player-stats.js";
import { C } from "../src/config/index.js";
import { executeGameCommand } from "../src/sim/commands.js";

describe("turretModuleAcceptsTarget", () => {
  it("weapon turrets accept enemy locks only", () => {
    const cannon = MODULES["tu-civilian-cannon"];
    expect(turretModuleAcceptsTarget(cannon, "rat-1")).toBe(true);
    expect(turretModuleAcceptsTarget(cannon, "ast-1")).toBe(false);
    expect(turretModuleAcceptsTarget(cannon, "piece-1")).toBe(false);
  });

  it("mining turrets accept asteroid locks only", () => {
    const miner = MODULES["tu-civilian-miner"];
    expect(turretModuleAcceptsTarget(miner, "ast-1")).toBe(true);
    expect(turretModuleAcceptsTarget(miner, "rat-1")).toBe(false);
  });

  it("salvagers accept wreck piece locks only", () => {
    const salv = Object.values(MODULES).find((m) => m.isSalvager);
    expect(salv).toBeTruthy();
    if (!salv) return;
    expect(turretModuleAcceptsTarget(salv, "piece-1")).toBe(true);
    expect(turretModuleAcceptsTarget(salv, "ast-1")).toBe(false);
  });
});

describe("target id helpers", () => {
  it("classifies asteroid and wreck ids", () => {
    expect(isAsteroidTarget("ast-42")).toBe(true);
    expect(isWreckPieceTarget("piece-7")).toBe(true);
    expect(isAsteroidTarget("piece-7")).toBe(false);
  });
});

describe("passive scan range", () => {
  it("uses hull passive km, not active sensor contact range", () => {
    const scout = SHIPS.scout;
    const passive = getPassiveScanRangePx(scout);
    const activeContact = getSensorContactRangePx(scout);
    const ifUsedActiveSensor = 2900 * ((scout.sensorContactRangeKm ?? 72) / 72);
    expect(passive).toBeCloseTo(2900 * (54 / 72), 5);
    expect(passive).not.toBeCloseTo(ifUsedActiveSensor, 1);
    expect(passive).toBeGreaterThan(activeContact);
  });
});

describe("lock re-click assignment", () => {
  beforeEach(() => {
    installTestPlayer(makePlayer());
    G.P.lockQueue = [];
    G.P.targetLock = null;
    G.P._assignTargetId = null;
  });

  it("requestSensorLock on new target does not enter assignment mode", () => {
    requestSensorLock("ast-1", G.P);
    expect(G.P.lockQueue[0]?.id).toBe("ast-1");
    expect(G.P._assignTargetId).toBeNull();
  });

  it("requestSensorLock on existing lock enters assignment mode", () => {
    G.P.lockQueue = [{ id: "ast-1", resolving: false, acc: 1 }];
    G.P.targetLock = { id: "ast-1", x: 0, y: 0, hp: 100 };
    requestSensorLock("ast-1", G.P);
    expect(G.P._assignTargetId).toBe("ast-1");
  });

  it("requestSensorLock on unresolved lock leaves it resolving without entering assignment mode", () => {
    G.P.lockQueue = [{ id: "ast-1", resolving: true, acc: 0.2 }];
    requestSensorLock("ast-1", G.P);
    expect(G.P.lockQueue[0]?.resolving).toBe(true);
    expect(G.P.lockQueue[0]?.acc).toBe(0.2);
    expect(G.P._assignTargetId).toBeNull();
  });

  it("requestSensorLock on existing lock toggles assignment mode off", () => {
    G.P.lockQueue = [{ id: "ast-1", resolving: false, acc: 1 }];
    G.P._assignTargetId = "ast-1";
    requestSensorLock("ast-1", G.P);
    expect(G.P._assignTargetId).toBeNull();
  });

  it("requestSensorLock promotes re-selected lock to front of queue", () => {
    G.P.lockQueue = [
      { id: "rat-1", resolving: false, acc: 1 },
      { id: "ast-1", resolving: false, acc: 1 },
    ];
    requestSensorLock("ast-1", G.P);
    expect(G.P.lockQueue[0]?.id).toBe("ast-1");
    expect(G.P._assignTargetId).toBe("ast-1");
  });

  it("selectLockTarget toggles assignment mode", () => {
    G.P.lockQueue = [{ id: "rat-1", resolving: false, acc: 1 }];
    selectLockTarget("rat-1", G.P);
    expect(G.P._assignTargetId).toBe("rat-1");
    selectLockTarget("rat-1", G.P);
    expect(G.P._assignTargetId).toBeNull();
  });

  it("assignModuleSlotToTarget accepts null to clear an existing turret target", () => {
    G.P.turretTargets[0] = "rat-1";
    expect(assignModuleSlotToTarget(0, null, G.P, { silent: true })).toBe(true);
    expect(G.P.turretTargets[0]).toBeNull();
  });
});

describe("server-side slot power", () => {
  it("toggles a non-local player's fitted hardpoint using that player's cargo", () => {
    const local = installTestPlayer(makePlayer());
    local.moduleCargo = [];

    const remote = makePlayer();
    expect(remote.turretPower[0]).toBe(false);

    toggleSlotDefaultAction("high", 0, remote);

    expect(remote.turretPower[0]).toBe(true);
    expect(remote.turretPowerCd[0]).toBeGreaterThan(0);
  });

  it("preserves high-slot hardpoint power arrays after respawn", () => {
    const local = installTestPlayer(makePlayer());
    G.GALAXY = buildGalaxy();
    populateSystem(G.GALAXY[0]!);

    respawnPlayer(local);

    expect(local.turretPower).toHaveLength(local.fitting.high.length);
    expect(local.turretPowerCd).toHaveLength(local.fitting.high.length);
  });
});

describe("target resolution", () => {
  beforeEach(() => {
    installTestPlayer(makePlayer());
    G.GALAXY = buildGalaxy();
    populateSystem(G.GALAXY[0]!);
  });

  it("keeps asteroid locks when the runtime asteroid map is missing", () => {
    const sys = G.GALAXY[0]!;
    const asteroid = sys.asteroids[0]!;
    G.P.x = asteroid.x;
    G.P.y = asteroid.y;
    G.P.lockQueue = [{ id: asteroid.id, resolving: true, acc: 0 }];
    sys._asteroidMap = undefined;

    updateSensorLocks(0.1, getStats(G.P), G.P);

    expect(G.P.lockQueue[0]?.id).toBe(asteroid.id);
    const refreshedMap = sys._asteroidMap as Map<string, typeof asteroid> | undefined;
    expect(refreshedMap?.get(asteroid.id)).toBe(asteroid);
  });
});

describe("sensor lock range gating", () => {
  beforeEach(() => {
    installTestPlayer(makePlayer());
    G.GALAXY = buildGalaxy();
    populateSystem(G.GALAXY[0]!);
    G.P.lockQueue = [];
  });

  it("rejects lock requests beyond drop range to prevent blink", () => {
    const sys = G.GALAXY[0]!;
    const enemy = sys.enemies[0]!;
    sys._enemyMap = new Map();
    sys._enemyMap.set(enemy.id, enemy);

    const ship = SHIPS[G.P.shipId];
    const dropRange = getSensorContactRangePx(ship) * C.TARGETING.SENSOR.dropRangeMultiplier;

    enemy.x = dropRange + 500;
    enemy.y = 0;
    G.P.x = 0;
    G.P.y = 0;

    requestSensorLock(enemy.id, G.P, { suppressFrameAction: true });

    expect(G.P.lockQueue.length).toBe(0);
  });
});

describe("sensor lock command path", () => {
  beforeEach(() => {
    installTestPlayer(makePlayer());
    G.GALAXY = buildGalaxy();
    populateSystem(G.GALAXY[0]!);
    G.P.lockQueue = [];
    G.P.targetLock = null;
    G.P._assignTargetId = null;
  });

  it("executeGameCommand requestSensorLock adds target to queue", () => {
    const sys = G.GALAXY[0]!;
    const enemy = sys.enemies[0]!;
    sys._enemyMap = new Map();
    sys._enemyMap.set(enemy.id, enemy);

    G.P.x = enemy.x;
    G.P.y = enemy.y;

    executeGameCommand({ type: "requestSensorLock", payload: { id: enemy.id } }, G.P);

    expect(G.P.lockQueue.length).toBe(1);
    expect(G.P.lockQueue[0]?.id).toBe(enemy.id);
    expect(G.P.lockQueue[0]?.resolving).toBe(true);
  });

  it("executeGameCommand selectLockTarget sets assignment id", () => {
    G.P.lockQueue = [{ id: "rat-1", resolving: false, acc: 1 }];
    executeGameCommand({ type: "selectLockTarget", payload: { id: "rat-1" } }, G.P);
    expect(G.P._assignTargetId).toBe("rat-1");
  });

  it("executeGameCommand selectLockTarget toggles assignment off when already assigned", () => {
    G.P.lockQueue = [{ id: "rat-1", resolving: false, acc: 1 }];
    G.P._assignTargetId = "rat-1";
    executeGameCommand({ type: "selectLockTarget", payload: { id: "rat-1" } }, G.P);
    expect(G.P._assignTargetId).toBeNull();
  });

  it("executeGameCommand removeSensorLock drops target from queue", () => {
    G.P.lockQueue = [{ id: "rat-1", resolving: false, acc: 1 }];
    executeGameCommand({ type: "removeSensorLock", payload: { id: "rat-1" } }, G.P);
    expect(G.P.lockQueue.length).toBe(0);
  });

  it("assignModuleSlotToTarget resolves the player's hardpoint rack instead of legacy turret slots", () => {
    const sys = G.GALAXY[0]!;
    const enemy = sys.enemies[0]!;
    sys._enemyMap = new Map();
    sys._enemyMap.set(enemy.id, enemy);

    G.P.x = enemy.x;
    G.P.y = enemy.y;
    G.P.fitting.high[0] = "start-tu-civ-cannon";
    G.P.lockQueue = [{ id: enemy.id, resolving: false, acc: 1 }];

    expect(assignModuleSlotToTarget(0, enemy.id, G.P, { silent: true })).toBe(true);
    expect(G.P.turretTargets[0]).toBe(enemy.id);
  });
});
