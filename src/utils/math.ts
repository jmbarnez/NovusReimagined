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
