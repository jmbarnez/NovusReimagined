import { type Player } from "../state.js";
import { getState, WorldAccess } from "../state-access.js";
import { C } from "../config/index.js";
import { ENEMY_DEFS } from "../data/enemies.js";
import { randomShipName, randomHailLine } from "../data/faction-comms.js";
import { addBeam } from "../utils/entities.js";
import { buildEnemyFitting } from "../utils/spawn.js";
import type { Enemy } from "../types/enemy.js";
import type { Asteroid } from "../types/asteroid.js";
import type { Gate, Station } from "../types/station.js";
import type { System } from "../types/system.js";
import { liveEnemies, liveAsteroids } from "../utils/game.js";
import { angleDiff, rayCircleSurfaceHit } from "../utils/math.js";
import { getEnemyTurretOrigin } from "../combat/turret-origin.js";
import { SHIPS } from "../data/ships.js";
import { isHostile } from "../combat/factions.js";
import { pickHostileTarget } from "./npc-ai.js";
import { fireTurretsAt } from "../combat/enemy-turrets.js";
import { getAiState } from "./npcs/ai-state.js";
import { getTaskState, removeTaskState } from "./npcs/task-state.js";

let _spawnCooldown = 5.0; // Start spawn check soon after startup

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

  // Initialize task state for the new ambient ship
  const ts = getTaskState(e.id);
  ts.task = "transit-in";
  ts.taskTimer = 0;
  ts.wpX = gate.x + (Math.random() - 0.5) * 120;
  ts.wpY = gate.y + (Math.random() - 0.5) * 120;
  ts.exitGateIdx = exitGateIdx;

  return e;
}

export function updateAmbientDirector(dt: number) {
  const sys = getState().GALAXY[0]; // Gated to starter system (sys-0)
  if (!sys) return;

  // Count existing ambient neutral ships
  let transitingCount = 0;
  let activityCount = 0;
  let totalNeutralCount = 0;

  for (const e of sys.enemies) {
    if (e.alive && e.faction === "neutral") {
      totalNeutralCount++;
      const ts = getTaskState(e.id);
      if (ts.task === "transit-in" || ts.task === "depart") {
        transitingCount++;
      } else {
        activityCount++;
      }
    }
  }

  // Handle spawn timers and check population bounds
  _spawnCooldown -= dt;
  if (_spawnCooldown <= 0) {
    _spawnCooldown = 15.0 + Math.random() * 15.0; // Check every 15-30s

    if (totalNeutralCount < 4 && transitingCount < 2 && activityCount < 2) {
      if (sys.gates && sys.gates.length > 0) {
        const entryGateIdx = Math.floor(Math.random() * sys.gates.length);
        const exitGateIdx = Math.floor(Math.random() * sys.gates.length);
        const entryGate = sys.gates[entryGateIdx];

        const types = ["faction_hauler", "faction_miner", "faction_escort", "faction_scout"];
        const chosenType = types[Math.floor(Math.random() * types.length)];

        const newShip = buildFactionShip(sys, chosenType, entryGate, exitGateIdx);
        sys.enemies.push(newShip);
        
        if (!sys._enemyMap) sys._enemyMap = new Map();
        sys._enemyMap.set(newShip.id, newShip);
      }
    }
  }
}

let _miningLaserHum = 0;

