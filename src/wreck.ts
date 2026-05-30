import { Client } from "./state.js";
import { SalvagerAccess, PlayerAccess, getState } from "./state-access.js";
import { dst } from "./utils/math.js";
import { floatText } from "./utils/fx.js";
import { showPickupToast } from "./feedback.js";
import { ORE, LOOT } from "./data/resources.js";
import { progressMissions } from "./data/missions.js";
import { MODULES } from "./data/modules.js";
import { generateModuleInstance } from "./loot/generateModule.js";
import { ModuleInstance } from "./types/moduleInstance.js";
import type { Enemy, WreckPiece, SalvagePickup, WreckSalvageEntry } from "./types/world.js";
import { ENEMY_DEFS } from "./data/enemies.js";
import { invalidateInstanceCache } from "./utils/items.js";
import { getStats } from "./player/player-stats.js";
import {
  addWreckPiece,
  addSalvagePickup,
  removeWreckPiece,
  removeSalvagePickup,
  addParticle,
  addShockwave,
  tickAndCull,
} from "./utils/entities.js";
import { sfxCreditPickup, sfxItemPickup, sfxWreckPieceDestroy } from "./audio/procedural.js";
import { removeSensorLock } from "./targeting.js";
import { WRECK_PIECE_LINEAR_DRAG, WRECK_PIECE_ANGULAR_DRAG, SALVAGE_PICKUP_DRAG, TAU } from "./constants.js";
import { C } from "./config/index.js";

const WRECK_DESPAWN_S = C.ECONOMY.WRECK.despawnSeconds;
const PIECE_DESPAWN_S = C.ECONOMY.WRECK.pieceDespawnSeconds;
export const PICKUP_LIFE_S = C.ECONOMY.WRECK.pickupLifeSeconds;
const PICKUP_RANGE = C.ECONOMY.WRECK.pickupRange;

interface PieceShape {
  pts: [number, number][];
  cx: number;
  cy: number;
  radius: number;
}

function buildPieceShapes(path: number[][]): PieceShape[] {
  if (path.length < 3) return [];
  const n = path.length;
  const splits = n >= 11
    ? [0, Math.floor(n / 4), Math.floor(n / 2), Math.floor(3 * n / 4), n]
    : n >= 8
    ? [0, Math.floor(n / 3), Math.floor(2 * n / 3), n]
    : [0, Math.floor(n / 2), n];

  const shapes: PieceShape[] = [];
  for (let i = 0; i < splits.length - 1; i++) {
    const slice = path.slice(splits[i], splits[i + 1]) as [number, number][];
    if (slice.length < 2) continue;
    const cx = slice.reduce((s, p) => s + p[0], 0) / slice.length;
    const cy = slice.reduce((s, p) => s + p[1], 0) / slice.length;
    const pts: [number, number][] = [...slice, [0, 0]];
    const radius = Math.max(8, pts.reduce((s, p) => s + Math.hypot(p[0], p[1]), 0) / pts.length);
    shapes.push({ pts, cx, cy, radius });
  }
  return shapes;
}

