import { Client, type Player } from "../state.js";
import { PlayerAccess, clearNav, getState } from "../state-access.js";
import { enemyByLockId } from "../targeting.js";
import { ACCEL, FRICTION, ANG_FRICTION } from "../constants.js";
import { getStats } from "../player/player-stats.js";
import { updateEngineSound } from "../audio/procedural.js";
import { C } from "../config/index.js";
import { activeMovementMultipliers } from "../player/abilities.js";
import type { ModuleInstance } from "../types/moduleInstance.js";
import { isHeadlessServer } from "./net-input.js";
import { emitShipExhaustSheets } from "../utils/ship-exhaust.js";
import { getIonBoostModuleState } from "../player/boost-module.js";
import { decayPlayerHitGlows } from "../player/hit-glow.js";
import { computeShipNavForces } from "./ship-nav.js";
import { processModuleCapDrain, computeBoostState } from "./ship-modules.js";
import { resolveSolidCollisions } from "./collisions.js";

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

  // ── 1. Navigation (pure decision) ──────────────────────────────────────
  const nav = computeShipNavForces(
    p,
    inputKeys,
    inputMouseWorld,
    uiBlocksInput,
    Client.cursorUnlocked,
    isLocalPresentation,
  );
  let { ax, ay, at } = nav;
  if (nav.thrustFx) PlayerAccess.updatePhysics({ thrustFx: true }, p);

  // Clear nav/waypoint if the pure helper indicated arrival
  if (p.navCommand && !uiBlocksInput && !(inputKeys?.w || inputKeys?.s || inputKeys?.a || inputKeys?.d)) {
    const target = enemyByLockId(p.navCommand.targetId);
    if (!target) {
      p.navCommand = null;
      if (isLocalPresentation) clearNav();
    }
  }
  if (p.waypoint && !uiBlocksInput && !(inputKeys?.w || inputKeys?.s || inputKeys?.a || inputKeys?.d)) {
    const dx = p.waypoint.x - p.x;
    const dy = p.waypoint.y - p.y;
    if (Math.hypot(dx, dy) < 30) {
      p.waypoint = null;
      if (isLocalPresentation) Client.waypoint = null;
    }
  }

  const isThrusting = p.thrustFx && speed > C.PHYSICS.SHIP.minSpeedForThrust;
  const isApplyingThrust = p.thrustFx === true;

  if (inputKeys?.space) {
    PlayerAccess.updatePhysics({ vx: p.vx * C.PHYSICS.SHIP.brakeVelocityRetention, vy: p.vy * C.PHYSICS.SHIP.brakeVelocityRetention, va: p.va * C.PHYSICS.SHIP.brakeAngularRetention }, p);
  }

  // ── 2. Module capacitor drain ──────────────────────────────────────────────
  processModuleCapDrain(p, dt, cargoMap, isThrusting);

  // ── 3. Boost state ───────────────────────────────────────────────────────
  const boostModule = getIonBoostModuleState(p, cargoMap);
  const abOn = boostModule.online;
  const boostRequested = !!inputKeys?.boost && !uiBlocksInput && isApplyingThrust;
  const { boostThrustMult, boostSpeedMult } = computeBoostState(
    p, dt, cargoMap, boostRequested, isApplyingThrust,
  );

  // ── 4. Physics integration ───────────────────────────────────────────────
  const mult = activeMovementMultipliers();
  let mainThrust = st.mainThrust * mult.thrust * boostThrustMult;
  const turnRate = st.turnRate;
  let drag = st.dragPerSec;

  PlayerAccess.updatePhysics({ vx: p.vx + ax * mainThrust * dt, vy: p.vy + ay * mainThrust * dt, va: p.va + at * turnRate * dt }, p);

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


