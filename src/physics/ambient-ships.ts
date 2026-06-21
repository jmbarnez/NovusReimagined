/**
 * Ambient neutral mining vessels.
 *
 * A small number of NPC miners roam the starter system, slowly flying between
 * asteroids to mine them. They arrive through gates, mine for a while, then
 * depart through a gate. No combat, no stations, no patrols — just mining.
 */
import { type Player } from "../state.js";
import { getState, WorldAccess } from "../state-access.js";
import { ENEMY_DEFS } from "../data/enemies.js";
import { randomShipName } from "../data/faction-comms.js";
import { buildEnemyFitting } from "../utils/spawn.js";
import type { Enemy } from "../types/enemy.js";
import type { Asteroid } from "../types/asteroid.js";
import type { Gate } from "../types/station.js";
import type { System } from "../types/system.js";
import { angleDiff } from "../utils/math.js";
import { harvestAsteroid, destroyAsteroidAi } from "../utils/mining.js";
import { getEnemyTurretOrigin } from "../combat/turret-origin.js";
import { asteroidSegmentPolygonHit } from "./combat-physics.js";
import { getTaskState, removeTaskState } from "./npcs/task-state.js";

/** Max concurrent ambient miners in the system. */
const MAX_MINERS = 3;

let _spawnCooldown = 5.0; // Start spawn check soon after startup
let _miningLaserHum = 0;

export function buildFactionShip(sys: System, type: string, gate: Gate, exitGateIdx: number): Enemy {
  const def = ENEMY_DEFS[type];
  const level = 1;
  const hp = def.baseHp ?? 50;
  const shield = def.shield ?? 20;
  const structure = def.baseStructure ?? 30;

  const e: Enemy = {
    id: `neut-${sys.idx}-${Math.random().toString(36).substring(2, 9)}`,
    type,
    name: randomShipName(),
    x: gate.x,
    y: gate.y,
    px: gate.x,
    py: gate.y,
    spawnX: gate.x,
    spawnY: gate.y,
    hp, maxHp: hp,
    shield, maxShield: shield,
    structure, maxStructure: structure,
    weaponMult: def.weaponMult ?? 1.0,
    vx: 0,
    vy: 0,
    angle: Math.random() * Math.PI * 2,
    prevAngle: 0,
    angularVel: 0,
    speed: def.speed ?? 100,
    credits: 0,
    loot: {},
    turretCds: [],
    alive: true,
    respawnTimer: 0,
    aggroRange: 200,
    weaponRange: def.weaponRange ?? 300,
    sigRadius: def.sigRadius ?? 30,
    accuracy: def.accuracy ?? 1.0,
    fitting: buildEnemyFitting(type, level, Math.random),
    level,
    faction: "neutral",
    hailable: true,
    commsRange: 600,
  };

  if (e.fitting.turret) {
    e.turretCds = new Array(e.fitting.turret.length).fill(0);
  }

  // Initialize task state — fly slightly away from gate, then start mining
  const ts = getTaskState(e.id);
  ts.task = "transit-in";
  ts.taskTimer = 0;
  ts.wpX = gate.x + (Math.random() - 0.5) * 120;
  ts.wpY = gate.y + (Math.random() - 0.5) * 120;
  ts.exitGateIdx = exitGateIdx;

  return e;
}

export function updateAmbientDirector(dt: number) {
  const sys = getState().GALAXY[0];
  if (!sys) return;

  // Count existing ambient miners
  let minerCount = 0;
  let transitingCount = 0;
  for (const e of sys.enemies) {
    if (e.alive && e.faction === "neutral") {
      minerCount++;
      const ts = getTaskState(e.id);
      if (ts.task === "transit-in" || ts.task === "depart") transitingCount++;
    }
  }

  _spawnCooldown -= dt;
  if (_spawnCooldown <= 0) {
    _spawnCooldown = 20.0 + Math.random() * 20.0; // Check every 20-40s

    if (minerCount < MAX_MINERS && transitingCount < 2) {
      if (sys.gates && sys.gates.length > 0) {
        const entryGateIdx = Math.floor(Math.random() * sys.gates.length);
        const exitGateIdx = Math.floor(Math.random() * sys.gates.length);
        const entryGate = sys.gates[entryGateIdx];

        const newShip = buildFactionShip(sys, "faction_miner", entryGate, exitGateIdx);
        sys.enemies.push(newShip);
        if (!sys.enemyMap) sys.enemyMap = new Map();
        sys.enemyMap.set(newShip.id, newShip);
      }
    }
  }
}

