/**
 * Trail sprite pool and syncing for engine exhaust and blink afterimages.
 */
import { Sprite } from "pixi.js";
import { getState } from "../../state-access.js";
import { thrustLayer } from "../../pixi.js";
import { getDotTexture } from "./bake.js";

const TRAIL_POOL = 384;
const DOT_HALF = 16; // DOT_TEX / 2 from bake.ts

const _trailPool: Sprite[] = [];

export function buildTrailPool() {
  if (!thrustLayer) return;
  const dotTex = getDotTexture();
  for (let i = 0; i < TRAIL_POOL; i++) {
    const s = new Sprite(dotTex);
    s.anchor.set(0.5);
    s.visible = false;
    s.blendMode = "add";
    thrustLayer.addChild(s);
    _trailPool.push(s);
  }
}

export function syncPixiTrails(): void {
  const trails = getState().trails;
  for (let i = 0; i < TRAIL_POOL; i++) {
    const s = _trailPool[i];
    if (!s) continue;
    const t = trails[i];
    if (!t || t.life <= 0) {
      if (s.visible) s.visible = false;
      continue;
    }
    const a = t.life / Math.max(0.001, t.maxLife);
    s.visible = true;
    s.x = t.x;
    s.y = t.y;
    if (t.length !== undefined && t.angle !== undefined) {
      s.blendMode = "add";
      s.width = t.length * (0.70 + a * 0.24);
      s.height = t.width * (0.48 + a * 0.24);
      s.rotation = t.angle;
      s.alpha = Math.min(0.34, a * 0.34);
    } else {
      s.blendMode = "add";
      const base = (t.width * 0.55 * a) / DOT_HALF;
      s.scale.set(base, base);
      s.rotation = 0;
      s.alpha = a * 0.85;
    }
    s.tint = parseInt(t.color.replace("#", ""), 16) || 0xffffff;
  }
}

export function destroyTrailPool(): void {
  for (const s of _trailPool) {
    thrustLayer?.removeChild(s);
    s.destroy();
  }
  _trailPool.length = 0;
}

export function refreshTrailTexture(): void {
  const dotTex = getDotTexture();
  for (const s of _trailPool) {
    s.texture = dotTex;
  }
}
