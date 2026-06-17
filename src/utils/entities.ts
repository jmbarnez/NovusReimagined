/**
 * Centralized entity lifecycle helpers.
 * All simulation entities (bullets, beams, particles, etc.) must be created
 * and destroyed through these helpers — never by direct array push/splice.
 *
 * Every entity receives a unique numeric ID for network sync and debugging.
 *
 * High-churn types (bullets, particles, beams, etc.) use object pooling via
 * src/utils/pool.ts to eliminate per-spawn GC pressure.
 */
import { _G } from "../state.js";
import type { Player } from "../state.js";
import type { DamageProfile, WeaponDelivery } from "../data/modules.js";
import type { Enemy } from "../types/enemy.js";
import type { WreckPiece, SalvagePickup } from "../types/system.js";
import type { ModuleInstance } from "../types/moduleInstance.js";
import { createPool } from "./pool.js";

let _nextId = 1;
function generateId(): number { return _nextId++; }

// ── Object pools for high-churn ephemeral entities ───────────────────────────

const bulletPool = createPool<Bullet>(2048);
const enemyBulletPool = createPool<EnemyBullet>(1024);
const beamPool = createPool<Beam>(512);
const particlePool = createPool<Particle>(4096);
const shockwavePool = createPool<Shockwave>(256);
const floatTextPool = createPool<FloatText>(512);
const trailPool = createPool<Trail>(2048);
const impactDecalPool = createPool<ImpactDecal>(512);

/** Exposed for tests that assert pool reuse. */
export function _getBulletPoolSize(): number { return bulletPool.size(); }
export function _getEnemyBulletPoolSize(): number { return enemyBulletPool.size(); }
export function _getParticlePoolSize(): number { return particlePool.size(); }

export function clearSimulationEntities() {
  bulletPool.releaseAll(_G.bullets);
  _G.bullets.length = 0;
  enemyBulletPool.releaseAll(_G.enemyBullets);
  _G.enemyBullets.length = 0;
  beamPool.releaseAll(_G.beams);
  _G.beams.length = 0;
  particlePool.releaseAll(_G.particles);
  _G.particles.length = 0;
  shockwavePool.releaseAll(_G.shockwaves);
  _G.shockwaves.length = 0;
  floatTextPool.releaseAll(_G.floatTexts);
  _G.floatTexts.length = 0;
  trailPool.releaseAll(_G.trails);
  _G.trails.length = 0;
  _G.wreckPieces.length = 0;
  _G.salvagePickups.length = 0;
  impactDecalPool.releaseAll(_G.impactDecals);
  _G.impactDecals.length = 0;
}

// ── Bullets ────────────────────────────────────────────────────────────────

/**
 * Bullets are fired by the player, enemies, and station turrets — owner
 * narrows to whichever produced the shot. `null` is allowed to keep tests
 * and headless construction simple.
 */
export type BulletOwner = Player | Enemy | "station" | null;

export interface Bullet {
  id: number;
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  life: number;
  dmg: number;
  color: string;
  sz: number;
  trail: string | null;
  owner: BulletOwner;
  kind: WeaponDelivery | null;
  weaponId: string | null;
  hitChance: number;
  targetId?: string | null;
  homingTurnRate?: number;
  accel?: number;
  maxSpeed?: number;
  dmgProfile?: DamageProfile;
  age?: number;
}

export function addBullet(data: Omit<Bullet, "id" | "hitChance"> & { id?: number; hitChance?: number }) {
  const { id, hitChance = 1, ...rest } = data;
  const b = bulletPool.acquire();
  b.id = id ?? generateId();
  b.hitChance = hitChance;
  b.age = 0;
  b.x = rest.x;
  b.y = rest.y;
  b.px = rest.px;
  b.py = rest.py;
  b.vx = rest.vx;
  b.vy = rest.vy;
  b.life = rest.life;
  b.dmg = rest.dmg;
  b.color = rest.color;
  b.sz = rest.sz;
  b.trail = rest.trail;
  b.owner = rest.owner;
  b.kind = rest.kind;
  b.weaponId = rest.weaponId;
  // Reset optional fields to prevent stale values from pooled reuse
  b.targetId = rest.targetId ?? null;
  b.homingTurnRate = rest.homingTurnRate;
  b.accel = rest.accel;
  b.maxSpeed = rest.maxSpeed;
  b.dmgProfile = rest.dmgProfile;
  _G.bullets.push(b);
}

// ── Enemy Bullets ──────────────────────────────────────────────────────────

export interface EnemyBullet {
  id: number;
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  life: number;
  dmg: number;
  color: string;
  sz: number;
  trail: string | null;
  ownerFaction?: "hostile" | "neutral" | "player" | "friendly";
  ownerId?: string;
  kind?: string | null;
  age?: number;
}

