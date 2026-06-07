import { Sprite, Texture, ImageSource } from "pixi.js";
import { Client, AppMode } from "../state.js";
import { getState } from "../state-access.js";
import type { Enemy } from "../types/world.js";
import { SHIPS } from "../data/ships.js";
import { ENEMY_DEFS } from "../data/enemies.js";
import { thrustLayer } from "../pixi.js";
import { lerp } from "../utils/math.js";
import { liveEnemies } from "../utils/game.js";
import { displayShipAngle } from "./display-orientation.js";

const TAU = Math.PI * 2;

// Ion plume texture: nozzle at top-center, soft wake tapering backward.
// Anchor (0.5, 0) so sprites pivot at the nozzle end.
let _flameTex: Texture | null = null;

function bakeFlameTexture(): Texture {
  const W = 28, H = 92;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const cx = c.getContext("2d")!;

  // 1. Diffuse ion feather, wider near the nozzle and transparent at the tail.
  {
    const g = cx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0.00, "rgba(150,230,255,0.28)");
    g.addColorStop(0.28, "rgba(70,180,255,0.18)");
    g.addColorStop(0.76, "rgba(45,115,255,0.06)");
    g.addColorStop(1,   "rgba(0,0,0,0)");
    const hw = W * 0.44;
    cx.beginPath();
    cx.moveTo(W / 2 - hw, 0);
    cx.lineTo(W / 2 + hw, 0);
    cx.quadraticCurveTo(W / 2 + hw * 0.50, H * 0.48, W / 2 + hw * 0.10, H * 0.9);
    cx.quadraticCurveTo(W / 2, H, W / 2 - hw * 0.10, H * 0.9);
    cx.quadraticCurveTo(W / 2 - hw * 0.50, H * 0.48, W / 2 - hw, 0);
    cx.closePath();
    cx.fillStyle = g;
    cx.fill();
  }

  // 2. Narrow luminous body, compact enough to read as engine thrust.
  {
    const g = cx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0.00, "rgba(255,255,255,0.92)");
    g.addColorStop(0.12, "rgba(185,245,255,0.76)");
    g.addColorStop(0.30, "rgba(85,205,255,0.40)");
    g.addColorStop(0.70, "rgba(60,135,255,0.12)");
    g.addColorStop(1.00, "rgba(0,0,0,0)");
    const hw = W * 0.24;
    cx.save();
    cx.beginPath();
    cx.moveTo(W / 2 - hw, 0);
    cx.lineTo(W / 2 + hw, 0);
    cx.quadraticCurveTo(W / 2 + hw * 0.32, H * 0.52, W / 2, H * 0.92);
    cx.quadraticCurveTo(W / 2 - hw * 0.32, H * 0.52, W / 2 - hw, 0);
    cx.closePath();
    cx.fillStyle = g;
    cx.fill();
    cx.restore();
  }

  // 3. Hot white/cyan nozzle core.
  {
    const g = cx.createRadialGradient(W / 2, 2, 0, W / 2, 2, 9);
    g.addColorStop(0,   "rgba(255,255,255,1.0)");
    g.addColorStop(0.48,"rgba(190,245,255,0.82)");
    g.addColorStop(1,   "rgba(90,190,255,0)");
    cx.fillStyle = g;
    cx.fillRect(0, 0, W, 16);
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
const _remoteSprites = new Map<string, Sprite[]>();

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
  _remoteSprites.clear();
}

// Flame dimensions scale with ship collision radius.
function playerFlameDims(shipId: string): { w: number; l: number } {
  const ship = SHIPS[shipId];
  const r = ship?.colRadius ?? 24;
  return { w: r * 0.15, l: r * 0.62 };
}
// Enemy flame dims — proportional to sigRadius, set per-enemy in sync
const ENEMY_FLAME_SCALE = 0.48;  // flameLength = sigRadius * this

function flameThrottle(speed: number, maxSpeed: number, thrusting: boolean): number {
  if (!thrusting) return 0;
  const speedRatio = Math.min(1, speed / Math.max(1, maxSpeed));
  return 0.42 + speedRatio * 0.58;
}

function applyBoostTint(sprite: Sprite, boosted: boolean): void {
  sprite.tint = boosted ? 0x66f4ff : 0xffffff;
}

export function syncThrust(alpha: number, now: number) {
  if (!thrustLayer || Client.mode !== AppMode.SPACE) {
    for (const s of _playerSprites) s.alpha = 0;
    for (const [, s] of _enemySprites) s.alpha = 0;
    for (const [, sprites] of _remoteSprites) {
      for (const sprite of sprites) sprite.alpha = 0;
    }
    return;
  }

  _syncPlayerThrust(alpha, now);
  _syncRemotePlayerThrust(alpha, now);
  _syncEnemyThrust(now);
}

