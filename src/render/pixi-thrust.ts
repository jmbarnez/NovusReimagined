import { Sprite, Texture, ImageSource } from "pixi.js";
import { G, Client, AppMode } from "../state.js";
import type { Enemy } from "../types/world.js";
import { SHIPS } from "../data/ships.js";
import { ENEMY_DEFS } from "../data/enemies.js";
import { thrustLayer } from "../pixi.js";
import { lerp } from "../utils/math.js";
import { liveEnemies } from "../utils/game.js";

const TAU = Math.PI * 2;

// Flame texture: 24×80, nozzle at top-center (12, 0), flame taper to point at bottom.
// Anchor (0.5, 0) so sprites pivot at the nozzle end.
let _flameTex: Texture | null = null;

function bakeFlameTexture(): Texture {
  const W = 24, H = 80;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const cx = c.getContext("2d")!;

  // 1. Soft outer corona — wide diffuse glow around the nozzle
  {
    const g = cx.createRadialGradient(W / 2, 6, 0, W / 2, 10, 20);
    g.addColorStop(0,   "rgba(120,190,255,0.45)");
    g.addColorStop(0.5, "rgba(60,120,255,0.15)");
    g.addColorStop(1,   "rgba(0,0,0,0)");
    cx.fillStyle = g;
    cx.fillRect(0, 0, W, H);
  }

  // 2. Tapered flame body — wide at nozzle, pointed at tail
  {
    const g = cx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0.00, "rgba(230,245,255,0.88)");
    g.addColorStop(0.10, "rgba(160,210,255,0.72)");
    g.addColorStop(0.30, "rgba(80,150,255,0.42)");
    g.addColorStop(0.60, "rgba(40,80,255,0.14)");
    g.addColorStop(1.00, "rgba(0,0,0,0)");
    const hw = W * 0.32;
    cx.save();
    cx.beginPath();
    cx.moveTo(W / 2 - hw, 0);
    cx.lineTo(W / 2 + hw, 0);
    cx.quadraticCurveTo(W / 2 + hw * 0.4, H * 0.55, W / 2, H);
    cx.quadraticCurveTo(W / 2 - hw * 0.4, H * 0.55, W / 2 - hw, 0);
    cx.closePath();
    cx.fillStyle = g;
    cx.fill();
    cx.restore();
  }

  // 3. Hot white core at nozzle opening
  {
    const g = cx.createRadialGradient(W / 2, 1, 0, W / 2, 1, 7);
    g.addColorStop(0,   "rgba(255,255,255,1.0)");
    g.addColorStop(0.45,"rgba(200,230,255,0.75)");
    g.addColorStop(1,   "rgba(80,160,255,0)");
    cx.fillStyle = g;
    cx.fillRect(0, 0, W, 14);
  }

  return new Texture({ source: new ImageSource({ resource: c, resolution: 1, scaleMode: "linear" }) });
}

function getFlameTex(): Texture {
  if (!_flameTex) _flameTex = bakeFlameTexture();
  return _flameTex;
}

// ── Per-entity sprite pools ────────────────────────────────────────────────────
let _playerSprites: Sprite[] = [];

// Map from enemy id → sprite
const _enemySprites = new Map<string, Sprite>();

function makeFlameSprite(): Sprite {
  const s = new Sprite(getFlameTex());
  s.anchor.set(0.5, 0);
  s.blendMode = "add";
  s.eventMode = "none";
  thrustLayer?.addChild(s);
  return s;
}

export function initThrust() {
  if (!thrustLayer) return;
  _playerSprites = [];
  _enemySprites.clear();
}

// Player flame width / length in world units
const PLAYER_FLAME_W = 10;
const PLAYER_FLAME_L = 32;
// Enemy flame dims — proportional to sigRadius, set per-enemy in sync
const ENEMY_FLAME_SCALE = 0.55;  // flameLength = sigRadius * this

export function syncThrust(alpha: number, now: number) {
  if (!thrustLayer || Client.mode !== AppMode.SPACE) {
    for (const s of _playerSprites) s.alpha = 0;
    for (const [, s] of _enemySprites) s.alpha = 0;
    return;
  }

  _syncPlayerThrust(alpha, now);
  _syncEnemyThrust(now);
}

