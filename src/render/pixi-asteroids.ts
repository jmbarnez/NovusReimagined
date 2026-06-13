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
import { Container, Graphics, ImageSource, Sprite, Texture } from "pixi.js";
import { Client } from "../state.js";
import { getState } from "../state-access.js";
import type { Asteroid, System, LockSlot } from "../types/world.js";
import { lerp } from "../utils/math.js";
import { isVisible } from "../utils/game.js";
import { asteroidDebrisList } from "../utils/mining.js";
import { drawTargetLockBrackets, drawSelectedTargetIndicator } from "./pixi-lock-brackets.js";
import { PixiGeometryBufferPool } from "./pixi-geometry-buffer-pool.js";
import { entityLayer } from "../pixi.js";

const TAU = Math.PI * 2;
const ASTEROID_TEX_SCALE = 3;

/** Shared thin dark outline for rocky bodies (asteroids + mining debris). */
const ROCK_OUTLINE = { color: 0x080604, width: 1.5, alpha: 0.92 } as const;

// ─── Single-pass Graphics ────────────────────────────────────────────────────
let _asteroidGfx: Graphics | null = null;
let _asteroidSpriteLayer: Container | null = null;
const _asteroidSprites = new Map<string, Sprite>();
const _asteroidTextureCache = new Map<string, Texture>();
const _asteroidLockMap = new Map<string, LockSlot>();
const _polyBuffers = new PixiGeometryBufferPool();

function hslStr(h: number, s: number, l: number, a = 1): string {
  return `hsla(${((h % 360) + 360) % 360},${Math.max(0, Math.min(100, s))}%,${Math.max(0, Math.min(100, l))}%,${a})`;
}

// Helper to convert HSL to hex number for PixiJS
function hslInt(h: number, s: number, l: number): number {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => Math.round((l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))) * 255);
  return (f(0) << 16) | (f(8) << 8) | f(4);
}

