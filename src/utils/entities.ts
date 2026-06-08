/**
 * Centralized entity lifecycle helpers.
 * All simulation entities (bullets, beams, particles, etc.) must be created
 * and destroyed through these helpers — never by direct array push/splice.
 *
 * Every entity receives a unique numeric ID for network sync and debugging.
 */
import { getState } from "../state-access.js";
import type { Player } from "../state.js";
import type { DamageProfile, WeaponDelivery } from "../data/modules.js";
import type { Enemy, WreckPiece, SalvagePickup } from "../types/world.js";
import type { ModuleInstance } from "../types/moduleInstance.js";

let _nextId = 1;
function generateId(): number { return _nextId++; }

export function clearSimulationEntities() {
  getState().bullets.length = 0;
  getState().enemyBullets.length = 0;
  getState().beams.length = 0;
  getState().particles.length = 0;
  getState().shockwaves.length = 0;
  getState().floatTexts.length = 0;
  getState().trails.length = 0;
  getState().wreckPieces.length = 0;
  getState().salvagePickups.length = 0;
  getState().impactDecals.length = 0;
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
  targetId?: string | null;
  homingTurnRate?: number;
  accel?: number;
  maxSpeed?: number;
  dmgProfile?: DamageProfile;
}

export function addBullet(data: Omit<Bullet, "id" | "hitChance"> & { id?: number; hitChance?: number }) {
  const { id, hitChance = 1, ...rest } = data;
  getState().bullets.push({ id: id ?? generateId(), hitChance, ...rest });
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
  ownerFaction?: "hostile" | "neutral" | "player" | "friendly";
  ownerId?: string;
  kind?: string | null;
}

export function addEnemyBullet(data: Omit<EnemyBullet, "id"> & { id?: number }) {
  const { id, ...rest } = data;
  getState().enemyBullets.push({ id: id ?? generateId(), ...rest });
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
  getState().beams.push({ id: generateId(), x1, y1, x2, y2, color, width, life });
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
  getState().particles.push({ id: generateId(), ...p });
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
  getState().floatTexts.push({ id: generateId(), ...ft });
}

export type WreckPieceConfig = Partial<WreckPiece> & { x: number; y: number };

export function addWreckPiece(piece: WreckPieceConfig) {
  if (!piece.id) piece.id = `piece-${generateId()}`;
  getState().wreckPieces.push(piece as WreckPiece);
}

export function removeWreckPiece(index: number) {
  getState().wreckPieces.splice(index, 1);
}

export type SalvagePickupConfig = Partial<SalvagePickup> & { x: number; y: number; kind: SalvagePickup["kind"]; payload: string; instance?: ModuleInstance };

export function addSalvagePickup(pickup: SalvagePickupConfig) {
  if (!pickup.id) pickup.id = `salv-${generateId()}`;
  getState().salvagePickups.push(pickup as SalvagePickup);
}

export function removeSalvagePickup(index: number) {
  getState().salvagePickups.splice(index, 1);
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
  getState().shockwaves.push({ id: generateId(), x, y, maxRadius, radius: 0, life, maxLife: life, color, width });
}

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
  getState().trails.push({ id: generateId(), x, y, color, width, length, life, maxLife: life, angle, boost });
}

export function removeBullet(index: number) {
  getState().bullets.splice(index, 1);
}

export function removeEnemyBullet(index: number) {
  getState().enemyBullets.splice(index, 1);
}

export function updateBeams(dt: number) {
  let w = 0;
  for (let i = 0; i < getState().beams.length; i++) {
    const b = getState().beams[i];
    b.life -= dt * 3;
    if (b.life > 0) getState().beams[w++] = b;
  }
  getState().beams.length = w;
}

export function updateParticles(dt: number) {
  let w = 0;
  for (let i = 0; i < getState().particles.length; i++) {
    const p = getState().particles[i];
    p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt;
    const drag = p.drag ?? 0.96;
    p.vx = (p.vx || 0) * drag; p.vy = (p.vy || 0) * drag;
    p.life = (p.life ?? 0) - dt * (p.decay || 1.0);
    if (p.life > 0) getState().particles[w++] = p;
  }
  getState().particles.length = w;
}

export function updateShockwaves(dt: number) {
  let w = 0;
  for (let i = 0; i < getState().shockwaves.length; i++) {
    const s = getState().shockwaves[i];
    const progress = 1 - s.life / s.maxLife;
    s.radius = s.maxRadius * progress;
    s.life -= dt;
    if (s.life > 0) getState().shockwaves[w++] = s;
  }
  getState().shockwaves.length = w;
}

export function updateFloatTexts(dt: number) {
  let w = 0;
  for (let i = 0; i < getState().floatTexts.length; i++) {
    const f = getState().floatTexts[i];
    f.y -= 20 * dt;
    f.life = (f.life ?? 0) - dt;
    if (f.life > 0) getState().floatTexts[w++] = f;
  }
  getState().floatTexts.length = w;
}

export function updateTrails(dt: number) {
  let w = 0;
  for (let i = 0; i < getState().trails.length; i++) {
    const t = getState().trails[i];
    t.life -= dt;
    if (t.life > 0) getState().trails[w++] = t;
  }
  getState().trails.length = w;
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
  getState().impactDecals.push({ id: generateId(), ...cfg });
}

export function removeImpactDecal(index: number) {
  getState().impactDecals.splice(index, 1);
}

/** True when a lockable target (enemy/asteroid/wreck) is gone. Respects the
 *  structure layer — an enemy with hull at 0 but structure left is still alive. */
export function isTargetDestroyed(t: { alive?: boolean; depleted?: boolean; hp?: number; structure?: number } | null | undefined): boolean {
  if (!t) return true;
  return t.alive === false
      || t.depleted === true
      || ((t.hp ?? 0) <= 0 && (t.structure ?? 0) <= 0);
}
