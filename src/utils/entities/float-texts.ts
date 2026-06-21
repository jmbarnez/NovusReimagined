/**
 * Floating damage/status text lifecycle helpers. Pooled; drift upward and
 * fade over their lifetime.
 */
import { _G } from "../../state.js";
import { createPool } from "../pool.js";
import { generateId } from "./id.js";

const floatTextPool = createPool<FloatText>(512);

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
  const f = floatTextPool.acquire();
  f.id = generateId();
  f.x = ft.x;
  f.y = ft.y;
  f.text = ft.text;
  f.color = ft.color;
  f.bgColor = ft.bgColor;
  f.life = ft.life;
  f.vy = ft.vy;
  _G.floatTexts.push(f);
}

/** Advance float-text drift, cull expired ones, and release them to the pool. */
export function updateFloatTexts(dt: number) {
  let w = 0;
  const arr = _G.floatTexts;
  for (let i = 0; i < arr.length; i++) {
    const f = arr[i];
    f.y -= 20 * dt;
    f.life = (f.life ?? 0) - dt;
    if (f.life > 0) {
      arr[w++] = f;
    } else {
      floatTextPool.release(f);
    }
  }
  arr.length = w;
}

/** Release all live float texts back to the pool and clear the live array. */
export function clearFloatTexts(): void {
  floatTextPool.releaseAll(_G.floatTexts);
  _G.floatTexts.length = 0;
}
