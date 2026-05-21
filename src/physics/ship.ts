import { G, Client } from "../state.js";
import { W, H } from "../canvas.js";
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
import { MODULES } from "../data/modules.js";
import { SHIPS } from "../data/ships.js";
import { invalidate } from "../player/player-stats.js";
import { updateEngineSound } from "../audio/procedural.js";
import { addTrailSegment } from "../utils/entities.js";
import { C } from "../config/index.js";
import { activeMovementMultipliers } from "../player/abilities.js";

export function updateShip(dt: number) {
  const st = getStats();
  if (!Number.isFinite(G.P.vx)) G.P.vx = 0;
  if (!Number.isFinite(G.P.vy)) G.P.vy = 0;
  if (!Number.isFinite(G.P.va)) G.P.va = 0;
  if (!Number.isFinite(G.P.angle)) G.P.angle = 0;
  if (!Number.isFinite(G.P.x)) G.P.x = 0;
  if (!Number.isFinite(G.P.y)) G.P.y = 0;

  // Build cargo map once per tick to avoid repeated O(N*M) lookups inside G.P.moduleCargo
  const cargoMap = new Map<string, any>();
  if (Array.isArray(G.P.moduleCargo)) {
    for (let i = 0; i < G.P.moduleCargo.length; i++) {
      const inst = G.P.moduleCargo[i];
      if (inst && inst.uid) cargoMap.set(inst.uid, inst);
    }
  }

  G.P.thrustFx = false;
  const speed = Math.hypot(G.P.vx, G.P.vy);
  let ax = 0, ay = 0;
  let at = 0;

  // Autopilot: always follows waypoint when one is set.
  if (Client.waypoint && !Client.stationOpen && !Client.bridgeOpen && !Client.settingsOpen) {
    const wp = Client.waypoint;
    const dx = wp.x - G.P.x;
    const dy = wp.y - G.P.y;
    const dist = Math.hypot(dx, dy);
    const wpAngle = Math.atan2(dy, dx);

    if (dist < 30) {
      Client.waypoint = null;
    } else {
      const diff = angleDiff(G.P.angle, wpAngle);
      at = diff * C.PHYSICS.SHIP.turnRateMultiplier;
      ax = Math.cos(wpAngle);
      ay = Math.sin(wpAngle);
      G.P.thrustFx = true;
    }
  } else if (!Client.stationOpen && !Client.bridgeOpen && !Client.settingsOpen && !Client.cursorUnlocked) {
    const targetAngle = aimAngle(G.P.x, G.P.y, Client.mouseWorld.x, Client.mouseWorld.y);
    const diff = angleDiff(G.P.angle, targetAngle);
    at = diff * C.PHYSICS.SHIP.turnRateMultiplier;
  }

  const isThrusting = G.P.thrustFx && speed > C.PHYSICS.SHIP.minSpeedForThrust;

  if (Client.keys[" "]) {
    G.P.vx *= C.PHYSICS.SHIP.brakeVelocityRetention; G.P.vy *= C.PHYSICS.SHIP.brakeVelocityRetention; G.P.va *= C.PHYSICS.SHIP.brakeAngularRetention;
  }

  let capDrained = false;
  let anyStateChanged = false;
  for (const rack of RACK_TYPES) {
    const slots = G.P.fitting?.[rack] || [];
    for (let i = 0; i < slots.length; i++) {
      const uid = slots[i];
      if (!uid) continue;
      const inst = cargoMap.get(uid);
      if (!inst) continue;
      const m = MODULES[inst.baseId];
      if (!m?.isActive || !m.capDrainPerSec) continue;
      if (!(G.P.slotActive?.[rack]?.[i] ?? true)) continue;
      if (inst.baseId === "me-ab1" && !isThrusting) continue;
      const drain = m.capDrainPerSec * dt;
      if (G.P.energy >= drain) {
        G.P.energy -= drain;
        capDrained = true;
      } else {
        if (!G.P.slotActive) G.P.slotActive = {};
        if (!G.P.slotActive[rack]) G.P.slotActive[rack] = [];
        G.P.slotActive[rack][i] = false;
        anyStateChanged = true;
      }
    }
  }
  if (anyStateChanged) invalidate();

  let thrustScale = st.thrustScale;
  let turnRate = st.turnRate;
  let mainThrust = st.mainThrust;
  let drag = st.dragPerSec;
  const medSlots = G.P.fitting?.med || [];
  const abUid = medSlots.find(uid => {
    if (!uid) return false;
    const inst = cargoMap.get(uid);
    return inst?.baseId === "me-ab1";
  });
  const abIdx = abUid ? medSlots.indexOf(abUid) : -1;
  const abActive = abIdx >= 0 && !!(G.P.slotActive?.med?.[abIdx] ?? true);
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

  G.P.vx += ax * mainThrust * dt;
  G.P.vy += ay * mainThrust * dt;
  G.P.va += at * turnRate * dt;

  // Cap to ability-boosted max speed when an active speed multiplier is in play.
  if (mult.speed > 1) {
    const cap = (st.maxSpeed || 0) * mult.speed;
    if (cap > 0) {
      const sp = Math.hypot(G.P.vx, G.P.vy);
      if (sp > cap) { const k = cap / sp; G.P.vx *= k; G.P.vy *= k; }
    }
  }

  G.P.vx *= drag; G.P.vy *= drag; G.P.va *= ANG_FRICTION;

  // Snap negligible velocity to zero — eliminates perpetual micro-drift
  // that the camera would chase, causing fine vibration.
  if (Math.abs(G.P.vx) < 0.01) G.P.vx = 0;
  if (Math.abs(G.P.vy) < 0.01) G.P.vy = 0;
  if (Math.abs(G.P.va) < 0.001) G.P.va = 0;

  G.P.px = G.P.x; G.P.py = G.P.y; G.P.prevAngle = G.P.angle;
  G.P.x += G.P.vx * dt; G.P.y += G.P.vy * dt; G.P.angle += G.P.va * dt;

  const currentSpeed = Math.hypot(G.P.vx, G.P.vy);
  if (currentSpeed > 8) {
    const cos = Math.cos(G.P.angle);
    const sin = Math.sin(G.P.angle);
    const rearDist = C.PHYSICS.SHIP.thrustTrailRearDist;
    const wx = G.P.x - cos * rearDist;
    const wy = G.P.y - sin * rearDist;

    addTrailSegment({
      x: wx,
      y: wy,
      color: abOn ? C.PHYSICS.SHIP.thrustTrailABColor : C.PHYSICS.SHIP.thrustTrailNormalColor,
      width: abOn ? C.PHYSICS.SHIP.thrustTrailABWidth : C.PHYSICS.SHIP.thrustTrailNormalWidth,
      life: C.PHYSICS.SHIP.thrustTrailLife,
      angle: G.P.angle,
    });
  }

  if ((G.P._colCooldown ?? 0) > 0) G.P._colCooldown = (G.P._colCooldown ?? 0) - dt;

  resolveSolidCollisions();

  if (G.P.invincible > 0) G.P.invincible -= dt;
  if ((Client.combatHeat ?? 0) > 0) {
    Client.combatHeat = Math.max(0, Client.combatHeat - dt * 0.25);
  }
  if (G.P.shieldHitGlow > 0) {
    G.P.shieldHitGlow -= dt * 2.5;
    if (G.P.shieldHitGlow <= 0) {
      G.P.shieldHitGlow = 0;
      G.P.shieldHitAngle = 0;
    }
  }
  if (G.P.hullHitGlow > 0) {
    G.P.hullHitGlow -= dt * 3.0;
    if (G.P.hullHitGlow <= 0) {
      G.P.hullHitGlow = 0;
      G.P.hullHitAngle = 0;
    }
  }
  if ((G.P.structureHitGlow ?? 0) > 0) {
    G.P.structureHitGlow = (G.P.structureHitGlow ?? 0) - dt * 3.0;
    if (G.P.structureHitGlow <= 0) {
      G.P.structureHitGlow = 0;
      G.P.structureHitAngle = 0;
    }
  }

  G.P.shield = Math.min(st.maxShield, G.P.shield + st.shieldRegen * dt);
  G.P.energy = Math.min(st.maxEnergy, G.P.energy + st.energyRegen * dt);

  if (G.P.slotHeat) {
    for (const rack of Object.keys(G.P.slotHeat)) {
      const heat = G.P.slotHeat[rack];
      for (let i = 0; i < heat.length; i++) {
        if (heat[i] > 0) heat[i] = Math.max(0, heat[i] - dt * 0.15);
      }
    }
  }

  const speedRatio = st.maxSpeed > 0 ? Math.min(1, speed / st.maxSpeed) : 0;
  updateEngineSound(isThrusting, speedRatio, abOn);
}