export function processAmbientBehavior(e: Enemy, dt: number) {
  const sys = getState().GALAXY[0];
  if (!sys) return;

  const ts = getTaskState(e.id);

  switch (ts.task) {
    case "transit-in": {
      // Fly slightly away from gate entry point, then start mining
      const dx = ts.wpX! - e.x;
      const dy = ts.wpY! - e.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 40) {
        ts.task = "mine";
        ts.taskTimer = 30.0 + Math.random() * 30.0; // Mine for 30-60s
        pickAsteroidTarget(e, ts);
      }
      break;
    }

    case "mine": {
      ts.taskTimer -= dt;
      if (ts.taskTimer <= 0) {
        ts.miningLaser.active = false;
        ts.task = "depart";
        setDepartWaypoint(sys, ts);
        return;
      }

      // Check mining asteroid target validity
      let asteroid: Asteroid | null = null;
      if (ts.mineTargetId) {
        asteroid = sys.asteroids.find(a => a.id === ts.mineTargetId) || null;
        if (asteroid && (asteroid.depleted || asteroid.hp <= 0)) {
          asteroid = null;
          ts.mineTargetId = undefined;
        }
      }

      if (!asteroid) {
        pickAsteroidTarget(e, ts);
        if (ts.mineTargetId) {
          asteroid = sys.asteroids.find(a => a.id === ts.mineTargetId) || null;
        }
      }

      if (asteroid) {
        const dx = asteroid.x - e.x;
        const dy = asteroid.y - e.y;
        const dist = Math.hypot(dx, dy);
        const mineRange = 250;

        if (dist > mineRange) {
          // Cruise towards asteroid
          ts.wpX = asteroid.x;
          ts.wpY = asteroid.y;
          ts.miningLaser.active = false;
        } else {
          // In range — brake and fire mining laser
          e.vx *= 0.88;
          e.vy *= 0.88;
          e.angle += angleDiff(e.angle, Math.atan2(dy, dx)) * 0.1;

          // Precise polygon surface hit for the GPU mining laser endpoint
          const origin = getEnemyTurretOrigin(e);
          const hit = asteroidSegmentPolygonHit(origin.x, origin.y, asteroid.x, asteroid.y, asteroid, 0);
          const surfaceX = hit ? hit.x : asteroid.x;
          const surfaceY = hit ? hit.y : asteroid.y;

          // Surface normal = outward direction from asteroid centre to hit point
          const ndx = surfaceX - asteroid.x;
          const ndy = surfaceY - asteroid.y;
          const nlen = Math.hypot(ndx, ndy) || 1;

          // Write mining laser state for the GPU renderer
          ts.miningLaser.active = true;
          ts.miningLaser.x1 = origin.x;
          ts.miningLaser.y1 = origin.y;
          ts.miningLaser.x2 = surfaceX;
          ts.miningLaser.y2 = surfaceY;
          ts.miningLaser.phase = (ts.miningLaser.phase || 0) + dt * 18;
          ts.miningLaser.hitNx = ndx / nlen;
          ts.miningLaser.hitNy = ndy / nlen;
          ts.miningLaser.hitR = asteroid.radius;

          if (ts.mineCd > 0) {
            ts.mineCd -= dt;
          } else {
            const result = harvestAsteroid(asteroid, 1.0);
            ts.mineCd = 0.5;
            if (result.depleted) {
              // AI-mined asteroids drop nothing for the player — no ore pickups, no XP
              destroyAsteroidAi(asteroid);
              ts.mineTargetId = undefined;
              ts.miningLaser.active = false;
              // Pick a new asteroid and keep mining
              pickAsteroidTarget(e, ts);
            }
          }

          _miningLaserHum -= dt;
          if (_miningLaserHum <= 0) {
            WorldAccess.queueEffect({
              type: "industrialBeam",
              payload: { delivery: "mining", x: asteroid.x, y: asteroid.y },
            });
            _miningLaserHum = 0.55;
          }

          // Skip standard steering — holding position to mine
          return;
        }
      } else {
        // No asteroid found — drift slowly and wait for timer to expire
        ts.miningLaser.active = false;
        e.vx *= 0.92;
        e.vy *= 0.92;
        return;
      }
      break;
    }

    case "depart": {
      const exitGate = sys.gates[ts.exitGateIdx ?? 0] || sys.gates[0];
      if (exitGate) {
        const dx = exitGate.x - e.x;
        const dy = exitGate.y - e.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 80) {
          // Warp out — despawn ship
          e.alive = false;
          sys.enemies = sys.enemies.filter(item => item.id !== e.id);
          if (sys.enemyMap) sys.enemyMap.delete(e.id);
          removeTaskState(e.id);
          return;
        } else {
          ts.wpX = exitGate.x;
          ts.wpY = exitGate.y;
        }
      } else {
        // Fallback despawn
        e.alive = false;
        sys.enemies = sys.enemies.filter(item => item.id !== e.id);
        if (sys.enemyMap) sys.enemyMap.delete(e.id);
        removeTaskState(e.id);
        return;
      }
      break;
    }
  }

  // Standard slow cruising steering towards waypoint
  if (ts.wpX !== undefined && ts.wpY !== undefined) {
    const dx = ts.wpX - e.x;
    const dy = ts.wpY - e.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 30) {
      const targetAngle = Math.atan2(dy, dx);
      e.angle += angleDiff(e.angle, targetAngle) * 0.06;
      const thrust = e.speed * 0.5; // Slow cruise
      e.vx += Math.cos(e.angle) * thrust * dt;
      e.vy += Math.sin(e.angle) * thrust * dt;
    }
  }
}

/** Find the closest non-depleted asteroid and set it as the mining target. */
function pickAsteroidTarget(e: Enemy, ts: { mineTargetId: string | undefined }) {
  const sys = getState().GALAXY[0];
  if (!sys || !sys.asteroids) return;

  let closestAst: Asteroid | null = null;
  let closestDist = Infinity;

  for (const a of sys.asteroids) {
    if (!a.depleted && a.hp > 0) {
      const dist = Math.hypot(a.x - e.x, a.y - e.y);
      if (dist < closestDist) {
        closestDist = dist;
        closestAst = a;
      }
    }
  }

  if (closestAst) {
    ts.mineTargetId = closestAst.id;
  }
}

function setDepartWaypoint(sys: System, ts: { wpX: number | undefined; wpY: number | undefined; exitGateIdx: number | undefined }) {
  const exitGate = sys.gates[ts.exitGateIdx ?? 0] || sys.gates[0];
  if (exitGate) {
    ts.wpX = exitGate.x;
    ts.wpY = exitGate.y;
  }
}