export function spawnWreck(enemy: Enemy, _p?: import("./state.js").Player) {
  if (!enemy || typeof enemy.x !== "number" || typeof enemy.y !== "number") return;
  const def = ENEMY_DEFS[enemy.type as string];
  const sigR = def?.sigRadius ?? 25;
  const credits = typeof enemy.credits === "number" ? enemy.credits : 0;

  // ── Loot items scatter outward as SalvagePickups ──────────────────────────
  const lootContents: Record<string, number> = {};
  for (const [k, chance] of Object.entries(enemy.loot ?? {})) {
    if (Math.random() < (chance as number)) {
      lootContents[k] = 1 + Math.floor(Math.random() * 2);
    }
  }
  if (Math.random() < C.ECONOMY.LOOT.intactPartChance) lootContents["intact-part"] = 1 + Math.floor(Math.random() * C.ECONOMY.LOOT.intactPartQtyMax);

  for (const [key, count] of Object.entries(lootContents)) {
    const angle = Math.random() * Math.PI * 2;
    const speed = C.ECONOMY.CREDIT_PICKUP.lootSpeedMin + Math.random() * (C.ECONOMY.CREDIT_PICKUP.lootSpeedMax - C.ECONOMY.CREDIT_PICKUP.lootSpeedMin);
    addSalvagePickup({
      x: enemy.x,
      y: enemy.y,
      vx: (enemy.vx || 0) * C.ECONOMY.CREDIT_PICKUP.lootVelocityInheritance + Math.cos(angle) * speed,
      vy: (enemy.vy || 0) * C.ECONOMY.CREDIT_PICKUP.lootVelocityInheritance + Math.sin(angle) * speed,
      life: PICKUP_LIFE_S,
      bob: Math.random() * Math.PI * 2,
      kind: "loot",
      payload: key,
      qty: count as number,
    });
  }

  // ── Credits scatter as SalvagePickups ─────────────────────────────────────
  const creditSplit = C.ECONOMY.CREDITS.wreckSplitRatio;
  const wreckCredits = Math.floor(credits * (1 - creditSplit));
  const scatterCredits = credits - wreckCredits;

  if (scatterCredits > 0) {
    const nPickups = Math.min(C.ECONOMY.CREDITS.scatterMaxPickups, Math.max(C.ECONOMY.CREDITS.scatterMinPickups, Math.ceil(scatterCredits / C.ECONOMY.CREDITS.scatterPerPickupFloor)));
    const perPickup = Math.floor(scatterCredits / nPickups);
    const remainder = scatterCredits - perPickup * nPickups;
    for (let i = 0; i < nPickups; i++) {
      const ang = Math.random() * Math.PI * 2;
      const d = C.ECONOMY.CREDIT_PICKUP.scatterDistanceMin + Math.random() * (C.ECONOMY.CREDIT_PICKUP.scatterDistanceMax - C.ECONOMY.CREDIT_PICKUP.scatterDistanceMin);
      addSalvagePickup({
        x: enemy.x + Math.cos(ang) * d,
        y: enemy.y + Math.sin(ang) * d,
        vx: (enemy.vx || 0) * C.ECONOMY.CREDIT_PICKUP.scatterVelocityInheritance + Math.cos(ang) * (C.ECONOMY.CREDIT_PICKUP.scatterSpeedMin + Math.random() * (C.ECONOMY.CREDIT_PICKUP.scatterSpeedMax - C.ECONOMY.CREDIT_PICKUP.scatterSpeedMin)),
        vy: (enemy.vy || 0) * C.ECONOMY.CREDIT_PICKUP.scatterVelocityInheritance + Math.sin(ang) * (C.ECONOMY.CREDIT_PICKUP.scatterSpeedMin + Math.random() * (C.ECONOMY.CREDIT_PICKUP.scatterSpeedMax - C.ECONOMY.CREDIT_PICKUP.scatterSpeedMin)),
        life: PICKUP_LIFE_S,
        bob: Math.random() * Math.PI * 2,
        kind: "credits",
        payload: "credits",
        qty: perPickup + (i < remainder ? 1 : 0),
      });
    }
  }

  // ── Physics debris pieces exploding outward ───────────────────────────────
  const shapes = buildPieceShapes(def?.render?.path ?? []);
  const pieceMaxHp = Math.round(C.ECONOMY.WRECK_PIECE.baseHp + sigR * C.ECONOMY.WRECK_PIECE.hpPerSigRadius);
  const baseSpeed = C.ECONOMY.WRECK_PIECE.baseSpeed + sigR * C.ECONOMY.WRECK_PIECE.speedPerSigRadius;
  const enemyAngle = enemy.prevAngle ?? enemy.angle ?? 0;
  const salvagePool = def?.moduleLoot ?? [];

  for (let i = 0; i < shapes.length; i++) {
    const s = shapes[i];
    const dirLen = Math.sqrt(s.cx * s.cx + s.cy * s.cy) || 1;
    const localDx = s.cx / dirLen;
    const localDy = s.cy / dirLen;
    const cosA = Math.cos(enemyAngle);
    const sinA = Math.sin(enemyAngle);
    const worldDx = localDx * cosA - localDy * sinA;
    const worldDy = localDx * sinA + localDy * cosA;

    const speed = baseSpeed * (C.ECONOMY.WRECK_PIECE.speedVariationMin + Math.random() * C.ECONOMY.WRECK_PIECE.speedVariationMax);
    const tx = -worldDy, ty = worldDx;
    const tangScatter = (Math.random() - 0.5) * baseSpeed * C.ECONOMY.WRECK_PIECE.tangentialScatterMultiplier;

    addWreckPiece({
      x: enemy.x,
      y: enemy.y,
      vx: (enemy.vx || 0) * C.ECONOMY.WRECK_PIECE.velocityInheritance + worldDx * speed + tx * tangScatter,
      vy: (enemy.vy || 0) * C.ECONOMY.WRECK_PIECE.velocityInheritance + worldDy * speed + ty * tangScatter,
      angle: enemyAngle + (Math.random() - 0.5) * C.ECONOMY.WRECK_PIECE.angleVariation,
      angularVel: (Math.random() - 0.5) * C.ECONOMY.WRECK_PIECE.angularVelMax,
      pts: s.pts,
      radius: s.radius,
      type: enemy.type,
      name: `${enemy.name} debris`,
      hp: pieceMaxHp,
      maxHp: pieceMaxHp,
      age: 0,
      despawnTimer: PIECE_DESPAWN_S,
      salvagePool,
      bob: Math.random() * Math.PI * 2,
      hitFlash: 0,
    });
  }

  spawnExplosionFx(enemy.x, enemy.y, sigR);
}