function _syncPlayerThrust(alpha: number, now: number) {
  const p = G.P;
  if (!p) return;

  const ship = SHIPS[p.shipId];
  const nozzles = ship?.render?.nozzleOffsets ?? [[-20, 0]];
  const speed = Math.hypot(p.vx || 0, p.vy || 0);
  const thrusting = p.thrustFx === true || speed > 8;

  // Ensure we have a sprite per nozzle
  while (_playerSprites.length < nozzles.length) {
    _playerSprites.push(makeFlameSprite());
  }
  while (_playerSprites.length > nozzles.length) {
    const s = _playerSprites.pop()!;
    thrustLayer?.removeChild(s);
    s.destroy();
  }

  const px = lerp(p.px, p.x, alpha);
  const py = lerp(p.py, p.y, alpha);
  const ang = lerp(p.prevAngle ?? p.angle, p.angle, alpha);
  const ca = Math.cos(ang), sa = Math.sin(ang);

  for (let i = 0; i < nozzles.length; i++) {
    const [nx, ny] = nozzles[i];
    const wx = px + ca * nx - sa * ny;
    const wy = py + sa * nx + ca * ny;

    const sprite = _playerSprites[i];
    sprite.x = wx;
    sprite.y = wy;
    sprite.width  = PLAYER_FLAME_W;
    sprite.height = PLAYER_FLAME_L;
    // Rotate so the "body" (below anchor) points backward from the ship
    sprite.rotation = ang + Math.PI / 2;

    const flicker = 0.82 + 0.18 * Math.sin(now * 0.024 + i * 1.3);
    sprite.alpha = thrusting ? flicker : 0;
  }
}

function _syncEnemyThrust(now: number) {
  const enemies = liveEnemies();
  const liveIds = new Set<string>();

  for (const e of enemies) {
    if (!e.id) continue;
    liveIds.add(e.id);

    const def = ENEMY_DEFS[e.type];
    if (!def) continue;

    const maxSpd = def.speed || 80;
    const curSpd = Math.hypot(e.vx || 0, e.vy || 0);
    const throttle = Math.min(1, curSpd / Math.max(1, maxSpd));
    if (throttle < 0.05) {
      if (_enemySprites.has(e.id)) {
        _enemySprites.get(e.id)!.alpha = 0;
      }
      continue;
    }

    let sprite = _enemySprites.get(e.id);
    if (!sprite) {
      sprite = makeFlameSprite();
      _enemySprites.set(e.id, sprite);
    }

    // Nozzle at the back of the enemy in local space (-x direction)
    const sigR = def.sigRadius || 20;
    const nozzleOff = -sigR * 0.65;
    const ang = e.angle ?? 0;
    const wx = e.x + Math.cos(ang) * nozzleOff;
    const wy = e.y + Math.sin(ang) * nozzleOff;

    const flameLen = sigR * ENEMY_FLAME_SCALE;
    sprite.x = wx;
    sprite.y = wy;
    sprite.width  = flameLen * 0.38;
    sprite.height = flameLen;
    sprite.rotation = ang + Math.PI / 2;

    const flicker = 0.75 + 0.25 * Math.sin(now * 0.022 + e.id.charCodeAt(0) * 0.7);
    sprite.alpha = throttle * flicker;
  }

  // Remove sprites for despawned enemies
  for (const [id, sprite] of _enemySprites) {
    if (!liveIds.has(id)) {
      thrustLayer?.removeChild(sprite);
      sprite.destroy();
      _enemySprites.delete(id);
    }
  }
}

export function destroyThrust() {
  for (const s of _playerSprites) { thrustLayer?.removeChild(s); s.destroy(); }
  _playerSprites = [];
  for (const [, s] of _enemySprites) { thrustLayer?.removeChild(s); s.destroy(); }
  _enemySprites.clear();
  if (_flameTex) { _flameTex.destroy(); _flameTex = null; }
}