const _colHits: any[] = [];

function resolveSolidCollisions() {
  const grid = G.spatialGrid;
  if (!grid) return;
  const playerR = SHIPS[G.P.shipId]?.colRadius ?? 20;

  _colHits.length = 0;
  grid.query(G.P.x, G.P.y, playerR, null, _colHits);

  for (let i = 0; i < _colHits.length; i++) {
    const h = _colHits[i];
    if (h.type === "player" || h.type === "station") continue;
    if (h.dist < 0.001) continue;

    const overlap = playerR + h.radius - h.dist;
    if (overlap <= 0) continue;

    const nx = h.dx / h.dist;
    const ny = h.dy / h.dist;

    if (h.type === "asteroid") {
      const ast = h.data;
      if (!ast) continue;
      const mA = ast.radius * ast.radius * ASTEROID_DENSITY;
      const closing = resolveElasticCollision(G.P, ast, PLAYER_MASS, mA, h.dx, h.dy, h.dist, playerR + h.radius, COLLISION_RESTITUTION);

      if (closing > COLLISION_DMG_THRESHOLD && (G.P._colCooldown || 0) <= 0) {
        const dmg = (closing - COLLISION_DMG_THRESHOLD) * COLLISION_DMG_SCALE;
        damagePlayer(dmg, ast.x, ast.y);
        G.P._colCooldown = COLLISION_COOLDOWN;
      }

    } else if (h.type === "enemy") {
      const en = h.data;
      if (!en) continue;
      const closing = resolveElasticCollision(G.P, en, PLAYER_MASS, ENEMY_MASS, h.dx, h.dy, h.dist, playerR + h.radius, COLLISION_RESTITUTION);

      if (closing > COLLISION_DMG_THRESHOLD && (G.P._colCooldown || 0) <= 0) {
        const dmg = (closing - COLLISION_DMG_THRESHOLD) * COLLISION_DMG_SCALE * 0.5;
        damagePlayer(dmg, en.x, en.y);
        G.P._colCooldown = COLLISION_COOLDOWN;
      }

    } else if (h.type === "wreckpiece") {
      const piece = h.data as any;
      if (!piece || piece.hp <= 0) continue;
      // Piece mass proportional to radius^2 (flat debris slab approximation).
      const pieceMass = piece.radius * piece.radius * 0.8;
      const closing = resolveElasticCollision(G.P, piece, PLAYER_MASS, pieceMass, h.dx, h.dy, h.dist, playerR + h.radius, COLLISION_RESTITUTION);

      if (closing > COLLISION_DMG_THRESHOLD && (G.P._colCooldown || 0) <= 0) {
        const dmg = (closing - COLLISION_DMG_THRESHOLD) * COLLISION_DMG_SCALE * 0.4;
        damagePlayer(dmg, piece.x, piece.y);
        G.P._colCooldown = COLLISION_COOLDOWN;
      }
    }
  }
}