function spawnExplosionFx(x: number, y: number, sigR: number) {
  const sparks = C.ECONOMY.EXPLOSION.sparksBase + Math.floor(sigR * C.ECONOMY.EXPLOSION.sparksPerSigRadius);
  for (let i = 0; i < sparks; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = C.ECONOMY.EXPLOSION.speedMin + Math.random() * (C.ECONOMY.EXPLOSION.speedMax - C.ECONOMY.EXPLOSION.speedMin);
    addParticle({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      r: C.ECONOMY.EXPLOSION.radiusMin + Math.random() * (C.ECONOMY.EXPLOSION.radiusMax - C.ECONOMY.EXPLOSION.radiusMin),
      life: C.ECONOMY.EXPLOSION.lifeMin + Math.random() * C.ECONOMY.EXPLOSION.lifeMax,
      drag: C.ECONOMY.EXPLOSION.drag,
      decay: C.ECONOMY.EXPLOSION.decay,
      color: i % 3 === 0 ? "#ffd06a" : i % 3 === 1 ? "#ff8044" : "#ffaa66",
    });
  }
  addShockwave({
    x, y,
    maxRadius: C.ECONOMY.EXPLOSION.shockwaveRadiusBase + sigR * C.ECONOMY.EXPLOSION.shockwaveRadiusPerSigRadius,
    life: C.ECONOMY.EXPLOSION.shockwaveLife,
    color: "#ffb060",
    width: C.ECONOMY.EXPLOSION.shockwaveWidth,
  });
}

