import { Client, type Player } from "../state.js";
import type { Asteroid, Enemy, WreckPiece } from "../types/world.js";
import type { SpatialQueryResult } from "../utils/spatial.js";
import { PlayerAccess, clearNav, getState } from "../state-access.js";
import { enemyByLockId } from "../targeting.js";
import {
  ACCEL, FRICTION, ANG_FRICTION,
  PLAYER_MASS, ASTEROID_DENSITY, ENEMY_MASS,
  COLLISION_RESTITUTION, COLLISION_DMG_THRESHOLD,
  COLLISION_DMG_SCALE, COLLISION_COOLDOWN,
  RACK_TYPES,
} from "../constants.js";
import { damagePlayer } from "../combat/damage-display.js";
import { lerp, angleDiff, aimAngle, resolveElasticCollision } from "../utils/math.js";
import { getStats } from "../player/player-stats.js";
import { MODULES, MODULE_FLAGS } from "../data/modules.js";
import { SHIPS } from "../data/ships.js";
import { invalidate } from "../player/player-stats.js";
import { updateEngineSound } from "../audio/procedural.js";
import { C } from "../config/index.js";
import { activeMovementMultipliers } from "../player/abilities.js";
import type { ModuleInstance } from "../types/moduleInstance.js";
import { isHeadlessServer } from "./net-input.js";
import { emitShipExhaustSheets } from "../utils/ship-exhaust.js";
import { getIonBoostModuleState, ION_BOOST_MODULE_ID } from "../player/boost-module.js";
import { decayPlayerHitGlows } from "../player/hit-glow.js";

let _cargoMap = new Map<string, ModuleInstance>();
const EXHAUST_MIN_SPEED = 8;

