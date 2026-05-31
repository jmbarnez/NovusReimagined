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
import { addTrailSegment } from "../utils/entities.js";
import { C } from "../config/index.js";
import { activeMovementMultipliers } from "../player/abilities.js";
import type { ModuleInstance } from "../types/moduleInstance.js";

let _cargoMap = new Map<string, ModuleInstance>();

export function updateShip(dt: number, _p?: Player) {
  const st = getStats();
  if (!Number.isFinite(getState().player.vx)) PlayerAccess.updatePhysics({ vx: 0 });
  if (!Number.isFinite(getState().player.vy)) PlayerAccess.updatePhysics({ vy: 0 });
  if (!Number.isFinite(getState().player.va)) PlayerAccess.updatePhysics({ va: 0 });
  if (!Number.isFinite(getState().player.angle)) PlayerAccess.updatePhysics({ angle: 0 });
  if (!Number.isFinite(getState().player.x)) PlayerAccess.updatePhysics({ x: 0 });
  if (!Number.isFinite(getState().player.y)) PlayerAccess.updatePhysics({ y: 0 });

  // Build cargo map once per tick using a reused Map to avoid GC pressure
  _cargoMap.clear();
  if (Array.isArray(getState().player.moduleCargo)) {
    for (let i = 0; i < getState().player.moduleCargo.length; i++) {
      const inst = getState().player.moduleCargo[i];
      if (inst && inst.uid) _cargoMap.set(inst.uid, inst);
    }
  }
  const cargoMap = _cargoMap;

  PlayerAccess.updatePhysics({ thrustFx: false });
  const speed = Math.hypot(getState().player.vx, getState().player.vy);
  let ax = 0, ay = 0;
  let at = 0;

  // Autopilot: Strategic maneuvers (Orbit / Keep at Range)
  if (Client.navCommand && !Client.stationOpen && !Client.bridgeOpen && !Client.settingsOpen) {
    const nav = Client.navCommand;
    const target = enemyByLockId(nav.targetId);
    if (!target) {
      clearNav();
    } else {
      const dx = target.x - getState().player.x;
      const dy = target.y - getState().player.y;
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
        const diff = angleDiff(getState().player.angle, desiredAngle);
        at = diff * C.PHYSICS.SHIP.turnRateMultiplier;
        ax = Math.cos(desiredAngle);
        ay = Math.sin(desiredAngle);
        PlayerAccess.updatePhysics({ thrustFx: true });
      } else if (nav.mode === "keepRange") {
        // Face target so weapons stay on it
        const diff = angleDiff(getState().player.angle, targetAngle);
        at = diff * C.PHYSICS.SHIP.turnRateMultiplier;

        if (d > nav.rangePx + hysteresis) {
          ax = Math.cos(targetAngle);
          ay = Math.sin(targetAngle);
          PlayerAccess.updatePhysics({ thrustFx: true });
        } else if (d < nav.rangePx - hysteresis) {
          ax = -Math.cos(targetAngle);
          ay = -Math.sin(targetAngle);
          PlayerAccess.updatePhysics({ thrustFx: true });
        } else {
          ax = 0;
          ay = 0;
          PlayerAccess.updatePhysics({ thrustFx: false });
        }
      }
    }
  } else if (Client.waypoint && !Client.stationOpen && !Client.bridgeOpen && !Client.settingsOpen) {
    const wp = Client.waypoint;
    const dx = wp.x - getState().player.x;
    const dy = wp.y - getState().player.y;
    const dist = Math.hypot(dx, dy);
    const wpAngle = Math.atan2(dy, dx);

    if (dist < 30) {
      Client.waypoint = null;
    } else {
      const diff = angleDiff(getState().player.angle, wpAngle);
      at = diff * C.PHYSICS.SHIP.turnRateMultiplier;
      ax = Math.cos(wpAngle);
      ay = Math.sin(wpAngle);
      PlayerAccess.updatePhysics({ thrustFx: true });
    }
  } else if (!Client.stationOpen && !Client.bridgeOpen && !Client.settingsOpen && !Client.cursorUnlocked) {
    const targetAngle = aimAngle(getState().player.x, getState().player.y, Client.mouseWorld.x, Client.mouseWorld.y);
    const diff = angleDiff(getState().player.angle, targetAngle);
    at = diff * C.PHYSICS.SHIP.turnRateMultiplier;
  }

  const isThrusting = getState().player.thrustFx && speed > C.PHYSICS.SHIP.minSpeedForThrust;

  if (Client.keys[" "]) {
    PlayerAccess.updatePhysics({ vx: getState().player.vx * C.PHYSICS.SHIP.brakeVelocityRetention, vy: getState().player.vy * C.PHYSICS.SHIP.brakeVelocityRetention, va: getState().player.va * C.PHYSICS.SHIP.brakeAngularRetention });
  }

  let capDrained = false;
  let anyStateChanged = false;
  for (const rack of RACK_TYPES) {
    const slots = getState().player.fitting?.[rack] || [];
    for (let i = 0; i < slots.length; i++) {
      const uid = slots[i];
      if (!uid) continue;
      const inst = cargoMap.get(uid);
      if (!inst) continue;
      const m = MODULES[inst.baseId];
      if (!m?.isActive || !m.capDrainPerSec) continue;
      if (MODULE_FLAGS.isTractor(m)) continue;
      if (!(getState().player.slotActive?.[rack]?.[i] ?? true)) continue;
      if (inst.baseId === "me-ab1" && !isThrusting) continue;
      const drain = m.capDrainPerSec * dt;
      if (getState().player.energy >= drain) {
        PlayerAccess.setEnergy(getState().player.energy - drain);
        capDrained = true;
      } else {
        PlayerAccess.setSlotActive(rack, i, false);
        anyStateChanged = true;
      }
    }
  }
  if (anyStateChanged) invalidate();

  let thrustScale = st.thrustScale;
  let turnRate = st.turnRate;
  let mainThrust = st.mainThrust;
  let drag = st.dragPerSec;
  const medSlots = getState().player.fitting?.med || [];
  const abUid = medSlots.find(uid => {
    if (!uid) return false;
    const inst = cargoMap.get(uid);
    return inst?.baseId === "me-ab1";
  });
  const abIdx = abUid ? medSlots.indexOf(abUid) : -1;
  const abActive = abIdx >= 0 && !!(getState().player.slotActive?.med?.[abIdx] ?? true);
  const abOn = abIdx >= 0 && abActive;
  if (abIdx >= 0 && !abActive) {
    thrustScale = st.baseThrustScale ?? st.thrustScale;
    turnRate = st.baseTurnRate ?? st.turnRate;
    // Derive base main thrust without the afterburner thrustScale multiplier
    mainThrust = st.mainThrust * ((st.baseThrustScale || 1) / (st.thrustScale || 1));
  }

  // Active-ability movement boosts (Overdrive, etc.)
  const mult = activeMovementMultipliers();
  mainThrust *= mult.thrust;

  PlayerAccess.updatePhysics({ vx: getState().player.vx + ax * mainThrust * dt, vy: getState().player.vy + ay * mainThrust * dt, va: getState().player.va + at * turnRate * dt });
  // Cap to ability-boosted max speed when an active speed multiplier is in play.
  if (mult.speed > 1) {
    const cap = (st.maxSpeed || 0) * mult.speed;
    if (cap > 0) {
      const sp = Math.hypot(getState().player.vx, getState().player.vy);
      if (sp > cap) { const k = cap / sp; PlayerAccess.updatePhysics({ vx: getState().player.vx * k, vy: getState().player.vy * k }); }
    }
  }

  PlayerAccess.updatePhysics({ vx: getState().player.vx * drag, vy: getState().player.vy * drag, va: getState().player.va * ANG_FRICTION });

  // Snap negligible velocity to zero — eliminates perpetual micro-drift
  // that the camera would chase, causing fine vibration.
  if (Math.abs(getState().player.vx) < 0.01) PlayerAccess.updatePhysics({ vx: 0 });
  if (Math.abs(getState().player.vy) < 0.01) PlayerAccess.updatePhysics({ vy: 0 });
  if (Math.abs(getState().player.va) < 0.001) PlayerAccess.updatePhysics({ va: 0 });

  PlayerAccess.updatePhysics({ px: getState().player.x, py: getState().player.y, prevAngle: getState().player.angle });
  PlayerAccess.updatePhysics({ x: getState().player.x + getState().player.vx * dt, y: getState().player.y + getState().player.vy * dt, angle: getState().player.angle + getState().player.va * dt });

  const currentSpeed = Math.hypot(getState().player.vx, getState().player.vy);
  if (currentSpeed > 8) {
    const cos = Math.cos(getState().player.angle);
    const sin = Math.sin(getState().player.angle);
    const rearDist = C.PHYSICS.SHIP.thrustTrailRearDist;
    const wx = getState().player.x - cos * rearDist;
    const wy = getState().player.y - sin * rearDist;

    addTrailSegment({
      x: wx,
      y: wy,
      color: abOn ? C.PHYSICS.SHIP.thrustTrailABColor : C.PHYSICS.SHIP.thrustTrailNormalColor,
      width: abOn ? C.PHYSICS.SHIP.thrustTrailABWidth : C.PHYSICS.SHIP.thrustTrailNormalWidth,
      life: C.PHYSICS.SHIP.thrustTrailLife,
      angle: getState().player.angle,
    });
  }

  if ((getState().player._colCooldown ?? 0) > 0) PlayerAccess.setColCooldown((getState().player._colCooldown ?? 0) - dt);

  resolveSolidCollisions();

  if (getState().player.invincible > 0) PlayerAccess.setInvincible(getState().player.invincible - dt);
  if ((Client.combatHeat ?? 0) > 0) {
    PlayerAccess.setCombatHeat(Math.max(0, Client.combatHeat - dt * 0.25));
  }
  if (getState().player.shieldHitGlow > 0) {
    PlayerAccess.setShieldHitGlow(getState().player.shieldHitGlow - dt * 2.5);
    if (getState().player.shieldHitGlow <= 0) {
      PlayerAccess.setShieldHitGlow(0);
      PlayerAccess.setShieldHitAngle(0);
    }
  }
  if (getState().player.hullHitGlow > 0) {
    PlayerAccess.setHullHitGlow(getState().player.hullHitGlow - dt * 3.0);
    if (getState().player.hullHitGlow <= 0) {
      PlayerAccess.setHullHitGlow(0);
      PlayerAccess.setHullHitAngle(0);
    }
  }
  if ((getState().player.structureHitGlow ?? 0) > 0) {
    PlayerAccess.setStructureHitGlow((getState().player.structureHitGlow ?? 0) - dt * 3.0);
    if (getState().player.structureHitGlow! <= 0) {
      PlayerAccess.setStructureHitGlow(0);
      PlayerAccess.setStructureHitAngle(0);
    }
  }

  PlayerAccess.setShield(Math.min(st.maxShield, getState().player.shield + st.shieldRegen * dt));
  PlayerAccess.setEnergy(Math.min(st.maxEnergy, getState().player.energy + st.energyRegen * dt));

  const slotHeat = getState().player.slotHeat;
  if (slotHeat) {
    for (const rack of Object.keys(slotHeat)) {
      const heat = slotHeat[rack] ?? [];
      for (let i = 0; i < heat.length; i++) {
        if (heat[i] > 0) PlayerAccess.setSlotHeat(rack, i, Math.max(0, heat[i] - dt * 0.15));
      }
    }
  }

  const speedRatio = st.maxSpeed > 0 ? Math.min(1, speed / st.maxSpeed) : 0;
  updateEngineSound(isThrusting, speedRatio, abOn);
}

