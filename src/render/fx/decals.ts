/**
 * Impact decal rendering (fading high-composite poly impact markings).
 */
import { Graphics } from "pixi.js";
import { getState } from "../../state-access.js";
import { isVisible } from "../../utils/game.js";
import { PixiGeometryBufferPool } from "../pixi-geometry-buffer-pool.js";

const _hexCache = new Map<string, number>();

function hexStringToNumber(hex: string): number {
  const hit = _hexCache.get(hex);
  if (hit !== undefined) return hit;
  const val = parseInt(hex.replace("#", ""), 16) || 0xffffff;
  _hexCache.set(hex, val);
  return val;
}

let _polyBuffers: PixiGeometryBufferPool | null = null;

export function setPolyBuffers(buffers: PixiGeometryBufferPool): void {
  _polyBuffers = buffers;
}

export function syncDecals(decalGfx: Graphics): void {
  if (!_polyBuffers) return;
  const state = getState();

  const hasDecals = state.impactDecals?.length > 0;
  if (hasDecals) decalGfx.clear();
  if (state.impactDecals) {
    for (const d of state.impactDecals) {
      if (!isVisible(d.x, d.y, 30)) continue;
      const a = (d.life / d.maxLife) * 0.6;
      const colNum = hexStringToNumber(d.color);

      // Decal polygon points (drawn flat in world space coordinates)
      const decalFlatPts = _polyBuffers.writeTranslatedWorldPoints(d.poly, d.x, d.y);

      decalGfx.poly(decalFlatPts, true)
        .fill({ color: colNum, alpha: a });
    }
  }
}
