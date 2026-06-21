/**
 * Beam lifecycle helpers. Beams are short-lived visual lines (mining lasers,
 * tractor beams, weapon beams) pooled to avoid per-spawn allocation.
 */
import { _G } from "../../state.js";
import { createPool } from "../pool.js";
import { generateId } from "./id.js";

const beamPool = createPool<Beam>(512);

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
  b.x1 = x1;
  b.y1 = y1;
  b.x2 = x2;
  b.y2 = y2;
  b.color = color;
  b.width = width;
  b.life = life;
  _G.beams.push(b);
}

/** Compact dead beams (life <= 0) and release them to the pool in one pass. */
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

/** Release all live beams back to the pool and clear the live array. */
export function clearBeams(): void {
  beamPool.releaseAll(_G.beams);
  _G.beams.length = 0;
}