function _syncPlayerThrust(alpha: number, now: number) {
  const p = getState().player;
  if (!p) return;

  const ship = SHIPS[p.shipId];
  const nozzles = ship?.render?.nozzleOffsets ?? [[-20, 0]];
  const speed = Math.hypot(p.vx || 0, p.vy || 0);
  const thrusting = p.thrustFx === true;
  const throttle = flameThrottle(speed, ship?.simMaxSpeedPx ?? 100, thrusting);
  const boosted = p.boostFx === true;

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
  const ang = displayShipAngle(
    lerp(p.prevAngle ?? p.angle, p.angle, alpha),
    p.vx || 0,
    p.vy || 0,
  );
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const flame = playerFlameDims(p.shipId);

  for (let i = 0; i < nozzles.length; i++) {
    const [nx, ny] = nozzles[i];
    const wx = px + ca * nx - sa * ny;
    const wy = py + sa * nx + ca * ny;

    const sprite = _playerSprites[i];
    sprite.x = wx;
    sprite.y = wy;
    const flicker = 0.88 + 0.12 * Math.sin(now * 0.024 + i * 1.3);
    const lengthPulse = 0.90 + 0.10 * Math.sin(now * 0.018 + i * 2.1);
    applyBoostTint(sprite, boosted);
    sprite.width  = flame.w * (0.70 + throttle * 0.22) * (boosted ? 1.35 : 1);
    sprite.height = flame.l * (0.48 + throttle * 0.82) * lengthPulse * (boosted ? 1.65 : 1);
    // Rotate so the "body" (below anchor) points backward from the ship
    sprite.rotation = ang + Math.PI / 2;
    sprite.alpha = throttle > 0 ? Math.min(boosted ? 0.98 : 0.86, throttle * flicker * (boosted ? 1.12 : 1)) : 0;
  }
}

function _syncRemotePlayerThrust(alpha: number, now: number) {
  const state = getState();
  const local = state.player;
  if (!local) return;

  const liveIds = new Set<string>();
  for (const [key, p] of state.players) {
    const netId = p.netId ?? key;
    if (!netId || p === local || netId === local.netId || key === "local") continue;
    liveIds.add(netId);

    let sprites = _remoteSprites.get(netId);
    const ship = SHIPS[p.shipId];
    const nozzles = ship?.render?.nozzleOffsets ?? [[-20, 0]];
    if (!sprites) {
      sprites = [];
      _remoteSprites.set(netId, sprites);
    }

    while (sprites.length < nozzles.length) {
      sprites.push(makeFlameSprite());
    }
    while (sprites.length > nozzles.length) {
      const sprite = sprites.pop()!;
      thrustLayer?.removeChild(sprite);
      sprite.destroy();
    }

    if (p.sysIdx !== local.sysIdx) {
      for (const sprite of sprites) sprite.alpha = 0;
      continue;
    }

    const speed = Math.hypot(p.vx || 0, p.vy || 0);
    const thrusting = p.thrustFx === true;
    const throttle = flameThrottle(speed, ship?.simMaxSpeedPx ?? 100, thrusting);
    const boosted = p.boostFx === true;
    const useRenderInterpolation = Client.multiplayerRole === "none";
    const px = useRenderInterpolation ? lerp(p.px, p.x, alpha) : p.x;
    const py = useRenderInterpolation ? lerp(p.py, p.y, alpha) : p.y;
    const ang = displayShipAngle(
      useRenderInterpolation ? lerp(p.prevAngle ?? p.angle, p.angle, alpha) : p.angle,
      p.vx || 0,
      p.vy || 0,
    );
    const ca = Math.cos(ang), sa = Math.sin(ang);

    const flame = playerFlameDims(p.shipId);
    for (let i = 0; i < nozzles.length; i++) {
      const [nx, ny] = nozzles[i];
      const wx = px + ca * nx - sa * ny;
      const wy = py + sa * nx + ca * ny;

      const sprite = sprites[i];
      sprite.x = wx;
      sprite.y = wy;
      const flicker = 0.88 + 0.12 * Math.sin(now * 0.024 + i * 1.3 + netId.length);
      const lengthPulse = 0.90 + 0.10 * Math.sin(now * 0.018 + i * 2.1 + netId.length);
      applyBoostTint(sprite, boosted);
      sprite.width = flame.w * (0.70 + throttle * 0.22) * (boosted ? 1.35 : 1);
      sprite.height = flame.l * (0.48 + throttle * 0.82) * lengthPulse * (boosted ? 1.65 : 1);
      sprite.rotation = ang + Math.PI / 2;
      sprite.alpha = throttle > 0 ? Math.min(boosted ? 0.98 : 0.86, throttle * flicker * (boosted ? 1.12 : 1)) : 0;
    }
  }

  for (const [netId, sprites] of _remoteSprites) {
    if (liveIds.has(netId)) continue;
    for (const sprite of sprites) {
      thrustLayer?.removeChild(sprite);
      sprite.destroy();
    }
    _remoteSprites.delete(netId);
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
    const throttle = flameThrottle(curSpd, maxSpd, e.thrustFx === true);
    if (throttle <= 0) {
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
    sprite.width  = flameLen * (0.20 + throttle * 0.14);
    sprite.height = flameLen * (0.52 + throttle * 0.72);
    sprite.rotation = ang + Math.PI / 2;

    const flicker = 0.84 + 0.16 * Math.sin(now * 0.022 + e.id.charCodeAt(0) * 0.7);
    applyBoostTint(sprite, false);
    sprite.alpha = Math.min(0.85, throttle * flicker);
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
  for (const [, sprites] of _remoteSprites) {
    for (const sprite of sprites) {
      thrustLayer?.removeChild(sprite);
      sprite.destroy();
    }
  }
  _remoteSprites.clear();
  if (_flameTex) { _flameTex.destroy(); _flameTex = null; }
}