function spawnPieceDestructionFx(piece: WreckPiece) {
  const sparks = C.ECONOMY.PIECE_DESTRUCTION.sparks;
  for (let i = 0; i < sparks; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = C.ECONOMY.PIECE_DESTRUCTION.speedMin + Math.random() * (C.ECONOMY.PIECE_DESTRUCTION.speedMax - C.ECONOMY.PIECE_DESTRUCTION.speedMin);
    addParticle({
      x: piece.x, y: piece.y,
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
    x: piece.x, y: piece.y,
    maxRadius: C.ECONOMY.PIECE_DESTRUCTION.shockwaveRadius,
    life: C.ECONOMY.PIECE_DESTRUCTION.shockwaveLife,
    color: "#00e8c8",
    width: C.ECONOMY.PIECE_DESTRUCTION.shockwaveWidth,
  });
}

export function damageWreckPiece(piece: WreckPiece, dmg: number) {
  if (piece.hp <= 0) return;
  piece.hp = Math.max(0, piece.hp - dmg);
  piece.hitFlash = 0.18;
  if (piece.hp <= 0) destroyWreckPiece(piece);
}

export type SalvageDrop = { kind: "loot" | "module"; payload: string; qty: number; instance?: ModuleInstance };

export function rollWreckSalvage(
  salvagePool: WreckSalvageEntry[] | undefined,
  rollBonus: number,
): SalvageDrop[] {
  const drops: SalvageDrop[] = [];
  drops.push({ kind: "loot", payload: "scrap", qty: 1 + Math.floor(Math.random() * 2) });
  if (Math.random() < C.ECONOMY.SALVAGE.intactPartBaseChance + rollBonus) {
    drops.push({ kind: "loot", payload: "intact-part", qty: 1 + (Math.random() < C.ECONOMY.SALVAGE.intactPartExtraChance ? 1 : 0) });
  }
  if (salvagePool?.length && Math.random() < C.ECONOMY.SALVAGE.moduleDropBaseChance + rollBonus * C.ECONOMY.SALVAGE.moduleDropRollBonusMultiplier) {
    const pool = salvagePool;
    const total = pool.reduce((s: number, e: WreckSalvageEntry) => s + e.weight, 0);
    let r = Math.random() * total;
    let modId = pool[pool.length - 1].id;
    for (const e of pool) {
      r -= e.weight;
      if (r <= 0) { modId = e.id; break; }
    }
    drops.push({ kind: "module", payload: modId, qty: 1, instance: generateModuleInstance(modId, 1, 1) });
  }
  return drops;
}

function destroyWreckPiece(piece: WreckPiece) {
  const idx = getState().wreckPieces.indexOf(piece);
  if (idx === -1) return;

  const stats = getStats();
  const rollBonus = stats?.salvageBonus ?? 0;
  const drops = rollWreckSalvage(piece.salvagePool, rollBonus);

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
  removeSensorLock(piece.id);
  if (getState().salvager?.targetPieceId === piece.id) {
    SalvagerAccess.update({ active: false, targetPieceId: null });
  }
  removeWreckPiece(idx);
}

export function updateWreckPieces(dt: number) {
  for (let i = getState().wreckPieces.length - 1; i >= 0; i--) {
    const p = getState().wreckPieces[i];
    p.age += dt;
    p.despawnTimer -= dt;
    if (p.despawnTimer <= 0) {
      removeSensorLock(p.id);
      removeWreckPiece(i);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.angle += p.angularVel * dt;
    const lin = Math.pow(WRECK_PIECE_LINEAR_DRAG, dt);
    p.vx *= lin;
    p.vy *= lin;
    p.angularVel *= Math.pow(WRECK_PIECE_ANGULAR_DRAG, dt);
    if (Math.abs(p.vx) < 0.5) p.vx = 0;
    if (Math.abs(p.vy) < 0.5) p.vy = 0;
    if (Math.abs(p.angularVel) < 0.05) p.angularVel = 0;

    p.bob += dt * 1.6;
    if (p.hitFlash > 0) p.hitFlash = Math.max(0, p.hitFlash - dt);
  }
}

export function updateSalvagePickups(dt: number) {
  const drag = Math.pow(SALVAGE_PICKUP_DRAG, dt);
  tickAndCull(getState().salvagePickups, dt, (s) => {
    s.life -= dt;
    s.bob += dt * C.ECONOMY.SALVAGE_PICKUP.bobRate;

    // Apply magnetic pull toward the player ship
    const dx = getState().player.x - s.x;
    const dy = getState().player.y - s.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 200 && dist > 0.01) {
      const forcePct = 1 - dist / 200;
      const pullForce = 520 * forcePct * forcePct + 80;
      s.vx += (dx / dist) * pullForce * dt;
      s.vy += (dy / dist) * pullForce * dt;

      // Spawn glowing vacuum trailing particles
      if (Math.random() < 0.16) {
        let sparkColor = "#ffe066";
        if (s.kind === "loot") sparkColor = "#aaffaa";
        else if (s.kind === "module") sparkColor = "#00e8c8";
        else if (s.kind === "ore") {
          sparkColor = (ORE[s.payload] ?? ORE.iron).color;
        }

        addParticle({
          x: s.x,
          y: s.y,
          vx: -s.vx * 0.35 + (Math.random() - 0.5) * 15,
          vy: -s.vy * 0.35 + (Math.random() - 0.5) * 15,
          r: 0.9 + Math.random() * 0.8,
          life: 0.22 + Math.random() * 0.16,
          drag: 0.93,
          decay: 2.8,
          color: sparkColor,
        });
      }
    }

    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vx *= drag; s.vy *= drag;

    if (s.life <= 0) return true;
    if (dst(getState().player.x, getState().player.y, s.x, s.y) < PICKUP_RANGE) {
      collectSalvagePickup(s);
      return true;
    }
  }, removeSalvagePickup);
}

function collectSalvagePickup(s: SalvagePickup) {
  if (s.kind === "ore") {
    PlayerAccess.setOre(s.payload, (getState().player.ore[s.payload] || 0) + s.qty);
    progressMissions("mining", s.qty, s.payload);
    showPickupToast("ore", s.payload, s.qty);
    sfxItemPickup("ore", s.x, s.y);
  } else if (s.kind === "loot") {
    PlayerAccess.setLoot(s.payload, (getState().player.loot[s.payload] || 0) + s.qty);
    progressMissions("salvage", s.qty, s.payload);
    showPickupToast("loot", s.payload, s.qty);
    sfxItemPickup("loot", s.x, s.y);
  } else if (s.kind === "credits") {
    PlayerAccess.modifyCredits(s.qty);
    showPickupToast("credits", "", s.qty);
    sfxCreditPickup();
  } else {
    try {
      const inst = s.instance || generateModuleInstance(s.payload, 1, 1);
      PlayerAccess.addModuleCargo(inst);
      invalidateInstanceCache();
      showPickupToast("module", s.payload, 1, inst);
      sfxItemPickup("module", s.x, s.y);
    } catch {
      // Fallback: spawn scrap instead of crashing on bad module ID
      PlayerAccess.setLoot("scrap", (getState().player.loot.scrap || 0) + 1);
      showPickupToast("loot", "scrap", 1);
    }
  }
}

export function updateWreckPiecesAndPickups(dt: number) {
  updateWreckPieces(dt);
  updateSalvagePickups(dt);
}
