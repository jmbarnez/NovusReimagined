import type { ModuleInstance } from "../types/moduleInstance.js";
import type { WreckPiece, WreckSalvageEntry } from "../types/system.js";
import { C } from "../config/index.js";
import { addParticle, addSalvagePickup, addShockwave, removeWreckPiece } from "../utils/entities.js";
import { generateModuleInstance, isPlayerWeaponModule, playerWeaponModuleIds } from "../loot/generateModule.js";
import { getState, SalvagerAccess } from "../state-access.js";
import { getStats } from "../player/player-stats.js";
import { sfxWreckPieceDestroy } from "../audio/procedural.js";
import { PICKUP_LIFE_S } from "./spawn.js";
import { ENEMY_DEFS } from "../data/enemies.js";

export type SalvageDrop = { kind: "loot" | "module"; payload: string; qty: number; instance?: ModuleInstance };

export function playerWeaponSalvagePool(salvagePool: WreckSalvageEntry[] | undefined): WreckSalvageEntry[] {
  const filtered = (salvagePool ?? []).filter((entry) => isPlayerWeaponModule(entry.id));
  if (filtered.length > 0) return filtered;
  return playerWeaponModuleIds().map((id) => ({ id, weight: 1 }));
}

function selectWeightedModuleId(pool: WreckSalvageEntry[]): string {
  const total = pool.reduce((s: number, e: WreckSalvageEntry) => s + Math.max(0, e.weight), 0);
  if (total <= 0) return pool[0]?.id ?? "tu-civilian-cannon";
  let r = Math.random() * total;
  for (const entry of pool) {
    r -= Math.max(0, entry.weight);
    if (r <= 0) return entry.id;
  }
  return pool[pool.length - 1]?.id ?? "tu-civilian-cannon";
}

function dangerForWreckType(type: string): number {
  const def = ENEMY_DEFS[type];
  if (!def) return 1;
  return Math.max(1, Math.min(12, Math.round((def.baseHp + (def.shield ?? 0) + def.credits) / 24)));
}

export function rollWreckSalvage(
  salvagePool: WreckSalvageEntry[] | undefined,
  rollBonus: number,
  danger: number = 1,
): SalvageDrop[] {
  const drops: SalvageDrop[] = [];
  drops.push({ kind: "loot", payload: "scrap", qty: 1 + Math.floor(Math.random() * 2) });
  if (Math.random() < C.ECONOMY.SALVAGE.intactPartBaseChance + rollBonus) {
    drops.push({ kind: "loot", payload: "intact-part", qty: 1 + (Math.random() < C.ECONOMY.SALVAGE.intactPartExtraChance ? 1 : 0) });
  }
  if (salvagePool?.length && Math.random() < C.ECONOMY.SALVAGE.moduleDropBaseChance + rollBonus * C.ECONOMY.SALVAGE.moduleDropRollBonusMultiplier) {
    const pool = playerWeaponSalvagePool(salvagePool);
    const modId = selectWeightedModuleId(pool);
    const itemLevel = Math.max(1, Math.round(danger));
    drops.push({ kind: "module", payload: modId, qty: 1, instance: generateModuleInstance(modId, itemLevel, danger) });
  }
  return drops;
}

function spawnPieceDestructionFx(piece: WreckPiece) {
  const sparks = C.ECONOMY.PIECE_DESTRUCTION.sparks;
  for (let i = 0; i < sparks; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = C.ECONOMY.PIECE_DESTRUCTION.speedMin + Math.random() * (C.ECONOMY.PIECE_DESTRUCTION.speedMax - C.ECONOMY.PIECE_DESTRUCTION.speedMin);
    addParticle({
      x: piece.x,
      y: piece.y,
      vx: Math.cos(a) * sp + piece.vx * C.ECONOMY.PIECE_DESTRUCTION.velocityInheritance,
      vy: Math.sin(a) * sp + piece.vy * C.ECONOMY.PIECE_DESTRUCTION.velocityInheritance,
      r: C.ECONOMY.PIECE_DESTRUCTION.radiusMin + Math.random() * (C.ECONOMY.PIECE_DESTRUCTION.radiusMax - C.ECONOMY.PIECE_DESTRUCTION.radiusMin),
      life: C.ECONOMY.PIECE_DESTRUCTION.lifeMin + Math.random() * C.ECONOMY.PIECE_DESTRUCTION.lifeMax,
      drag: C.ECONOMY.PIECE_DESTRUCTION.drag,
      decay: C.ECONOMY.PIECE_DESTRUCTION.decay,
      color: i % 2 === 0 ? "#9fffe5" : "#88ffd9",
    });
  }
  addShockwave({
    x: piece.x,
    y: piece.y,
    maxRadius: C.ECONOMY.PIECE_DESTRUCTION.shockwaveRadius,
    life: C.ECONOMY.PIECE_DESTRUCTION.shockwaveLife,
    color: "#00e8c8",
    width: C.ECONOMY.PIECE_DESTRUCTION.shockwaveWidth,
  });
}

function destroyWreckPiece(piece: WreckPiece) {
  const idx = getState().wreckPieces.indexOf(piece);
  if (idx === -1) return;

  const stats = getStats();
  const rollBonus = stats?.salvageBonus ?? 0;
  const drops = rollWreckSalvage(piece.salvagePool, rollBonus, dangerForWreckType(piece.type));

  for (let i = 0; i < drops.length; i++) {
    const d = drops[i];
    const a = Math.random() * Math.PI * 2;
    const sp = C.ECONOMY.SALVAGE_PICKUP.speedMin + Math.random() * (C.ECONOMY.SALVAGE_PICKUP.speedMax - C.ECONOMY.SALVAGE_PICKUP.speedMin);
    addSalvagePickup({
      x: piece.x,
      y: piece.y,
      vx: piece.vx * C.ECONOMY.SALVAGE_PICKUP.velocityInheritance + Math.cos(a) * sp,
      vy: piece.vy * C.ECONOMY.SALVAGE_PICKUP.velocityInheritance + Math.sin(a) * sp,
      life: PICKUP_LIFE_S,
      bob: Math.random() * Math.PI * 2,
      kind: d.kind,
      payload: d.payload,
      qty: d.qty,
      instance: d.instance,
    });
  }

  spawnPieceDestructionFx(piece);
  sfxWreckPieceDestroy(piece.x, piece.y);
  if (getState().salvager?.targetPieceId === piece.id) {
    SalvagerAccess.update({ active: false, targetPieceId: null });
  }
  removeWreckPiece(idx);
}

export function damageWreckPiece(piece: WreckPiece, dmg: number) {
  if (piece.hp <= 0) return;
  piece.hp = Math.max(0, piece.hp - dmg);
  piece.hitFlash = 0.18;
  if (piece.hp <= 0) destroyWreckPiece(piece);
}
