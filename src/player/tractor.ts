import { Client, type Player } from "../state.js";
import { getState, PlayerAccess, TractorAccess } from "../state-access.js";
import { MODULE_FLAGS, type ModuleDef } from "../data/modules.js";
import { dst } from "../utils/math.js";
import { floatText } from "../utils/fx.js";
import { t } from "../utils/i18n.js";
import { curSys } from "../utils/game.js";
import { ASTEROID_DENSITY } from "../constants.js";
import { invalidate } from "./player-stats.js";
import type { Asteroid } from "../types/asteroid.js";
import type { WreckPiece } from "../types/system.js";
import { findFirstPoweredModuleSlot, getFittedModuleDef, isModuleSlotPowered } from "../utils/module-slots.js";
import { playerHardpointRack } from "../utils/hardpoints.js";
import { getPlayerTurretOrigin } from "../combat/turret-origin.js";
import { getPlayerInputMouseWorld } from "./input-state.js";

export const TRACTOR_RANGE = 600;

const TOO_HEAVY_TEXT_INTERVAL = 1.5;
let _tooHeavyTimer = 0;

type TractorTarget = { entity: Asteroid | WreckPiece; mass: number; id: string };
type TractorSlot = { idx: number; mod: ModuleDef };

function findTractorSlot(p: Player): TractorSlot | null {
  const sourceSlotIdx = p.tractor?.sourceSlotIdx;
  if (typeof sourceSlotIdx === "number") {
    const rack = playerHardpointRack(p);
    const mod = getFittedModuleDef(rack, sourceSlotIdx, p);
    if (mod && MODULE_FLAGS.isTractor(mod) && isModuleSlotPowered(rack, sourceSlotIdx, p)) {
      return { idx: sourceSlotIdx, mod };
    }
  }
  return findFirstPoweredModuleSlot(MODULE_FLAGS.isTractor, p);
}

function segmentCircleDistance(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  cx: number,
  cy: number,
  radius: number,
): number | null {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 0) return dst(x1, y1, cx, cy) <= radius ? 0 : null;

  const t = Math.max(0, Math.min(1, ((cx - x1) * dx + (cy - y1) * dy) / lenSq));
  const px = x1 + dx * t;
  const py = y1 + dy * t;
  if (dst(px, py, cx, cy) > radius) return null;
  return Math.hypot(px - x1, py - y1);
}

function wreckMass(piece: WreckPiece): number {
  return piece.radius * piece.radius * 0.8;
}

function asteroidMass(ast: Asteroid): number {
  return ast.radius * ast.radius * ASTEROID_DENSITY;
}

function findTractorTargetById(targetId: string): TractorTarget | null {
  for (const piece of getState().wreckPieces) {
    if (piece.id !== targetId || piece.hp <= 0) continue;
    return { entity: piece, mass: wreckMass(piece), id: piece.id };
  }

  const sys = curSys();
  if (!sys) return null;
  for (const ast of sys.asteroids) {
    if (ast.id !== targetId || ast.depleted || ast.hp <= 0) continue;
    return { entity: ast, mass: asteroidMass(ast), id: ast.id };
  }

  return null;
}

function raycastTractorTarget(p: Player, range: number): TractorTarget | null {
  const origin = getPlayerTurretOrigin(p);
  const mouse = getPlayerInputMouseWorld(p.netId ?? p.shipId) ?? {
    x: origin.x + Math.cos(p.angle) * range,
    y: origin.y + Math.sin(p.angle) * range,
  };
  let targetX = mouse.x;
  let targetY = mouse.y;
  const dx = targetX - origin.x;
  const dy = targetY - origin.y;
  const cursorDist = Math.hypot(dx, dy);
  if (cursorDist > range) {
    const scale = range / cursorDist;
    targetX = origin.x + dx * scale;
    targetY = origin.y + dy * scale;
  }

  let best: (TractorTarget & { hitDist: number }) | null = null;
  for (const piece of getState().wreckPieces) {
    if (piece.hp <= 0) continue;
    const hitDist = segmentCircleDistance(origin.x, origin.y, targetX, targetY, piece.x, piece.y, Math.max(18, piece.radius));
    if (hitDist == null || (best && hitDist >= best.hitDist)) continue;
    best = { entity: piece, mass: wreckMass(piece), id: piece.id, hitDist };
  }

  const sys = curSys();
  if (sys) {
    for (const ast of sys.asteroids) {
      if (ast.depleted || ast.hp <= 0) continue;
      const hitDist = segmentCircleDistance(origin.x, origin.y, targetX, targetY, ast.x, ast.y, Math.max(20, ast.radius));
      if (hitDist == null || (best && hitDist >= best.hitDist)) continue;
      best = { entity: ast, mass: asteroidMass(ast), id: ast.id, hitDist };
    }
  }

  return best;
}

