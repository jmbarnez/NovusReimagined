import { TAU } from "../constants.js";

export function randId(): string {
  return "id-" + Math.random().toString(36).slice(2, 9);
}

export function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}

/** Deterministic PRNG for procedural NPC loadouts (0..1 floats). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function mkRng(seed: string): () => number {
  return mulberry32(Math.abs(hashStr(seed)) >>> 0);
}

export function rf(f: () => number, lo: number, hi: number): number {
  return lo + f() * (hi - lo);
}

export function ri(f: () => number, lo: number, hi: number): number {
  return Math.floor(lo + f() * (hi - lo + 1));
}

export function rpick<T>(f: () => number, arr: T[]): T | undefined {
  if (!arr.length) return undefined;
  return arr[Math.floor(f() * arr.length)];
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function angleDiff(a: number, b: number): number {
  let d = ((b - a) % TAU + TAU) % TAU;
  if (d > Math.PI) d -= TAU;
  return d;
}

export function dst(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

export function aimAngle(fx: number, fy: number, tx: number, ty: number): number {
  return Math.atan2(ty - fy, tx - fx);
}

export interface Collidable {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export function resolveElasticCollision(
  e1: Collidable,
  e2: Collidable,
  m1: number,
  m2: number,
  dx: number,
  dy: number,
  dist: number,
  minDist: number,
  restitution: number
): number {
  const overlap = minDist - dist;
  const nx = dx / dist;
  const ny = dy / dist;

  const invM1 = 1 / m1;
  const invM2 = 1 / m2;
  const invSum = invM1 + invM2;

  e1.x -= nx * overlap * (invM1 / invSum);
  e1.y -= ny * overlap * (invM1 / invSum);
  e2.x += nx * overlap * (invM2 / invSum);
  e2.y += ny * overlap * (invM2 / invSum);

  const e1vx = e1.vx || 0;
  const e1vy = e1.vy || 0;
  const e2vx = e2.vx || 0;
  const e2vy = e2.vy || 0;

  const closing = (e1vx - e2vx) * nx + (e1vy - e2vy) * ny;
  if (closing > 0) {
    const j = (1 + restitution) * closing / invSum;
    e1.vx = e1vx - (j / m1) * nx;
    e1.vy = e1vy - (j / m1) * ny;
    e2.vx = e2vx + (j / m2) * nx;
    e2.vy = e2vy + (j / m2) * ny;
  }
  return closing;
}
