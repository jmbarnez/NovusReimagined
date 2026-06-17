import type { Enemy } from "../types/enemy.js";
import { ENEMY_DEFS } from "../data/enemies.js";
import {
  addParticle,
  addSalvagePickup,
  addShockwave,
  addWreckPiece,
} from "../utils/entities.js";
import { C } from "../config/index.js";

const PIECE_DESPAWN_S = C.ECONOMY.WRECK.pieceDespawnSeconds;
export const PICKUP_LIFE_S = C.ECONOMY.WRECK.pickupLifeSeconds;

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
    ? [0, Math.floor(n / 4), Math.floor(n / 2), Math.floor((3 * n) / 4), n]
    : n >= 8
    ? [0, Math.floor(n / 3), Math.floor((2 * n) / 3), n]
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

function spawnExplosionFx(x: number, y: number, sigR: number) {
  const sparks = C.ECONOMY.EXPLOSION.sparksBase + Math.floor(sigR * C.ECONOMY.EXPLOSION.sparksPerSigRadius);
  for (let i = 0; i < sparks; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = C.ECONOMY.EXPLOSION.speedMin + Math.random() * (C.ECONOMY.EXPLOSION.speedMax - C.ECONOMY.EXPLOSION.speedMin);
    addParticle({
      x,
      y,
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
    x,
    y,
    maxRadius: C.ECONOMY.EXPLOSION.shockwaveRadiusBase + sigR * C.ECONOMY.EXPLOSION.shockwaveRadiusPerSigRadius,
    life: C.ECONOMY.EXPLOSION.shockwaveLife,
    color: "#ffb060",
    width: C.ECONOMY.EXPLOSION.shockwaveWidth,
  });
}

export function spawnWreck(enemy: Enemy, _p?: import("../state.js").Player) {
  if (!enemy || typeof enemy.x !== "number" || typeof enemy.y !== "number") return;
  const def = ENEMY_DEFS[enemy.type as string];
  const sigR = def?.sigRadius ?? 25;
  const credits = typeof enemy.credits === "number" ? enemy.credits : 0;

  const lootContents: Record<string, number> = {};
  for (const [k, chance] of Object.entries(enemy.loot ?? {})) {
    if (Math.random() < (chance as number)) {
      lootContents[k] = 1 + Math.floor(Math.random() * 2);
    }
  }
  if (Math.random() < C.ECONOMY.LOOT.intactPartChance) {
    lootContents["intact-part"] = 1 + Math.floor(Math.random() * C.ECONOMY.LOOT.intactPartQtyMax);
  }

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

  const creditSplit = C.ECONOMY.CREDITS.wreckSplitRatio;
  const wreckCredits = Math.floor(credits * (1 - creditSplit));
  const scatterCredits = credits - wreckCredits;

  if (scatterCredits > 0) {
    const nPickups = Math.min(
      C.ECONOMY.CREDITS.scatterMaxPickups,
      Math.max(C.ECONOMY.CREDITS.scatterMinPickups, Math.ceil(scatterCredits / C.ECONOMY.CREDITS.scatterPerPickupFloor)),
    );
    const perPickup = Math.floor(scatterCredits / nPickups);
    const remainder = scatterCredits - perPickup * nPickups;
    for (let i = 0; i < nPickups; i++) {
      const ang = Math.random() * Math.PI * 2;
      const d = C.ECONOMY.CREDIT_PICKUP.scatterDistanceMin + Math.random() * (C.ECONOMY.CREDIT_PICKUP.scatterDistanceMax - C.ECONOMY.CREDIT_PICKUP.scatterDistanceMin);
      addSalvagePickup({
        x: enemy.x + Math.cos(ang) * d,
        y: enemy.y + Math.sin(ang) * d,
        vx:
          (enemy.vx || 0) * C.ECONOMY.CREDIT_PICKUP.scatterVelocityInheritance +
          Math.cos(ang) * (C.ECONOMY.CREDIT_PICKUP.scatterSpeedMin + Math.random() * (C.ECONOMY.CREDIT_PICKUP.scatterSpeedMax - C.ECONOMY.CREDIT_PICKUP.scatterSpeedMin)),
        vy:
          (enemy.vy || 0) * C.ECONOMY.CREDIT_PICKUP.scatterVelocityInheritance +
          Math.sin(ang) * (C.ECONOMY.CREDIT_PICKUP.scatterSpeedMin + Math.random() * (C.ECONOMY.CREDIT_PICKUP.scatterSpeedMax - C.ECONOMY.CREDIT_PICKUP.scatterSpeedMin)),
        life: PICKUP_LIFE_S,
        bob: Math.random() * Math.PI * 2,
        kind: "credits",
        payload: "credits",
        qty: perPickup + (i < remainder ? 1 : 0),
      });
    }
  }

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
    const tx = -worldDy;
    const ty = worldDx;
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
