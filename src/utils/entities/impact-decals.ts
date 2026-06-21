/**
 * Impact decal lifecycle helpers. Persistent-ish scorch/polygon decals on
 * hit surfaces; pooled.
 */
import { _G } from "../../state.js";
import { createPool } from "../pool.js";
import { generateId } from "./id.js";

const impactDecalPool = createPool<ImpactDecal>(512);

export interface ImpactDecal {
  id: number;
  x: number;
  y: number;
  poly: number[][];
  color: string;
  life: number;
  maxLife: number;
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
  const d = impactDecalPool.acquire();
  d.id = generateId();
  d.x = cfg.x;
  d.y = cfg.y;
  d.poly = cfg.poly;
  d.color = cfg.color;
  d.life = cfg.life;
  d.maxLife = cfg.maxLife;
  _G.impactDecals.push(d);
}

export function removeImpactDecal(index: number) {
  const arr = _G.impactDecals;
  const lastIdx = arr.length - 1;
  const dead = arr[index];
  if (index < lastIdx) {
    arr[index] = arr[lastIdx]!;
  }
  arr.length--;
  impactDecalPool.release(dead);
}

/** Release all live impact decals back to the pool and clear the live array. */
export function clearImpactDecals(): void {
  impactDecalPool.releaseAll(_G.impactDecals);
  _G.impactDecals.length = 0;
}