export function updateShip(dt: number, _p?: Player) {
  const p = _p ?? getState().player;
  if (!p) return;
  const isLocalPresentation = p === getState().player && !isHeadlessServer();
  const inputKeys = p.inputKeys ?? (isLocalPresentation ? Client.keys : { space: false, w: false, a: false, s: false, d: false, boost: false });
  const inputMouseWorld = p.inputMouseWorld ?? (isLocalPresentation ? Client.mouseWorld : null);
  const uiBlocksInput = isLocalPresentation && (Client.stationOpen || Client.bridgeOpen || Client.settingsOpen);
  const st = getStats(p);
  if (!Number.isFinite(p.vx)) PlayerAccess.updatePhysics({ vx: 0 }, p);
  if (!Number.isFinite(p.vy)) PlayerAccess.updatePhysics({ vy: 0 }, p);
  if (!Number.isFinite(p.va)) PlayerAccess.updatePhysics({ va: 0 }, p);
  if (!Number.isFinite(p.angle)) PlayerAccess.updatePhysics({ angle: 0 }, p);
  if (!Number.isFinite(p.x)) PlayerAccess.updatePhysics({ x: 0 }, p);
  if (!Number.isFinite(p.y)) PlayerAccess.updatePhysics({ y: 0 }, p);

  // Build cargo map once per tick using a reused Map to avoid GC pressure
  _cargoMap.clear();
  if (Array.isArray(p.moduleCargo)) {
    for (let i = 0; i < p.moduleCargo.length; i++) {
      const inst = p.moduleCargo[i];
      if (inst && inst.uid) _cargoMap.set(inst.uid, inst);
    }
  }
  const cargoMap = _cargoMap;

  PlayerAccess.updatePhysics({ thrustFx: false }, p);
  PlayerAccess.updatePhysics({ boostFx: false }, p);
  const speed = Math.hypot(p.vx, p.vy);
  let ax = 0, ay = 0;
  let at = 0;
  const manualForward = !!inputKeys?.w;
  const manualReverse = !!inputKeys?.s;
  const manualLeft = !!inputKeys?.a;
  const manualRight = !!inputKeys?.d;
  const manualMove = manualForward || manualReverse || manualLeft || manualRight;

  // Autopilot: Strategic maneuvers (Orbit / Keep at Range)
  if (p.navCommand && !uiBlocksInput && !manualMove) {
    const nav = p.navCommand;
    const target = enemyByLockId(nav.targetId);
    if (!target) {
      p.navCommand = null;
      if (isLocalPresentation) clearNav();
    } else {
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      const d = Math.hypot(dx, dy);
      const targetAngle = Math.atan2(dy, dx);
      const hysteresis = 30;

      if (nav.mode === "orbit") {
        let desiredAngle = targetAngle;
        if (d > nav.rangePx + hysteresis) {
          desiredAngle = targetAngle;
        } else if (d < nav.rangePx - hysteresis) {
          desiredAngle = targetAngle + Math.PI;
        } else {
          desiredAngle = targetAngle + (Math.PI / 2) * nav.dir;
        }
        const diff = angleDiff(p.angle, desiredAngle);
        at = diff * C.PHYSICS.SHIP.turnRateMultiplier;
        ax = Math.cos(desiredAngle);
        ay = Math.sin(desiredAngle);
        PlayerAccess.updatePhysics({ thrustFx: true }, p);
      } else if (nav.mode === "keepRange") {
        // Face target so weapons stay on it
        const diff = angleDiff(p.angle, targetAngle);
        at = diff * C.PHYSICS.SHIP.turnRateMultiplier;

        if (d > nav.rangePx + hysteresis) {
          ax = Math.cos(targetAngle);
          ay = Math.sin(targetAngle);
          PlayerAccess.updatePhysics({ thrustFx: true }, p);
        } else if (d < nav.rangePx - hysteresis) {
          ax = -Math.cos(targetAngle);
          ay = -Math.sin(targetAngle);
          PlayerAccess.updatePhysics({ thrustFx: true }, p);
        } else {
          ax = 0;
          ay = 0;
          PlayerAccess.updatePhysics({ thrustFx: false }, p);
        }
      }
    }
  } else if (p.waypoint && !uiBlocksInput && !manualMove) {
    const wp = p.waypoint;
    const dx = wp.x - p.x;
    const dy = wp.y - p.y;
    const dist = Math.hypot(dx, dy);
    const wpAngle = Math.atan2(dy, dx);

    if (dist < 30) {
      p.waypoint = null;
      if (isLocalPresentation) Client.waypoint = null;
    } else {
      const diff = angleDiff(p.angle, wpAngle);
      at = diff * C.PHYSICS.SHIP.turnRateMultiplier;
      ax = Math.cos(wpAngle);
      ay = Math.sin(wpAngle);
      PlayerAccess.updatePhysics({ thrustFx: true }, p);
    }
  } else if (!uiBlocksInput && manualMove) {
    if (manualForward !== manualReverse) {
      const thrustDir = manualForward ? 1 : -1;
      ax = Math.cos(p.angle) * thrustDir;
      ay = Math.sin(p.angle) * thrustDir;
      PlayerAccess.updatePhysics({ thrustFx: true }, p);
    }
    if (manualLeft !== manualRight) {
      at = (manualRight ? 1 : -1) * C.PHYSICS.SHIP.turnRateMultiplier;
    }
  } else if (!uiBlocksInput && inputMouseWorld && (!isLocalPresentation || !Client.cursorUnlocked) && p.movementControlMode !== "direct") {
    const targetAngle = aimAngle(p.x, p.y, inputMouseWorld.x, inputMouseWorld.y);
    const diff = angleDiff(p.angle, targetAngle);
    at = diff * C.PHYSICS.SHIP.turnRateMultiplier;
  }

  const isThrusting = p.thrustFx && speed > C.PHYSICS.SHIP.minSpeedForThrust;
  const isApplyingThrust = p.thrustFx === true;

  if (inputKeys?.space) {
    PlayerAccess.updatePhysics({ vx: p.vx * C.PHYSICS.SHIP.brakeVelocityRetention, vy: p.vy * C.PHYSICS.SHIP.brakeVelocityRetention, va: p.va * C.PHYSICS.SHIP.brakeAngularRetention }, p);
  }

  let capDrained = false;
  let anyStateChanged = false;
  for (const rack of RACK_TYPES) {
    const slots = p.fitting?.[rack] || [];
    for (let i = 0; i < slots.length; i++) {
      const uid = slots[i];
      if (!uid) continue;
      const inst = cargoMap.get(uid);
      if (!inst) continue;
      const m = MODULES[inst.baseId];
      if (!m?.isActive || !m.capDrainPerSec) continue;
      if (MODULE_FLAGS.isTractor(m)) continue;
      if (!(p.slotActive?.[rack]?.[i] ?? true)) continue;
      if (inst.baseId === ION_BOOST_MODULE_ID && !isThrusting) continue;
      const drain = m.capDrainPerSec * dt;
      if (p.energy >= drain) {
        PlayerAccess.setEnergy(p.energy - drain, p);
        capDrained = true;
      } else {
        PlayerAccess.setSlotActive(rack, i, false, p);
        anyStateChanged = true;
      }
    }
  }
  if (anyStateChanged) invalidate(p);

  let mainThrust = st.mainThrust;
  const turnRate = st.turnRate;
  let drag = st.dragPerSec;
  const boostModule = getIonBoostModuleState(p, cargoMap);
  const abOn = boostModule.online;

  // Active-ability movement boosts (Overdrive, etc.)
  const mult = activeMovementMultipliers();
  let boostThrustMult = 1;
  let boostSpeedMult = 1;
  if (p.boostLockout === true) PlayerAccess.updatePhysics({ boostLockout: false }, p);

  const boostRequested = !!inputKeys?.boost && !uiBlocksInput && isApplyingThrust;
  const boostCapMult = boostModule.online ? C.PHYSICS.SHIP.boostModuleCapCostMult : 1;
  const boostDrain = C.PHYSICS.SHIP.boostCapDrainPerSec * boostCapMult * dt;
  const boostActive = boostRequested
    && p.energy >= Math.max(C.PHYSICS.SHIP.boostMinEnergyToStart, boostDrain);
  if (boostActive) {
    PlayerAccess.setEnergy(Math.max(0, p.energy - boostDrain), p);
    boostThrustMult = C.PHYSICS.SHIP.boostBaseThrustMult
      + (boostModule.online ? C.PHYSICS.SHIP.boostModuleThrustBonus : 0);
    boostSpeedMult = C.PHYSICS.SHIP.boostBaseSpeedMult
      + (boostModule.online ? C.PHYSICS.SHIP.boostModuleSpeedBonus : 0);
    PlayerAccess.updatePhysics({ boostFx: true }, p);
  }

  mainThrust *= mult.thrust * boostThrustMult;

  PlayerAccess.updatePhysics({ vx: p.vx + ax * mainThrust * dt, vy: p.vy + ay * mainThrust * dt, va: p.va + at * turnRate * dt }, p);
  // Cap to boosted max speed when an active speed multiplier is in play.
  const speedCapMult = Math.max(mult.speed, boostSpeedMult);
  if (speedCapMult > 1 && (p.gateBoostRemaining ?? 0) <= 0) {
    const cap = (st.maxSpeed || 0) * speedCapMult;
    if (cap > 0) {
      const sp = Math.hypot(p.vx, p.vy);
      if (sp > cap) { const k = cap / sp; PlayerAccess.updatePhysics({ vx: p.vx * k, vy: p.vy * k }, p); }
    }
  }
  if ((p.gateBoostRemaining ?? 0) > 0) {
    PlayerAccess.setGateBoostRemaining(Math.max(0, p.gateBoostRemaining! - dt), p);
  }

  PlayerAccess.updatePhysics({ vx: p.vx * drag, vy: p.vy * drag, va: p.va * ANG_FRICTION }, p);

  // Snap negligible velocity to zero — eliminates perpetual micro-drift
  // that the camera would chase, causing fine vibration.
  if (Math.abs(p.vx) < 0.01) PlayerAccess.updatePhysics({ vx: 0 }, p);
  if (Math.abs(p.vy) < 0.01) PlayerAccess.updatePhysics({ vy: 0 }, p);
  if (Math.abs(p.va) < 0.001) PlayerAccess.updatePhysics({ va: 0 }, p);

  PlayerAccess.updatePhysics({ px: p.x, py: p.y, prevAngle: p.angle }, p);
  PlayerAccess.updatePhysics({ x: p.x + p.vx * dt, y: p.y + p.vy * dt, angle: p.angle + p.va * dt }, p);

  const currentSpeed = Math.hypot(p.vx, p.vy);
  if (isLocalPresentation && currentSpeed > EXHAUST_MIN_SPEED) {
    emitShipExhaustSheets(p, p.x, p.y, p.angle, abOn, p.boostFx === true, 0);
  }

  if ((p._colCooldown ?? 0) > 0) PlayerAccess.setColCooldown((p._colCooldown ?? 0) - dt, p);

  resolveSolidCollisions(p);

  if (p.invincible > 0) PlayerAccess.setInvincible(p.invincible - dt, p);
  if (isLocalPresentation && (Client.combatHeat ?? 0) > 0) {
    PlayerAccess.setCombatHeat(Math.max(0, Client.combatHeat - dt * 0.25));
  }
  decayPlayerHitGlows(dt, p);

  PlayerAccess.setShield(Math.min(st.maxShield, p.shield + st.shieldRegen * dt), p);
  PlayerAccess.setEnergy(Math.min(st.maxEnergy, p.energy + st.energyRegen * dt), p);

  const slotHeat = p.slotHeat;
  if (slotHeat) {
    for (const rack of Object.keys(slotHeat)) {
      const heat = slotHeat[rack] ?? [];
      for (let i = 0; i < heat.length; i++) {
        if (heat[i] > 0) PlayerAccess.setSlotHeat(rack, i, Math.max(0, heat[i] - dt * 0.15), p);
      }
    }
  }

  const speedRatio = st.maxSpeed > 0 ? Math.min(1, speed / st.maxSpeed) : 0;
  if (isLocalPresentation) updateEngineSound(isThrusting, speedRatio, abOn || p.boostFx === true);
}

