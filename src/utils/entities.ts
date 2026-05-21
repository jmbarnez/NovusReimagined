/**
 * Centralized entity lifecycle helpers.
 * All simulation entities (bullets, beams, particles, etc.) must be created
 * and destroyed through these helpers — never by direct array push/splice.
 *
 * Every entity receives a unique numeric ID for network sync and debugging.
 */
import { G } from "../state.js";
import type { Player } from "../state.js";
import type { WeaponDelivery } from "../data/modules.js";
import type { Enemy, WreckPiece, SalvagePickup } from "../types/world.js";
import type { ModuleInstance } from "../types/moduleInstance.js";

let _nextId = 1;
function generateId(): number { return _nextId++; }

export function clearSimulationEntities() {
  G.bullets.length = 0;
  G.enemyBullets.length = 0;
  G.beams.length = 0;
  G.particles.length = 0;
  G.shockwaves.length = 0;
  G.floatTexts.length = 0;
  G.trails.length = 0;
  G.wreckPieces.length = 0;
  G.salvagePickups.length = 0;
  G.impactDecals.length = 0;
}

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
}

export function addBullet(data: Omit<Bullet, "id" | "hitChance"> & { hitChance?: number }) {
  const { x, y, px, py, vx, vy, life, dmg, color, sz, trail, owner, kind, weaponId, hitChance = 1 } = data;
  G.bullets.push({ id: generateId(), x, y, px, py, vx, vy, life, dmg, color, sz, trail, owner, kind, weaponId, hitChance });
}

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
}

export function addEnemyBullet({ x, y, px, py, vx, vy, life, dmg, color, sz, trail }: Omit<EnemyBullet, "id">) {
  G.enemyBullets.push({ id: generateId(), x, y, px, py, vx, vy, life, dmg, color, sz, trail });
}

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
  G.beams.push({ id: generateId(), x1, y1, x2, y2, color, width, life });
}

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
  G.particles.push({ id: generateId(), ...p });
}

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
  G.floatTexts.push({ id: generateId(), ...ft });
}

export type WreckPieceConfig = Partial<WreckPiece> & { x: number; y: number };

export function addWreckPiece(piece: WreckPieceConfig) {
  if (!piece.id) piece.id = `piece-${generateId()}`;
  G.wreckPieces.push(piece as WreckPiece);
}

export function removeWreckPiece(index: number) {
  G.wreckPieces.splice(index, 1);
}

export type SalvagePickupConfig = Partial<SalvagePickup> & { x: number; y: number; kind: SalvagePickup["kind"]; payload: string; instance?: ModuleInstance };

export function addSalvagePickup(pickup: SalvagePickupConfig) {
  if (!pickup.id) pickup.id = `salv-${generateId()}`;
  G.salvagePickups.push(pickup as SalvagePickup);
}

export function removeSalvagePickup(index: number) {
  G.salvagePickups.splice(index, 1);
}

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
  G.shockwaves.push({ id: generateId(), x, y, maxRadius, radius: 0, life, maxLife: life, color, width });
}

export interface Trail {
  id: number;
  x: number;
  y: number;
  color: string;
  width: number;
  life: number;
  maxLife: number;
  angle?: number;
}

export interface TrailConfig {
  x: number;
  y: number;
  color: string;
  width: number;
  life?: number;
  angle?: number;
}

export function addTrailSegment({ x, y, color, width, life = 1.0, angle }: TrailConfig) {
  G.trails.push({ id: generateId(), x, y, color, width, life, maxLife: life, angle });
}

export function removeBullet(index: number) {
  G.bullets.splice(index, 1);
}

export function removeEnemyBullet(index: number) {
  G.enemyBullets.splice(index, 1);
}

export function updateBeams(dt: number) {
  let w = 0;
  for (let i = 0; i < G.beams.length; i++) {
    const b = G.beams[i];
    b.life -= dt * 3;
    if (b.life > 0) G.beams[w++] = b;
  }
  G.beams.length = w;
}

export function updateParticles(dt: number) {
  let w = 0;
  for (let i = 0; i < G.particles.length; i++) {
    const p = G.particles[i];
    p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt;
    const drag = p.drag ?? 0.96;
    p.vx = (p.vx || 0) * drag; p.vy = (p.vy || 0) * drag;
    p.life = (p.life ?? 0) - dt * (p.decay || 1.0);
    if (p.life > 0) G.particles[w++] = p;
  }
  G.particles.length = w;
}

export function updateShockwaves(dt: number) {
  let w = 0;
  for (let i = 0; i < G.shockwaves.length; i++) {
    const s = G.shockwaves[i];
    const progress = 1 - s.life / s.maxLife;
    s.radius = s.maxRadius * progress;
    s.life -= dt;
    if (s.life > 0) G.shockwaves[w++] = s;
  }
  G.shockwaves.length = w;
}

export function updateFloatTexts(dt: number) {
  let w = 0;
  for (let i = 0; i < G.floatTexts.length; i++) {
    const f = G.floatTexts[i];
    f.y -= 20 * dt;
    f.life = (f.life ?? 0) - dt;
    if (f.life > 0) G.floatTexts[w++] = f;
  }
  G.floatTexts.length = w;
}

export function updateTrails(dt: number) {
  let w = 0;
  for (let i = 0; i < G.trails.length; i++) {
    const t = G.trails[i];
    t.life -= dt;
    if (t.life > 0) G.trails[w++] = t;
  }
  G.trails.length = w;
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
  G.impactDecals.push({ id: generateId(), ...cfg });
}

export function removeImpactDecal(index: number) {
  G.impactDecals.splice(index, 1);
}

/** True when a lockable target (enemy/asteroid/wreck) is gone. Respects the
 *  structure layer — an enemy with hull at 0 but structure left is still alive. */
export function isTargetDestroyed(t: { alive?: boolean; depleted?: boolean; hp?: number; structure?: number }): boolean {
  return t.alive === false
      || t.depleted === true
      || ((t.hp ?? 0) <= 0 && (t.structure ?? 0) <= 0);
}
