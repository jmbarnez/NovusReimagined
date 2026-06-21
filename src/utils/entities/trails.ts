/**
 * Engine trail segment lifecycle helpers. Short-lived line segments pooled
 * to avoid per-frame allocation during boost/thrust rendering.
 */
import { _G } from "../../state.js";
import { createPool } from "../pool.js";
import { generateId } from "./id.js";

const trailPool = createPool<Trail>(2048);

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
  t.x = x;
  t.y = y;
  t.color = color;
  t.width = width;
  t.length = length;
  t.life = life;
  t.maxLife = life;
  t.angle = angle;
  t.boost = boost;
  _G.trails.push(t);
}

/** Cull expired trail segments and release them to the pool. */
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

/** Release all live trail segments back to the pool and clear the live array. */
export function clearTrails(): void {
  trailPool.releaseAll(_G.trails);
  _G.trails.length = 0;
}
