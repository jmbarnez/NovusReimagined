import { G, Client } from "./state.js";
import { MODULES, MODULE_FLAGS, ModuleDef } from "./data/modules.js";
import { getInstance } from "./utils/items.js";
import { dst } from "./utils/math.js";
import { floatText } from "./utils/fx.js";
import { isWreckPieceTarget, isAsteroidTarget } from "./targeting.js";
import { curSys } from "./utils/game.js";
import { ASTEROID_DENSITY } from "./constants.js";
import { invalidate } from "./player/player-stats.js";
import type { Asteroid, WreckPiece, LockSlot } from "./types/world.js";

export const TRACTOR_RANGE = 600;

const TOO_HEAVY_TEXT_INTERVAL = 1.5;
let _tooHeavyTimer = 0;
let _prevCarryKg = 0;

function findTractorSlot(): { idx: number; mod: ModuleDef } | null {
  const turrets = G.P.fitting?.turret;
  if (!turrets) return null;
  for (let i = 0; i < turrets.length; i++) {
    const uid = turrets[i];
    if (!uid) continue;
    const inst = getInstance(uid);
    const m = inst ? MODULES[inst.baseId] : null;
    if (!m || !MODULE_FLAGS.isTractor(m)) continue;
    const powered = G.P.turretPower?.[i] ?? false;
    if (powered) return { idx: i, mod: m };
  }
  return null;
}

function resolveAssignedTarget(slotIdx: number): { entity: Asteroid | WreckPiece; mass: number; id: string } | null {
  const assignedId = G.P.turretTargets?.[slotIdx];
  if (!assignedId) return null;

  const lockSlot = G.P.lockQueue?.find((s: LockSlot) => s.id === assignedId);
  if (!lockSlot || lockSlot.resolving) return null;

  if (isWreckPieceTarget(assignedId)) {
    const piece = G.wreckPieces.find((p) => p.id === assignedId);
    if (!piece || piece.hp <= 0) return null;
    if (dst(G.P.x, G.P.y, piece.x, piece.y) > TRACTOR_RANGE) return null;
    const mass = piece.radius * piece.radius * 0.8;
    return { entity: piece, mass, id: assignedId };
  }

  if (isAsteroidTarget(assignedId)) {
    const sys = curSys();
    if (!sys) return null;
    const ast = sys._asteroidMap?.get(assignedId);
    if (!ast || ast.depleted || ast.hp <= 0) return null;
    if (dst(G.P.x, G.P.y, ast.x, ast.y) > TRACTOR_RANGE) return null;
    const mass = ast.radius * ast.radius * ASTEROID_DENSITY;
    return { entity: ast, mass, id: assignedId };
  }

  return null;
}

function setCarryKg(kg: number) {
  if (kg !== _prevCarryKg) {
    G.P.tractorCarryKg = kg;
    _prevCarryKg = kg;
    invalidate();
  }
}

export function updateTractor(dt: number) {
  const tr = G.tractor;

  const slot = findTractorSlot();
  if (!slot) {
    tr.active = false;
    tr.targetId = null;
    tr.tooHeavy = false;
    setCarryKg(0);
    return;
  }

  if (Client.stationOpen || Client.showMap || Client.bridgeOpen || Client.settingsOpen) {
    tr.active = false;
    tr.targetId = null;
    tr.tooHeavy = false;
    setCarryKg(0);
    return;
  }

  const resolved = resolveAssignedTarget(slot.idx);
  if (!resolved) {
    tr.active = false;
    tr.targetId = null;
    tr.tooHeavy = false;
    setCarryKg(0);
    return;
  }

  const { entity, mass, id } = resolved;
  const maxMass = slot.mod.tractorMaxMassKg ?? 3000;

  const t = G.P.tractorTightness ?? 0.5;
  const pullMult = 0.45 + t * 1.10;
  const drainMult = 0.5 + t * 1.5;
  const drain = (slot.mod.capDrainPerSec ?? 3) * drainMult * dt;

  if (G.P.energy < drain) {
    tr.active = false;
    tr.tooHeavy = false;
    tr.targetId = null;
    floatText(G.P.x, G.P.y - 35, "No cap", "#ff8844");
    setCarryKg(0);
    return;
  }

  // Drain capacitor continuously
  G.P.energy -= drain;

  // Set active coordinates & animate phase
  tr.targetId = id;
  tr.x1 = G.P.x; tr.y1 = G.P.y;
  tr.x2 = entity.x; tr.y2 = entity.y;
  tr.phase += dt * 5;

  if (mass > maxMass) {
    tr.active = false;
    tr.tooHeavy = true;
    setCarryKg(0);
    _tooHeavyTimer -= dt;
    if (_tooHeavyTimer <= 0) {
      floatText(entity.x, entity.y - 22, "Too heavy", "#ff8844");
      _tooHeavyTimer = TOO_HEAVY_TEXT_INTERVAL;
    }
  } else {
    tr.active = true;
    tr.tooHeavy = false;
    setCarryKg(mass);

    // Apply pull force toward player
    const dx = G.P.x - entity.x;
    const dy = G.P.y - entity.y;
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

export function getTractorBeam() {
  return G.tractor;
}
