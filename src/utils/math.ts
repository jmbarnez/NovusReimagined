import { TAU, COLLISION_BUFFER } from "../constants.js";

let activeRng: (() => number) | null = null;

export function setActiveRng(rng: (() => number) | null) {
  activeRng = rng;
}

export function random(): number {
  return activeRng ? activeRng() : Math.random();
}

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

/** Wrap an angle into the range [0, TAU). */
export function normalizeAngle(a: number): number {
  const r = a % TAU;
  return r < 0 ? r + TAU : r;
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

export function pointInPolygon(px: number, py: number, poly: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const intersect = ((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Find the closest point on a polygon's edges to (px, py). */
export function closestPointOnPolygon(px: number, py: number, poly: number[][]): { x: number; y: number; dist: number } {
  let bestX = 0, bestY = 0, bestDistSq = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length;
    const ax = poly[i][0], ay = poly[i][1];
    const bx = poly[j][0], by = poly[j][1];
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq > 0 ? ((px - ax) * dx + (py - ay) * dy) / lenSq : 0;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    const dSq = (px - cx) * (px - cx) + (py - cy) * (py - cy);
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      bestX = cx;
      bestY = cy;
    }
  }
  return { x: bestX, y: bestY, dist: Math.sqrt(bestDistSq) };
}

export function segmentsIntersect(
  ax1: number, ay1: number, ax2: number, ay2: number,
  bx1: number, by1: number, bx2: number, by2: number,
): boolean {
  const d1 = (bx2 - bx1) * (ay1 - by1) - (by2 - by1) * (ax1 - bx1);
  const d2 = (bx2 - bx1) * (ay2 - by1) - (by2 - by1) * (ax2 - bx1);
  const d3 = (ax2 - ax1) * (by1 - ay1) - (ay2 - ay1) * (bx1 - ax1);
  const d4 = (ax2 - ax1) * (by2 - ay1) - (ay2 - ay1) * (bx2 - ax1);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  if (d1 === 0 && onSegment(ax1, ay1, bx1, by1, bx2, by2)) return true;
  if (d2 === 0 && onSegment(ax2, ay2, bx1, by1, bx2, by2)) return true;
  if (d3 === 0 && onSegment(bx1, by1, ax1, ay1, ax2, ay2)) return true;
  if (d4 === 0 && onSegment(bx2, by2, ax1, ay1, ax2, ay2)) return true;
  return false;
}

function onSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): boolean {
  return Math.min(ax, bx) <= px && px <= Math.max(ax, bx) && Math.min(ay, by) <= py && py <= Math.max(ay, by);
}

export function polygonsIntersect(polyA: number[][], polyB: number[][]): boolean {
  for (let i = 0; i < polyA.length; i++) {
    const [x, y] = polyA[i];
    if (pointInPolygon(x, y, polyB)) return true;
  }
  for (let i = 0; i < polyB.length; i++) {
    const [x, y] = polyB[i];
    if (pointInPolygon(x, y, polyA)) return true;
  }
  for (let i = 0; i < polyA.length; i++) {
    const a1 = polyA[i];
    const a2 = polyA[(i + 1) % polyA.length];
    for (let j = 0; j < polyB.length; j++) {
      const b1 = polyB[j];
      const b2 = polyB[(j + 1) % polyB.length];
      if (segmentsIntersect(a1[0], a1[1], a2[0], a2[1], b1[0], b1[1], b2[0], b2[1])) return true;
    }
  }
  return false;
}

export interface PolygonCollisionInfo {
  nx: number;
  ny: number;
  depth: number;
}

function polygonCentroid(poly: number[][]): { x: number; y: number } {
  let x = 0, y = 0;
  for (let i = 0; i < poly.length; i++) {
    x += poly[i][0];
    y += poly[i][1];
  }
  return { x: x / poly.length, y: y / poly.length };
}

/** SAT-based collision normal for two (mostly convex) polygons.
 * Returns the minimum-translation direction pointing from polyB toward polyA. */
export function polygonCollisionInfo(polyA: number[][], polyB: number[][]): PolygonCollisionInfo | null {
  if (!polygonsIntersect(polyA, polyB)) return null;

  let minOverlap = Infinity;
  let bestNx = 0;
  let bestNy = 0;

  const testPoly = (poly: number[][]) => {
    for (let i = 0; i < poly.length; i++) {
      const j = (i - 1 + poly.length) % poly.length;
      const dx = poly[i][0] - poly[j][0];
      const dy = poly[i][1] - poly[j][1];
      const len = Math.hypot(dx, dy);
      if (len < 0.001) continue;
      const ax = -dy / len;
      const ay = dx / len;

      let minA = Infinity, maxA = -Infinity;
      for (let k = 0; k < polyA.length; k++) {
        const proj = polyA[k][0] * ax + polyA[k][1] * ay;
        if (proj < minA) minA = proj;
        if (proj > maxA) maxA = proj;
      }

      let minB = Infinity, maxB = -Infinity;
      for (let k = 0; k < polyB.length; k++) {
        const proj = polyB[k][0] * ax + polyB[k][1] * ay;
        if (proj < minB) minB = proj;
        if (proj > maxB) maxB = proj;
      }

      const overlap = Math.min(maxA, maxB) - Math.max(minA, minB);
      if (overlap < 0) return null;

      if (overlap < minOverlap) {
        minOverlap = overlap;
        bestNx = ax;
        bestNy = ay;
      }
    }
    return true;
  };

  if (testPoly(polyA) === null || testPoly(polyB) === null) return null;
  if (minOverlap === Infinity) return null;

  const cA = polygonCentroid(polyA);
  const cB = polygonCentroid(polyB);
  const dx = cA.x - cB.x;
  const dy = cA.y - cB.y;
  if (bestNx * dx + bestNy * dy < 0) {
    bestNx = -bestNx;
    bestNy = -bestNy;
  }

  return { nx: bestNx, ny: bestNy, depth: minOverlap };
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
  restitution: number,
  nx?: number,
  ny?: number,
): number {
  if (dist <= 0 || !Number.isFinite(dist)) return 0;
  const overlap = minDist - dist;
  // Ignore sub-pixel overlaps entirely — prevents jitter while keeping precision.
  if (overlap <= COLLISION_BUFFER) return 0;
  const useNx = nx ?? dx / dist;
  const useNy = ny ?? dy / dist;

  const invM1 = 1 / m1;
  const invM2 = 1 / m2;
  const invSum = invM1 + invM2;

  e1.x -= useNx * overlap * (invM1 / invSum);
  e1.y -= useNy * overlap * (invM1 / invSum);
  e2.x += useNx * overlap * (invM2 / invSum);
  e2.y += useNy * overlap * (invM2 / invSum);

  const e1vx = e1.vx || 0;
  const e1vy = e1.vy || 0;
  const e2vx = e2.vx || 0;
  const e2vy = e2.vy || 0;

  const closing = (e1vx - e2vx) * useNx + (e1vy - e2vy) * useNy;
  if (closing > 0) {
    const j = (1 + restitution) * closing / invSum;
    e1.vx = e1vx - (j / m1) * useNx;
    e1.vy = e1vy - (j / m1) * useNy;
    e2.vx = e2vx + (j / m2) * useNx;
    e2.vy = e2vy + (j / m2) * useNy;
  }
  return closing;
}

/** Resolve a collision where e2 is effectively immovable (e.g. player vs asteroid).
 *  Pushes e1 fully out along the normal + a separation buffer, then reflects
 *  e1's velocity with the given restitution. Returns closing speed for damage. */
export function resolveCollisionVsImmovable(
  e1: Collidable,
  nx: number,
  ny: number,
  penetration: number,
  restitution: number,
  separationBuffer = 0.5,
): number {
  if (penetration <= COLLISION_BUFFER) return 0;

  // Push e1 fully out + buffer in one frame — no jitter
  e1.x += nx * (penetration + separationBuffer);
  e1.y += ny * (penetration + separationBuffer);

  // Reflect velocity along the normal
  const e1vx = e1.vx || 0;
  const e1vy = e1.vy || 0;
  const closing = e1vx * nx + e1vy * ny;
  if (closing < 0) {
    // Ship is moving into the surface — reflect outward
    const j = (1 + restitution) * closing;
    e1.vx = e1vx - j * nx;
    e1.vy = e1vy - j * ny;
  }
  return Math.abs(closing);
}

export function rayCircleSurfaceHit(ox: number, oy: number, cx: number, cy: number, radius: number): { x: number; y: number; nx: number; ny: number } {
  const d = Math.hypot(cx - ox, cy - oy);
  if (d > 0.001) {
    const dx = (cx - ox) / d;
    const dy = (cy - oy) / d;
    return { x: cx - dx * radius, y: cy - dy * radius, nx: -dx, ny: -dy };
  }
  return { x: ox, y: oy, nx: 1, ny: 0 };
}