const _colHits: SpatialQueryResult<unknown>[] = [];

function resolveSolidCollisions() {
  const grid = getState().spatialGrid;
  if (!grid) return;
  const playerR = SHIPS[getState().player.shipId]?.colRadius ?? 20;

  _colHits.length = 0;
  grid.query(getState().player.x, getState().player.y, playerR, null, _colHits);

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
      const closing = resolveElasticCollision(getState().player, ast, PLAYER_MASS, mA, h.dx, h.dy, h.dist, playerR + h.radius, COLLISION_RESTITUTION);

      if (closing > COLLISION_DMG_THRESHOLD && (getState().player._colCooldown || 0) <= 0) {
        const dmg = (closing - COLLISION_DMG_THRESHOLD) * COLLISION_DMG_SCALE;
        damagePlayer(dmg, ast.x, ast.y);
        PlayerAccess.setColCooldown(COLLISION_COOLDOWN);
      }

    } else if (h.type === "enemy") {
      const en = h.data as Enemy;
      if (!en) continue;
      const closing = resolveElasticCollision(getState().player, en, PLAYER_MASS, ENEMY_MASS, h.dx, h.dy, h.dist, playerR + h.radius, COLLISION_RESTITUTION);

      if (closing > COLLISION_DMG_THRESHOLD && (getState().player._colCooldown || 0) <= 0) {
        const dmg = (closing - COLLISION_DMG_THRESHOLD) * COLLISION_DMG_SCALE * 0.5;
        damagePlayer(dmg, en.x, en.y);
        PlayerAccess.setColCooldown(COLLISION_COOLDOWN);
      }

    } else if (h.type === "wreckpiece") {
      const piece = h.data as WreckPiece;
      if (!piece || piece.hp <= 0) continue;
      // Piece mass proportional to radius^2 (flat debris slab approximation).
      const pieceMass = piece.radius * piece.radius * 0.8;
      const closing = resolveElasticCollision(getState().player, piece, PLAYER_MASS, pieceMass, h.dx, h.dy, h.dist, playerR + h.radius, COLLISION_RESTITUTION);

      if (closing > COLLISION_DMG_THRESHOLD && (getState().player._colCooldown || 0) <= 0) {
        const dmg = (closing - COLLISION_DMG_THRESHOLD) * COLLISION_DMG_SCALE * 0.4;
        damagePlayer(dmg, piece.x, piece.y);
        PlayerAccess.setColCooldown(COLLISION_COOLDOWN);
      }
    }
  }
}