export function addEnemyBullet(data: Omit<EnemyBullet, "id"> & { id?: number }) {
  const { id, ...rest } = data;
  const b = enemyBulletPool.acquire();
  b.id = id ?? generateId();
  b.age = 0;
  b.x = rest.x;
  b.y = rest.y;
  b.px = rest.px;
  b.py = rest.py;
  b.vx = rest.vx;
  b.vy = rest.vy;
  b.life = rest.life;
  b.dmg = rest.dmg;
  b.color = rest.color;
  b.sz = rest.sz;
  b.trail = rest.trail;
  // Reset optional fields
  b.ownerFaction = rest.ownerFaction;
  b.ownerId = rest.ownerId;
  b.kind = rest.kind;
  _G.enemyBullets.push(b);
}

// ── Beams ──────────────────────────────────────────────────────────────────

export interface Beam {
  id: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
  life: number;
}

export function addBeam({ x1, y1, x2, y2, color, width, life }: Omit<Beam, "id">) {
  const b = beamPool.acquire();
  b.id = generateId();
  b.x1 = x1; b.y1 = y1;
  b.x2 = x2; b.y2 = y2;
  b.color = color;
  b.width = width;
  b.life = life;
  _G.beams.push(b);
}

// ── Particles ──────────────────────────────────────────────────────────────

export interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  vx?: number;
  vy?: number;
  r?: number;
  life?: number;
  drag?: number;
  decay?: number;
}

export type ParticleConfig = Omit<Particle, "id">;

export function addParticle(p: ParticleConfig) {
  const pt = particlePool.acquire();
  pt.id = generateId();
  pt.x = p.x; pt.y = p.y; pt.color = p.color;
  pt.vx = p.vx; pt.vy = p.vy;
  pt.r = p.r; pt.life = p.life;
  pt.drag = p.drag; pt.decay = p.decay;
  _G.particles.push(pt);
}

// ── Float Texts ────────────────────────────────────────────────────────────

export interface FloatText {
  id: number;
  x: number;
  y: number;
  text: string;
  color?: string;
  bgColor?: string;
  life?: number;
  vy?: number;
}

export type FloatTextConfig = Omit<FloatText, "id">;

export function addFloatText(ft: FloatTextConfig) {
  const f = floatTextPool.acquire();
  f.id = generateId();
  f.x = ft.x; f.y = ft.y; f.text = ft.text;
  f.color = ft.color; f.bgColor = ft.bgColor;
  f.life = ft.life; f.vy = ft.vy;
  _G.floatTexts.push(f);
}

// ── Wreck Pieces & Salvage (not pooled — lower churn) ──────────────────────

export type WreckPieceConfig = Partial<WreckPiece> & { x: number; y: number };

export function addWreckPiece(piece: WreckPieceConfig) {
  if (!piece.id) piece.id = `piece-${generateId()}`;
  _G.wreckPieces.push(piece as WreckPiece);
}

export function removeWreckPiece(index: number) {
  _G.wreckPieces.splice(index, 1);
}

export type SalvagePickupConfig = Partial<SalvagePickup> & { x: number; y: number; kind: SalvagePickup["kind"]; payload: string; instance?: ModuleInstance };

export function addSalvagePickup(pickup: SalvagePickupConfig) {
  if (!pickup.id) pickup.id = `salv-${generateId()}`;
  _G.salvagePickups.push(pickup as SalvagePickup);
}

export function removeSalvagePickup(index: number) {
  _G.salvagePickups.splice(index, 1);
}

// ── Tick-and-cull helper ───────────────────────────────────────────────────

/**
 * Iterates a list in reverse, calls perTick for each item, and splices out
 * items when perTick returns true. Reverse iteration keeps splice indices valid.
 */
export function tickAndCull<T>(
  list: T[],
  dt: number,
  perTick: (item: T, dt: number, idx: number) => boolean | void,
  remove: (idx: number) => void,
): void {
  for (let i = list.length - 1; i >= 0; i--) {
    if (perTick(list[i], dt, i) === true) remove(i);
  }
}

// ── Shockwaves ─────────────────────────────────────────────────────────────

export interface Shockwave {
  id: number;
  x: number;
  y: number;
  maxRadius: number;
  radius: number;
  life: number;
  maxLife: number;
  color: string;
  width: number;
}

export interface ShockwaveConfig {
  x: number;
  y: number;
  maxRadius: number;
  life: number;
  color: string;
  width: number;
}

export function addShockwave({ x, y, maxRadius, life, color, width }: ShockwaveConfig) {
  const s = shockwavePool.acquire();
  s.id = generateId();
  s.x = x; s.y = y;
  s.maxRadius = maxRadius;
  s.radius = 0;
  s.life = life;
  s.maxLife = life;
  s.color = color;
  s.width = width;
  _G.shockwaves.push(s);
}

// ── Trails ─────────────────────────────────────────────────────────────────

export interface Trail {
  id: number;
  x: number;
  y: number;
  color: string;
  width: number;
  length?: number;
  life: number;
  maxLife: number;
  angle?: number;
  boost?: boolean;
}

