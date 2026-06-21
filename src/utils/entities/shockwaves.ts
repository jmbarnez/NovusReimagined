/**
 * Shockwave lifecycle helpers. Expanding ring VFX from explosions/impacts;
 * pooled.
 */
import { _G } from "../../state.js";
import { createPool } from "../pool.js";
import { generateId } from "./id.js";

const shockwavePool = createPool<Shockwave>(256);

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
  s.x = x;
  s.y = y;
  s.maxRadius = maxRadius;
  s.radius = 0;
  s.life = life;
  s.maxLife = life;
  s.color = color;
  s.width = width;
  _G.shockwaves.push(s);
}

/** Advance shockwave expansion, cull expired ones, and release them to the pool. */
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

/** Release all live shockwaves back to the pool and clear the live array. */
export function clearShockwaves(): void {
  shockwavePool.releaseAll(_G.shockwaves);
  _G.shockwaves.length = 0;
}