export function processAmbientBehavior(e: Enemy, dt: number) {
  const sys = getState().GALAXY[0];
  if (!sys) return;

  const ts = getTaskState(e.id);

  // 1. Scan for hostiles nearby to trigger alert or combat
  const detectionRange = e.aggroRange || 300;
  let closestHostile: Enemy | Player | null = null;
  let closestHostileDist = Infinity;

  for (const oe of sys.enemies) {
    if (oe.alive && isHostile(e.faction, oe.faction)) {
      const dist = Math.hypot(oe.x - e.x, oe.y - e.y);
      if (dist < closestHostileDist) {
        closestHostileDist = dist;
        closestHostile = oe;
      }
    }
  }

  // Check player if player is hostile (typically friendly to neutrals)
  if (getState().player.hp > 0 && isHostile(e.faction, "player")) {
    const dist = Math.hypot(getState().player.x - e.x, getState().player.y - e.y);
    if (dist < closestHostileDist) {
      closestHostileDist = dist;
      closestHostile = getState().player;
    }
  }

  const isCombatShip = e.type === "faction_escort" || e.type === "faction_scout";

  if (closestHostile && closestHostileDist < detectionRange) {
    if (isCombatShip) {
      // Combat ships engage the hostile
      if (ts.task !== "engage") {
        ts.task = "engage";
        const ai = getAiState(e.id);
        ai._npcTarget = closestHostile;
        ai._npcLockTimer = 0;
        ai._npcHasLock = false;
      }
    } else {
      // Non-combat ships flee and immediately head to depart
      if (ts.task !== "depart") {
        ts.task = "depart";
        const exitGate = sys.gates[ts.exitGateIdx ?? 0] || sys.gates[0];
        if (exitGate) {
          ts.wpX = exitGate.x;
          ts.wpY = exitGate.y;
        }
      }
    }
  }

  // 3. FSM State updates
  switch (ts.task) {
    case "transit-in": {
      // Ship has spawned and is flying slightly away from gate entry point
      const dx = ts.wpX! - e.x;
      const dy = ts.wpY! - e.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 40) {
        // Transition to primary task depending on ship type
        if (e.type === "faction_hauler") {
          ts.task = "goto-station";
          const station = sys.stations[0];
          if (station) {
            ts.wpX = station.x;
            ts.wpY = station.y;
          } else {
            ts.task = "patrol";
            pickRandomPatrolWp(ts);
          }
        } else if (e.type === "faction_miner") {
          ts.task = "mine";
          ts.taskTimer = 25.0 + Math.random() * 15.0; // Mine for 25-40s
          pickAsteroidTarget(e, ts);
        } else {
          // Patrol for combat/scout types
          ts.task = "patrol";
          ts.taskTimer = 30.0 + Math.random() * 20.0;
          pickRandomPatrolWp(ts);
        }
      }
      break;
    }

    case "goto-station": {
      const station = sys.stations[0];
      if (station) {
        const dx = station.x - e.x;
        const dy = station.y - e.y;
        const dist = Math.hypot(dx, dy);
        const dockLimit = station.radius + 80;
        if (dist < dockLimit) {
          ts.task = "dwell";
          ts.taskTimer = 10.0 + Math.random() * 10.0; // Stay docked for 10-20s
          e.vx = 0;
          e.vy = 0;
        } else {
          ts.wpX = station.x;
          ts.wpY = station.y;
        }
      } else {
        ts.task = "patrol";
        pickRandomPatrolWp(ts);
      }
      break;
    }

    case "dwell": {
      // Just wait at station
      ts.taskTimer -= dt;
      e.vx *= 0.9;
      e.vy *= 0.9;
      if (ts.taskTimer <= 0) {
        ts.task = "depart";
        const exitGate = sys.gates[ts.exitGateIdx ?? 0] || sys.gates[0];
        if (exitGate) {
          ts.wpX = exitGate.x;
          ts.wpY = exitGate.y;
        }
      }
      return; // Skip standard movement steering
    }

    case "mine": {
      ts.taskTimer -= dt;
      if (ts.taskTimer <= 0) {
        ts.task = "depart";
        const exitGate = sys.gates[ts.exitGateIdx ?? 0] || sys.gates[0];
        if (exitGate) {
          ts.wpX = exitGate.x;
          ts.wpY = exitGate.y;
        }
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
          // Move towards asteroid
          ts.wpX = asteroid.x;
          ts.wpY = asteroid.y;
        } else {
          // Slow down and fire mining beam!
          e.vx *= 0.95;
          e.vy *= 0.95;
          e.angle += angleDiff(e.angle, Math.atan2(dy, dx)) * 0.1;

          // Industrial mining beam visual effect
          const origin = getEnemyTurretOrigin(e);
          const surface = rayCircleSurfaceHit(origin.x, origin.y, asteroid.x, asteroid.y, asteroid.radius);
          addBeam({
            x1: origin.x,
            y1: origin.y,
            x2: surface.x,
            y2: surface.y,
            color: "#00ffcc",
            width: 3.0,
            life: 0.5,
          });

          _miningLaserHum -= dt;
          if (_miningLaserHum <= 0) {
            WorldAccess.queueEffect({
              type: "industrialBeam",
              payload: { delivery: "mining", x: asteroid.x, y: asteroid.y },
            });
            _miningLaserHum = 0.55;
          }
        }
      } else {
        // No asteroid left to mine, transition to patrol
        ts.task = "patrol";
        ts.taskTimer = 15.0;
        pickRandomPatrolWp(ts);
      }
      break;
    }

    case "patrol": {
      ts.taskTimer -= dt;
      const dx = ts.wpX! - e.x;
      const dy = ts.wpY! - e.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 50 || ts.taskTimer <= 0) {
        if (ts.taskTimer <= 0) {
          ts.task = "depart";
          const exitGate = sys.gates[ts.exitGateIdx ?? 0] || sys.gates[0];
          if (exitGate) {
            ts.wpX = exitGate.x;
            ts.wpY = exitGate.y;
          }
        } else {
          pickRandomPatrolWp(ts);
        }
      }
      break;
    }

    case "engage": {
      const ai = getAiState(e.id);
      let combatTarget = ai._npcTarget;
      if (combatTarget) {
        if ((combatTarget as unknown) === getState().player) {
          if (getState().player.hp <= 0) combatTarget = null;
        } else {
          if (!(combatTarget as Enemy).alive) combatTarget = null;
        }
      }

      if (!combatTarget) {
        ts.task = "patrol";
        ts.taskTimer = 20.0;
        ai._npcTarget = null;
        pickRandomPatrolWp(ts);
        return;
      }

      const dist = Math.hypot(combatTarget.x - e.x, combatTarget.y - e.y);
      if (dist > detectionRange * 1.5) {
        // Lost target due to distance
        ts.task = "patrol";
        ts.taskTimer = 20.0;
        ai._npcTarget = null;
        pickRandomPatrolWp(ts);
        return;
      }

      // Aim, lock and fire at target usingGeneralized combat helpers
      const shipDef = SHIPS[e.type] ?? SHIPS["scout"];
      const lockTimeRequired = Math.max(
        C.ENEMIES.AI.LOCK_ON.minTime,
        C.ENEMIES.AI.LOCK_ON.baseTime - (shipDef.lockBonusTicks || 0) * C.ENEMIES.AI.LOCK_ON.perBonusTickReduction
      );

      ai._npcLockTimer = ai._npcLockTimer + dt;
      if (ai._npcLockTimer >= lockTimeRequired) {
        ai._npcHasLock = true;
      }

      const targetAngle = Math.atan2(combatTarget.y - e.y, combatTarget.x - e.x);
      e.angle += angleDiff(e.angle, targetAngle) * 0.1;

      // Move toward combat range
      const stopDistance = e.weaponRange ?? 200;
      if (dist > stopDistance) {
        e.vx += Math.cos(e.angle) * e.speed * 0.9 * dt;
        e.vy += Math.sin(e.angle) * e.speed * 0.9 * dt;
      }

      if (ai._npcHasLock) {
        fireTurretsAt(e, combatTarget, dt, detectionRange);
      }
      return; // Handled movement/combat completely
    }

    case "depart": {
      const exitGate = sys.gates[ts.exitGateIdx ?? 0] || sys.gates[0];
      if (exitGate) {
        const dx = exitGate.x - e.x;
        const dy = exitGate.y - e.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 80) {
          // Warp out! Despawn ship
          e.alive = false;
          // Filter out of enemies
          sys.enemies = sys.enemies.filter(item => item.id !== e.id);
          if (sys._enemyMap) sys._enemyMap.delete(e.id);
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
        if (sys._enemyMap) sys._enemyMap.delete(e.id);
        removeTaskState(e.id);
        return;
      }
      break;
    }
  }

  // 4. Standard steering towards waypoint (wpX, wpY)
  if (ts.wpX !== undefined && ts.wpY !== undefined) {
    const dx = ts.wpX - e.x;
    const dy = ts.wpY - e.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 30) {
      const targetAngle = Math.atan2(dy, dx);
      e.angle += angleDiff(e.angle, targetAngle) * 0.08;
      const thrust = e.speed * 0.8;
      e.vx += Math.cos(e.angle) * thrust * dt;
      e.vy += Math.sin(e.angle) * thrust * dt;
    }
  }
}

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

function pickRandomPatrolWp(ts: { wpX: number | undefined; wpY: number | undefined }) {
  const sys = getState().GALAXY[0];
  if (!sys) return;

  // Pick a random spot between station and gates
  const station = sys.stations[0];
  const sx = station ? station.x : 0;
  const sy = station ? station.y : 0;

  const ang = Math.random() * Math.PI * 2;
  const dist = 300 + Math.random() * 800;

  ts.wpX = sx + Math.cos(ang) * dist;
  ts.wpY = sy + Math.sin(ang) * dist;
}
