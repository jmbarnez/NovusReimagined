/**
 * Particle lifecycle helpers. Particles are the highest-churn entity type
 * (sparks, debris, smoke) and use a large pool to avoid per-spawn GC.
 */
import { _G } from "../../state.js";
import { createPool } from "../pool.js";
import { generateId } from "./id.js";

const particlePool = createPool<Particle>(4096);

/** Exposed for tests that assert pool reuse. */
export function _getParticlePoolSize(): number {
  return particlePool.size();
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
  const pt = particlePool.acquire();
  pt.id = generateId();
  pt.x = p.x;
  pt.y = p.y;
  pt.color = p.color;
  pt.vx = p.vx;
  pt.vy = p.vy;
  pt.r = p.r;
  pt.life = p.life;
  pt.drag = p.drag;
  pt.decay = p.decay;
  _G.particles.push(pt);
}

/** Advance particle physics, cull dead ones, and release them to the pool. */
export function updateParticles(dt: number) {
  let w = 0;
  const arr = _G.particles;
  for (let i = 0; i < arr.length; i++) {
    const p = arr[i];
    p.x += (p.vx || 0) * dt;
    p.y += (p.vy || 0) * dt;
    const drag = p.drag ?? 0.96;
    p.vx = (p.vx || 0) * drag;
    p.vy = (p.vy || 0) * drag;
    p.life = (p.life ?? 0) - dt * (p.decay || 1.0);
    if (p.life > 0) {
      arr[w++] = p;
    } else {
      particlePool.release(p);
    }
  }
  arr.length = w;
}

/** Release all live particles back to the pool and clear the live array. */
export function clearParticles(): void {
  particlePool.releaseAll(_G.particles);
  _G.particles.length = 0;
}
