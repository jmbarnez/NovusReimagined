/**
 * Bullet and enemy-bullet lifecycle helpers.
 *
 * Both are high-churn ephemeral entities and use object pooling to eliminate
 * per-spawn GC pressure. All creation/destruction must go through these
 * helpers — never direct array push/splice.
 */
import { _G } from "../../state.js";
import type { Player } from "../../state.js";
import type { DamageProfile, WeaponDelivery } from "../../data/modules.js";
import type { Enemy } from "../../types/enemy.js";
import { createPool } from "../pool.js";
import { generateId } from "./id.js";

const bulletPool = createPool<Bullet>(2048);
const enemyBulletPool = createPool<EnemyBullet>(1024);

/** Exposed for tests that assert pool reuse. */
export function _getBulletPoolSize(): number {
  return bulletPool.size();
}
/** Exposed for tests that assert pool reuse. */
export function _getEnemyBulletPoolSize(): number {
  return enemyBulletPool.size();
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

/** Release all live bullets back to the pool and clear the live array. */
export function clearBullets(): void {
  bulletPool.releaseAll(_G.bullets);
  _G.bullets.length = 0;
}

/** Release all live enemy bullets back to the pool and clear the live array. */
export function clearEnemyBullets(): void {
  enemyBulletPool.releaseAll(_G.enemyBullets);
  _G.enemyBullets.length = 0;
}

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