const _colHits: SpatialQueryResult<unknown>[] = [];

function resolveSolidCollisions(p: Player) {
  const grid = getState().spatialGrid;
  if (!grid) return;
  const playerR = SHIPS[p.shipId]?.colRadius ?? 20;

  _colHits.length = 0;
  grid.query(p.x, p.y, playerR, null, _colHits);

  for (let i = 0; i < _colHits.length; i++) {
    const h = _colHits[i];
    if (h.type === "player" || h.type === "station") continue;
    if (h.dist < 0.001) continue;

    const overlap = playerR + h.radius - h.dist;
    if (overlap <= 0) continue;

    const nx = h.dx / h.dist;
    const ny = h.dy / h.dist;

    if (h.type === "asteroid") {
      const ast = h.data as Asteroid;
      if (!ast) continue;
      const mA = ast.radius * ast.radius * ASTEROID_DENSITY;
      const closing = resolveElasticCollision(p, ast, PLAYER_MASS, mA, h.dx, h.dy, h.dist, playerR + h.radius, COLLISION_RESTITUTION);

      if (closing > COLLISION_DMG_THRESHOLD && (p._colCooldown || 0) <= 0) {
        const dmg = (closing - COLLISION_DMG_THRESHOLD) * COLLISION_DMG_SCALE;
        damagePlayer(dmg, ast.x, ast.y, {}, p);
        PlayerAccess.setColCooldown(COLLISION_COOLDOWN, p);
      }

    } else if (h.type === "enemy") {
      const en = h.data as Enemy;
      if (!en) continue;
      const closing = resolveElasticCollision(p, en, PLAYER_MASS, ENEMY_MASS, h.dx, h.dy, h.dist, playerR + h.radius, COLLISION_RESTITUTION);

      if (closing > COLLISION_DMG_THRESHOLD && (p._colCooldown || 0) <= 0) {
        const dmg = (closing - COLLISION_DMG_THRESHOLD) * COLLISION_DMG_SCALE * 0.5;
        damagePlayer(dmg, en.x, en.y, {}, p);
        PlayerAccess.setColCooldown(COLLISION_COOLDOWN, p);
      }

    } else if (h.type === "wreckpiece") {
      const piece = h.data as WreckPiece;
      if (!piece || piece.hp <= 0) continue;
      // Piece mass proportional to radius^2 (flat debris slab approximation).
      const pieceMass = piece.radius * piece.radius * 0.8;
      const closing = resolveElasticCollision(p, piece, PLAYER_MASS, pieceMass, h.dx, h.dy, h.dist, playerR + h.radius, COLLISION_RESTITUTION);

      if (closing > COLLISION_DMG_THRESHOLD && (p._colCooldown || 0) <= 0) {
        const dmg = (closing - COLLISION_DMG_THRESHOLD) * COLLISION_DMG_SCALE * 0.4;
        damagePlayer(dmg, piece.x, piece.y, {}, p);
        PlayerAccess.setColCooldown(COLLISION_COOLDOWN, p);
      }
    }
  }
}