function hashUnit(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

function makeAsteroidTextureKey(a: Asteroid): string {
  return [
    a.id,
    Math.round(a.radius),
    Math.round(a.tintHue ?? 30),
    Math.round(a.tintSat ?? 13),
    a.shape.length,
  ].join("|");
}

function drawAsteroidPath(cx: CanvasRenderingContext2D, a: Asteroid, radius: number): void {
  cx.beginPath();
  for (let i = 0; i < a.shape.length; i++) {
    const [px, py] = a.shape[i];
    const x = px * radius;
    const y = py * radius;
    i === 0 ? cx.moveTo(x, y) : cx.lineTo(x, y);
  }
  cx.closePath();
}

function bakeAsteroidTexture(a: Asteroid): Texture {
  const radius = Math.max(4, a.radius);
  const padding = radius * 0.44;
  const texSize = Math.ceil((radius + padding) * 2);
  const half = texSize / 2;
  const c = document.createElement("canvas");
  c.width = c.height = texSize * ASTEROID_TEX_SCALE;
  const cx = c.getContext("2d")!;
  cx.scale(ASTEROID_TEX_SCALE, ASTEROID_TEX_SCALE);
  cx.translate(half, half);

  const hue = a.tintHue ?? 30;
  const sat = a.tintSat ?? 13;
  const lightAngle = -0.78 + hashUnit(`${a.id}:light`) * 0.22;
  const lightX = Math.cos(lightAngle);
  const lightY = Math.sin(lightAngle);

  const shadow = cx.createRadialGradient(radius * 0.12, radius * 0.16, 0, radius * 0.12, radius * 0.16, radius * 1.28);
  shadow.addColorStop(0, "rgba(0,0,0,0.36)");
  shadow.addColorStop(0.56, "rgba(0,0,0,0.12)");
  shadow.addColorStop(1, "rgba(0,0,0,0)");
  cx.save();
  cx.scale(1.08, 0.84);
  cx.fillStyle = shadow;
  cx.beginPath();
  cx.arc(0, 0, radius * 1.22, 0, TAU);
  cx.fill();
  cx.restore();

  cx.save();
  drawAsteroidPath(cx, a, radius);
  cx.clip();

  const base = cx.createRadialGradient(lightX * radius * 0.44, lightY * radius * 0.44, 0, 0, 0, radius * 1.18);
  base.addColorStop(0, hslStr(hue + 5, sat + 10, 42));
  base.addColorStop(0.36, hslStr(hue, sat + 4, 28));
  base.addColorStop(0.78, hslStr(hue - 5, Math.max(0, sat - 4), 16));
  base.addColorStop(1, hslStr(hue - 8, Math.max(0, sat - 8), 8));
  cx.fillStyle = base;
  cx.fillRect(-radius - 2, -radius - 2, radius * 2 + 4, radius * 2 + 4);

  for (let i = 0; i < 18; i++) {
    const seed = `${a.id}:pit:${i}`;
    const ang = hashUnit(seed) * TAU;
    const dist = Math.sqrt(hashUnit(`${seed}:d`)) * radius * 0.78;
    const pitR = radius * (0.035 + hashUnit(`${seed}:r`) * 0.075);
    const x = Math.cos(ang) * dist;
    const y = Math.sin(ang) * dist;
    cx.fillStyle = hslStr(hue - 8, Math.max(0, sat - 10), 7 + hashUnit(`${seed}:l`) * 7, 0.22);
    cx.beginPath();
    cx.ellipse(x, y, pitR * 1.35, pitR * 0.76, hashUnit(`${seed}:rot`) * TAU, 0, TAU);
    cx.fill();
    cx.fillStyle = "rgba(255,245,220,0.08)";
    cx.beginPath();
    cx.ellipse(x - pitR * 0.22, y - pitR * 0.22, pitR * 0.75, pitR * 0.38, hashUnit(`${seed}:rot`) * TAU, 0, TAU);
    cx.fill();
  }

  cx.globalCompositeOperation = "screen";
  for (let i = 0; i < 7; i++) {
    const seed = `${a.id}:vein:${i}`;
    const y = (hashUnit(seed) - 0.5) * radius * 1.35;
    const wobble = (hashUnit(`${seed}:w`) - 0.5) * radius * 0.22;
    cx.strokeStyle = hslStr(hue + 22, Math.min(100, sat + 28), 56, 0.10);
    cx.lineWidth = Math.max(0.7, radius * (0.008 + hashUnit(`${seed}:lw`) * 0.01));
    cx.beginPath();
    cx.moveTo(-radius * 0.72, y);
    cx.quadraticCurveTo(-radius * 0.12, y + wobble, radius * 0.74, y - wobble * 0.7);
    cx.stroke();
  }
  cx.globalCompositeOperation = "source-over";

  const shade = cx.createLinearGradient(lightX * radius, lightY * radius, -lightX * radius, -lightY * radius);
  shade.addColorStop(0, "rgba(0,0,0,0)");
  shade.addColorStop(0.48, "rgba(0,0,0,0.06)");
  shade.addColorStop(0.84, "rgba(0,0,0,0.38)");
  shade.addColorStop(1, "rgba(0,0,0,0.58)");
  cx.fillStyle = shade;
  cx.fillRect(-radius, -radius, radius * 2, radius * 2);

  const rim = cx.createRadialGradient(lightX * radius * 0.12, lightY * radius * 0.12, radius * 0.58, 0, 0, radius * 1.06);
  rim.addColorStop(0, "rgba(0,0,0,0)");
  rim.addColorStop(0.78, "rgba(0,0,0,0)");
  rim.addColorStop(1, "rgba(255,240,210,0.14)");
  cx.globalCompositeOperation = "lighter";
  cx.fillStyle = rim;
  cx.beginPath();
  cx.arc(0, 0, radius * 1.04, 0, TAU);
  cx.fill();
  cx.globalCompositeOperation = "source-over";
  cx.restore();

  drawAsteroidPath(cx, a, radius);
  cx.strokeStyle = "rgba(8,6,4,0.92)";
  cx.lineWidth = 1.55;
  cx.lineJoin = "round";
  cx.stroke();

  return new Texture({
    source: new ImageSource({
      resource: c,
      resolution: ASTEROID_TEX_SCALE,
      scaleMode: "linear",
      autoGenerateMipmaps: Client.settings?.mipmapping ?? true,
    }),
  });
}

function getAsteroidTexture(a: Asteroid): Texture {
  const key = makeAsteroidTextureKey(a);
  let texture = _asteroidTextureCache.get(key);
  if (!texture) {
    texture = bakeAsteroidTexture(a);
    _asteroidTextureCache.set(key, texture);
  }
  return texture;
}

function syncAsteroidBodySprite(a: Asteroid, spin: number, hp: number): void {
  if (!_asteroidSpriteLayer) return;
  let sprite = _asteroidSprites.get(a.id);
  if (!sprite) {
    sprite = new Sprite(getAsteroidTexture(a));
    sprite.anchor.set(0.5);
    _asteroidSpriteLayer.addChild(sprite);
    _asteroidSprites.set(a.id, sprite);
  }
  sprite.visible = true;
  sprite.x = a.x;
  sprite.y = a.y;
  sprite.rotation = spin;
  sprite.alpha = 0.72 + hp * 0.28;
}

function hideUnusedAsteroidSprites(activeIds: Set<string>): void {
  for (const [id, sprite] of _asteroidSprites) {
    if (activeIds.has(id)) continue;
    sprite.visible = false;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function initPixiAsteroids(parent: Container): void {
  destroyPixiAsteroids();

  _asteroidSpriteLayer = new Container();
  _asteroidSpriteLayer.label = "asteroid-bodies";
  parent.addChild(_asteroidSpriteLayer);

  _asteroidGfx = new Graphics();
  _asteroidGfx.label = "asteroid-overlays";
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

  const player = getState().player;
  const primaryId = player.targetLock?.id;
  const selectedId = player._assignTargetId;
  if (Array.isArray(player.lockQueue)) {
    for (const slot of player.lockQueue) _asteroidLockMap.set(slot.id, slot);
  }

  const asteroids = sys?._liveAsteroids ?? [];
  const isMultiplayer = Client.multiplayerRole !== "none";
  const activeIds = new Set<string>();

  for (const a of asteroids) {
      if (!isVisible(a.x, a.y, a.radius + 14)) continue;
      activeIds.add(a.id);

      const hp = a.hp / Math.max(1, a.maxHp);
      const iSpin = isMultiplayer ? a.spinAngle : lerp(a.prevSpin, a.spinAngle, alpha);
      syncAsteroidBodySprite(a, iSpin, hp);

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
  hideUnusedAsteroidSprites(activeIds);

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
  for (const sprite of _asteroidSprites.values()) {
    sprite.destroy();
  }
  _asteroidSprites.clear();
  for (const texture of _asteroidTextureCache.values()) {
    texture.destroy(true);
  }
  _asteroidTextureCache.clear();
  if (_asteroidSpriteLayer) {
    _asteroidSpriteLayer.destroy({ children: true });
    _asteroidSpriteLayer = null;
  }
  if (_asteroidGfx) {
    _asteroidGfx.destroy();
    _asteroidGfx = null;
  }
}

