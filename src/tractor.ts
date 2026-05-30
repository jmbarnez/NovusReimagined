import { Client } from "./state.js";
import { getState, PlayerAccess, TractorAccess } from "./state-access.js";
import { MODULES, MODULE_FLAGS, ModuleDef } from "./data/modules.js";
import { getInstance } from "./utils/items.js";
import { dst } from "./utils/math.js";
import { floatText } from "./utils/fx.js";
import { isWreckPieceTarget, isAsteroidTarget } from "./targeting.js";
import { curSys } from "./utils/game.js";
import { ASTEROID_DENSITY } from "./constants.js";
import { invalidate } from "./player/player-stats.js";
import type { Asteroid, WreckPiece, LockSlot } from "./types/world.js";
import { findFirstPoweredModuleSlot } from "./utils/module-slots.js";

export const TRACTOR_RANGE = 600;

const TOO_HEAVY_TEXT_INTERVAL = 1.5;
let _tooHeavyTimer = 0;
let _prevCarryKg = 0;

function findTractorSlot(): { idx: number; mod: ModuleDef } | null {
  return findFirstPoweredModuleSlot(MODULE_FLAGS.isTractor, getState().player);
}

function resolveAssignedTarget(slotIdx: number): { entity: Asteroid | WreckPiece; mass: number; id: string } | null {
  const assignedId = getState().player.turretTargets?.[slotIdx];
  if (!assignedId) return null;

  const lockSlot = getState().player.lockQueue?.find((s: LockSlot) => s.id === assignedId);
  if (!lockSlot || lockSlot.resolving) return null;

  if (isWreckPieceTarget(assignedId)) {
    const piece = getState().wreckPieces.find((p) => p.id === assignedId);
    if (!piece || piece.hp <= 0) return null;
    if (dst(getState().player.x, getState().player.y, piece.x, piece.y) > TRACTOR_RANGE) return null;
    const mass = piece.radius * piece.radius * 0.8;
    return { entity: piece, mass, id: assignedId };
  }

  if (isAsteroidTarget(assignedId)) {
    const sys = curSys();
    if (!sys) return null;
    const ast = sys._asteroidMap?.get(assignedId);
    if (!ast || ast.depleted || ast.hp <= 0) return null;
    if (dst(getState().player.x, getState().player.y, ast.x, ast.y) > TRACTOR_RANGE) return null;
    const mass = ast.radius * ast.radius * ASTEROID_DENSITY;
    return { entity: ast, mass, id: assignedId };
  }

  return null;
}

function setCarryKg(kg: number) {
  if (kg !== _prevCarryKg) {
    PlayerAccess.setTractorCarryKg(kg);
    _prevCarryKg = kg;
    invalidate();
  }
}

export function updateTractor(dt: number) {
  if (!getState().tractor) {
    TractorAccess.update({
      active: false,
      targetId: null,
      tooHeavy: false,
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 0,
      phase: 0,
    });
  }

  const slot = findTractorSlot();
  if (!slot) {
    TractorAccess.update({ active: false, targetId: null, tooHeavy: false });
    setCarryKg(0);
    return;
  }

  if (Client.stationOpen || Client.showMap || Client.bridgeOpen || Client.settingsOpen) {
    TractorAccess.update({ active: false, targetId: null, tooHeavy: false });
    setCarryKg(0);
    return;
  }

  const resolved = resolveAssignedTarget(slot.idx);
  if (!resolved) {
    TractorAccess.update({ active: false, targetId: null, tooHeavy: false });
    setCarryKg(0);
    return;
  }

  const { entity, mass, id } = resolved;
  const maxMass = slot.mod.tractorMaxMassKg ?? 3000;

  const t = getState().player.tractorTightness ?? 0.5;
  const pullMult = 0.45 + t * 1.10;
  const drainMult = 0.5 + t * 1.5;
  const drain = (slot.mod.capDrainPerSec ?? 3) * drainMult * dt;

  if (getState().player.energy < drain) {
    TractorAccess.update({ active: false, tooHeavy: false, targetId: null });
    floatText(getState().player.x, getState().player.y - 35, "No cap", "#ff8844");
    setCarryKg(0);
    return;
  }

  // Drain capacitor continuously
  PlayerAccess.setEnergy(getState().player.energy - drain);

  // Set active coordinates & animate phase
  TractorAccess.update({
    targetId: id,
    x1: getState().player.x,
    y1: getState().player.y,
    x2: entity.x,
    y2: entity.y,
    phase: (getState().tractor?.phase ?? 0) + dt * 5,
  });

  if (mass > maxMass) {
    TractorAccess.update({ active: false, tooHeavy: true });
    setCarryKg(0);
    _tooHeavyTimer -= dt;
    if (_tooHeavyTimer <= 0) {
      floatText(entity.x, entity.y - 22, "Too heavy", "#ff8844");
      _tooHeavyTimer = TOO_HEAVY_TEXT_INTERVAL;
    }
  } else {
    TractorAccess.update({ active: true, tooHeavy: false });
    setCarryKg(mass);

    // Apply pull force toward player
    const dx = getState().player.x - entity.x;
    const dy = getState().player.y - entity.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 1) {
      const pullAccel = slot.mod.tractorPullAccel ?? 140;
      const nx = dx / dist;
      const ny = dy / dist;
      entity.vx = (entity.vx ?? 0) + nx * pullAccel * pullMult * dt;
      entity.vy = (entity.vy ?? 0) + ny * pullAccel * pullMult * dt;
    }
  }
}

export function getTractorBeam(p = getState().player) {
  return p?.tractor ?? getState().tractor;
}