function setCarryKg(kg: number, p: Player) {
  if (kg !== (p.tractorCarryKg ?? 0)) {
    PlayerAccess.setTractorCarryKg(kg, p);
    invalidate(p);
  }
}

export function detachTractorBeam(p: Player = getState().player): void {
  TractorAccess.update({ active: false, targetId: null, sourceSlotIdx: undefined, tooHeavy: false }, p);
  setCarryKg(0, p);
}

export function attachTractorFromSelectedSlot(slotIdx: number, p: Player = getState().player): void {
  if (p === getState().player && (Client.stationOpen || Client.showMap || Client.bridgeOpen || Client.settingsOpen)) return;
  const rack = playerHardpointRack(p);
  const mod = getFittedModuleDef(rack, slotIdx, p);
  if (!mod || !MODULE_FLAGS.isTractor(mod) || !isModuleSlotPowered(rack, slotIdx, p)) return;

  const range = mod.optimalRange ?? TRACTOR_RANGE;
  const resolved = raycastTractorTarget(p, range);
  if (!resolved) return;

  const origin = getPlayerTurretOrigin(p);
  TractorAccess.update({
    active: true,
    targetId: resolved.id,
    sourceSlotIdx: slotIdx,
    tooHeavy: false,
    x1: origin.x,
    y1: origin.y,
    x2: resolved.entity.x,
    y2: resolved.entity.y,
    phase: p.tractor?.phase ?? 0,
  }, p);
}

export function updateTractor(dt: number, p: Player = getState().player) {
  const slot = findTractorSlot(p);
  if (!slot) {
    detachTractorBeam(p);
    return;
  }

  if (p === getState().player && (Client.stationOpen || Client.showMap || Client.bridgeOpen || Client.settingsOpen)) {
    detachTractorBeam(p);
    return;
  }

  const targetId = p.tractor?.targetId ?? null;
  if (!targetId) {
    TractorAccess.update({ active: false, tooHeavy: false }, p);
    setCarryKg(0, p);
    return;
  }

  const resolved = findTractorTargetById(targetId);
  if (!resolved) {
    detachTractorBeam(p);
    return;
  }

  const { entity, mass } = resolved;
  const range = slot.mod.optimalRange ?? TRACTOR_RANGE;
  if (dst(p.x, p.y, entity.x, entity.y) > range) {
    detachTractorBeam(p);
    return;
  }

  const maxMass = slot.mod.tractorMaxMassKg ?? 3000;
  const drain = (slot.mod.capDrainPerSec ?? 3) * dt;

  if (p.energy < drain) {
    detachTractorBeam(p);
    if (p === getState().player) floatText(p.x, p.y - 35, t("system.tractorNoCap"), "#ff8844");
    return;
  }

  PlayerAccess.setEnergy(p.energy - drain, p);

  TractorAccess.update({
    targetId,
    x1: p.x,
    y1: p.y,
    x2: entity.x,
    y2: entity.y,
    phase: (p.tractor?.phase ?? 0) + dt * 5,
  }, p);

  if (mass > maxMass) {
    TractorAccess.update({ active: false, tooHeavy: true }, p);
    setCarryKg(0, p);
    _tooHeavyTimer -= dt;
    if (p === getState().player && _tooHeavyTimer <= 0) {
      floatText(entity.x, entity.y - 22, t("system.tractorTooHeavy"), "#ff8844");
      _tooHeavyTimer = TOO_HEAVY_TEXT_INTERVAL;
    }
  } else {
    TractorAccess.update({ active: true, tooHeavy: false }, p);
    setCarryKg(mass, p);

    const dx = p.x - entity.x;
    const dy = p.y - entity.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 1) {
      const pullAccel = slot.mod.tractorPullAccel ?? 140;
      const nx = dx / dist;
      const ny = dy / dist;
      entity.vx = (entity.vx ?? 0) + nx * pullAccel * dt;
      entity.vy = (entity.vy ?? 0) + ny * pullAccel * dt;
    }
  }
}

export function getTractorBeam(p = getState().player) {
  return p?.tractor ?? getState().tractor;
}
