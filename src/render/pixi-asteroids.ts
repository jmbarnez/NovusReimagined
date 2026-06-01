/**
 * PixiJS Asteroids & Target Locks Renderer.
 * 
 * Migrates asteroid fields and target bracket indicators to PixiJS:
 * - Asteroid Bodies: Rotated and translated polygon meshes with outline strokes.
 * - Mining Debris: Short-lived rock chunks with matching dark outlines.
 * - Drop Shadows: 3D perspective shadows offset below the asteroid planes.
 * - Health Bars: Dynamic resource bars fading in under damaged rocks.
 * - Selection Brackets: Glowing primary/secondary blue targeting locks.
 */
import { Container, Graphics } from "pixi.js";
import { Client } from "../state.js";
import { getState } from "../state-access.js";
import type { System, LockSlot } from "../types/world.js";
import { lerp } from "../utils/math.js";
import { isVisible } from "../utils/game.js";
import { asteroidDebrisList } from "../utils/mining.js";
import { drawTargetLockBrackets, drawSelectedTargetIndicator } from "./pixi-lock-brackets.js";
import { PixiGeometryBufferPool } from "./pixi-geometry-buffer-pool.js";
import { entityLayer } from "../pixi.js";

const TAU = Math.PI * 2;

/** Shared thin dark outline for rocky bodies (asteroids + mining debris). */
const ROCK_OUTLINE = { color: 0x080604, width: 1.5, alpha: 0.92 } as const;

// ─── Single-pass Graphics ────────────────────────────────────────────────────
let _asteroidGfx: Graphics | null = null;
const _asteroidLockMap = new Map<string, LockSlot>();
const _polyBuffers = new PixiGeometryBufferPool();

// Helper to convert HSL to hex number for PixiJS
function hslInt(h: number, s: number, l: number): number {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => Math.round((l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))) * 255);
  return (f(0) << 16) | (f(8) << 8) | f(4);
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function initPixiAsteroids(parent: Container): void {
  destroyPixiAsteroids();

  _asteroidGfx = new Graphics();
  parent.addChild(_asteroidGfx);
}

export function syncPixiAsteroids(now: number, alpha: number, sys: System): void {
  if (!_asteroidGfx && entityLayer) {
    initPixiAsteroids(entityLayer);
  }
  if (!_asteroidGfx) return;

  const gfx = _asteroidGfx;

  gfx.clear();
  _polyBuffers.resetFrame();
  _asteroidLockMap.clear();

  const primaryId = getState().player.targetLock?.id;
  const selectedId = getState().player._assignTargetId;
  if (Array.isArray(getState().player.lockQueue)) {
    for (const slot of getState().player.lockQueue) _asteroidLockMap.set(slot.id, slot);
  }

  const asteroids = sys?._liveAsteroids ?? sys?.asteroids.filter((a) => !a.depleted && a.hp > 0) ?? [];

  for (const a of asteroids) {
      if (!isVisible(a.x, a.y, a.radius + 10)) continue;

      const hp = a.hp / Math.max(1, a.maxHp);
      const isMultiplayer = Client.multiplayerRole !== "none";
      const iSpin = isMultiplayer ? a.spinAngle : lerp(a.prevSpin, a.spinAngle, alpha);
      const cos = Math.cos(iSpin);
      const sin = Math.sin(iSpin);

      // Build rotated and translated asteroid polygon coordinates
      const flatPts = _polyBuffers.writeRotatedScaledWorldPoints(a.shape, a.x, a.y, a.radius, cos, sin);

      // Draw the main body disc
      const h = a.tintHue ?? 30;
      const s = a.tintSat ?? 13;
      const l = 20 + hp * 10;
      const colNum = hslInt(h, s, l);

      gfx.poly(flatPts, true)
        .fill({ color: colNum })
        .stroke(ROCK_OUTLINE);

      // 3. Render health bars below damaged asteroids
      if (hp < 1) {
        const bw = a.radius * 2.2;
        const by = a.y - a.radius - 7;
        gfx.rect(a.x - bw / 2, by, bw, 4).fill({ color: 0x000000, alpha: 0.55 })
          .rect(a.x - bw / 2, by, bw * hp, 4).fill({ color: hp > 0.6 ? 0xc8a060 : hp > 0.3 ? 0xcc6622 : 0x882211 });
      }

      // 4. Render blue locking brackets
      const slot = _asteroidLockMap.get(a.id);
      if (slot) {
        drawTargetLockBrackets(gfx, a.x, a.y, a.radius, slot, a.id === primaryId, now, "neutral");
        if (a.id === selectedId) {
          drawSelectedTargetIndicator(gfx, a.x, a.y, a.radius, now);
        }
      }
    }
  // ── 6. Asteroid destruction debris chunks ─────────────────────────────────
  for (const d of asteroidDebrisList) {
    if (!isVisible(d.x, d.y, d.radius + 4)) continue;

    const fade = Math.min(1, d.life / (d.maxLife * 0.4));
    const cos = Math.cos(d.angle);
    const sin = Math.sin(d.angle);
    const flatPts = _polyBuffers.writeRotatedScaledWorldPoints(d.pts, d.x, d.y, d.radius, cos, sin);

    const colNum = hslInt(d.tintHue ?? 32, d.tintSat ?? 34, 22);
    gfx.poly(flatPts, true)
      .fill({ color: colNum, alpha: fade })
      .stroke({ ...ROCK_OUTLINE, alpha: ROCK_OUTLINE.alpha * fade });
  }
}

export function destroyPixiAsteroids(): void {
  if (_asteroidGfx) {
    _asteroidGfx.destroy();
    _asteroidGfx = null;
  }
}