export interface TrailConfig {
  x: number;
  y: number;
  color: string;
  width: number;
  length?: number;
  life?: number;
  angle?: number;
  boost?: boolean;
}

export function addTrailSegment({ x, y, color, width, length, life = 1.0, angle, boost }: TrailConfig) {
  const t = trailPool.acquire();
  t.id = generateId();
  t.x = x; t.y = y;
  t.color = color; t.width = width;
  t.length = length;
  t.life = life; t.maxLife = life;
  t.angle = angle; t.boost = boost;
  _G.trails.push(t);
}

// ── Removal helpers (swap-and-pop + pool release) ──────────────────────────

export function removeBullet(index: number) {
  const arr = _G.bullets;
  const lastIdx = arr.length - 1;
  const dead = arr[index];
  if (index < lastIdx) {
    arr[index] = arr[lastIdx]!;
  }
  arr.length--;
  bulletPool.release(dead);
}

export function removeEnemyBullet(index: number) {
  const arr = _G.enemyBullets;
  const lastIdx = arr.length - 1;
  const dead = arr[index];
  if (index < lastIdx) {
    arr[index] = arr[lastIdx]!;
  }
  arr.length--;
  enemyBulletPool.release(dead);
}

// ── Update helpers (swap-and-pop compaction + pool release) ────────────────

export function updateBeams(dt: number) {
  let w = 0;
  const arr = _G.beams;
  for (let i = 0; i < arr.length; i++) {
    const b = arr[i];
    b.life -= dt * 3;
    if (b.life > 0) {
      arr[w++] = b;
    } else {
      beamPool.release(b);
    }
  }
  arr.length = w;
}

export function updateParticles(dt: number) {
  let w = 0;
  const arr = _G.particles;
  for (let i = 0; i < arr.length; i++) {
    const p = arr[i];
    p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt;
    const drag = p.drag ?? 0.96;
    p.vx = (p.vx || 0) * drag; p.vy = (p.vy || 0) * drag;
    p.life = (p.life ?? 0) - dt * (p.decay || 1.0);
    if (p.life > 0) {
      arr[w++] = p;
    } else {
      particlePool.release(p);
    }
  }
  arr.length = w;
}

export function updateShockwaves(dt: number) {
  let w = 0;
  const arr = _G.shockwaves;
  for (let i = 0; i < arr.length; i++) {
    const s = arr[i];
    const progress = 1 - s.life / s.maxLife;
    s.radius = s.maxRadius * progress;
    s.life -= dt;
    if (s.life > 0) {
      arr[w++] = s;
    } else {
      shockwavePool.release(s);
    }
  }
  arr.length = w;
}

export function updateFloatTexts(dt: number) {
  let w = 0;
  const arr = _G.floatTexts;
  for (let i = 0; i < arr.length; i++) {
    const f = arr[i];
    f.y -= 20 * dt;
    f.life = (f.life ?? 0) - dt;
    if (f.life > 0) {
      arr[w++] = f;
    } else {
      floatTextPool.release(f);
    }
  }
  arr.length = w;
}

export function updateTrails(dt: number) {
  let w = 0;
  const arr = _G.trails;
  for (let i = 0; i < arr.length; i++) {
    const t = arr[i];
    t.life -= dt;
    if (t.life > 0) {
      arr[w++] = t;
    } else {
      trailPool.release(t);
    }
  }
  arr.length = w;
}

// ── Impact Decals ──────────────────────────────────────────────────────────

export interface ImpactDecal {
  id: number;
  x: number;
  y: number;
  poly: number[][];
  color: string;
  life: number;
  maxLife: number;
}

export interface ImpactDecalConfig {
  x: number;
  y: number;
  poly: number[][];
  color: string;
  life: number;
  maxLife: number;
}

export function addImpactDecal(cfg: ImpactDecalConfig) {
  const d = impactDecalPool.acquire();
  d.id = generateId();
  d.x = cfg.x; d.y = cfg.y;
  d.poly = cfg.poly;
  d.color = cfg.color;
  d.life = cfg.life;
  d.maxLife = cfg.maxLife;
  _G.impactDecals.push(d);
}

export function removeImpactDecal(index: number) {
  const arr = _G.impactDecals;
  const lastIdx = arr.length - 1;
  const dead = arr[index];
  if (index < lastIdx) {
    arr[index] = arr[lastIdx]!;
  }
  arr.length--;
  impactDecalPool.release(dead);
}

/** True when a lockable target (enemy/asteroid/wreck) is gone. Respects the
 *  structure layer — an enemy with hull at 0 but structure left is still alive. */
export function isTargetDestroyed(t: { alive?: boolean; depleted?: boolean; hp?: number; structure?: number } | null | undefined): boolean {
  if (!t) return true;
  return t.alive === false
      || t.depleted === true
      || ((t.hp ?? 0) <= 0 && (t.structure ?? 0) <= 0);
}
