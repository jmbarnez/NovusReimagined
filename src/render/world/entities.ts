import { getState } from "../../state-access.js";
import { G, Client } from "../../state.js";
import { ctx } from "../../canvas.js";
import { TAU } from "../../constants.js";
import { lerp, dst } from "../../utils/math.js";
import { isVisible } from "../../utils/game.js";
import { getStats } from "../../player/player-stats.js";
import { SHIPS } from "../../data/ships.js";
import { ENEMY_DEFS } from "../../data/enemies.js";
import { worldText } from "../world-text.js";
import { getUIFont } from "../ui-font.js";
import type { LockSlot, System } from "../../types/world.js";
import {
  getAsteroidDropShadowGrad,
  getAsteroidShadeGrad,
  getAsteroidBodyGrad,
  getShieldBubbleGrad,
  getShieldImpactGrad,
  getHullSparkGrad,
} from "../grad-cache.js";

export function drawLockBrackets(
  cx: number, cy: number, radius: number,
  slot: LockSlot | null | undefined, primaryId: string | undefined, entityId: string | undefined,
  now: number,
) {
  if (!slot || !entityId) return;
  const isPrimary = entityId === primaryId;

  // Corner brackets — short L-shaped ticks at each corner of an invisible bounding square.
  const sz = isPrimary ? radius + 9 : radius + 6;
  const arm = isPrimary ? 7 : 5;

  let color: string;
  let alpha: number;
  let lineWidth: number;

  const sys = G.GALAXY?.[G.P?.sysIdx ?? 0];
  const enemy = sys?._enemyMap?.get(entityId);
  const isEnemy = !!enemy;

  if (isEnemy) {
    if (enemy.hasLockOnPlayer) {
      // Red when that enemy has you locked
      color = "#ff3b30";
      alpha = isPrimary ? 0.95 : 0.75;
      lineWidth = isPrimary ? 1.8 : 1.4;
    } else if (enemy.targetingPlayer) {
      // Flashing yellow when being targeted by that enemy
      const blink = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(now * 0.024));
      color = "#ffcc00";
      alpha = blink * (isPrimary ? 0.95 : 0.75);
      lineWidth = isPrimary ? 1.7 : 1.3;
    } else {
      // Standard enemy lock (not targeting us)
      if (slot.resolving) {
        // Locking phase: flashing orange
        const blink = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(now * 0.014));
        color = "#ff8800";
        alpha = blink * (isPrimary ? 0.85 : 0.65);
        lineWidth = isPrimary ? 1.4 : 1.1;
      } else {
        // Locked: solid hostile orange-red
        color = "#ff5522";
        alpha = isPrimary ? 0.90 : 0.70;
        lineWidth = isPrimary ? 1.7 : 1.3;
      }
    }
  } else {
    // Neutral targets (Asteroid, Wreck, etc.)
    if (slot.resolving) {
      // Flashing blue for just neutral locking phase
      const blink = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(now * 0.014));
      color = "#00d2ff";
      alpha = blink * (isPrimary ? 0.85 : 0.65);
      lineWidth = isPrimary ? 1.4 : 1.1;
    } else {
      // Solid blue for neutral targets
      color = "#0077ff";
      alpha = isPrimary ? 0.90 : 0.70;
      lineWidth = isPrimary ? 1.7 : 1.3;
    }
  }

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.globalAlpha = alpha;
  // Top-left
  ctx.beginPath();
  ctx.moveTo(cx - sz + arm, cy - sz); ctx.lineTo(cx - sz, cy - sz); ctx.lineTo(cx - sz, cy - sz + arm);
  ctx.stroke();
  // Top-right
  ctx.beginPath();
  ctx.moveTo(cx + sz - arm, cy - sz); ctx.lineTo(cx + sz, cy - sz); ctx.lineTo(cx + sz, cy - sz + arm);
  ctx.stroke();
  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(cx + sz - arm, cy + sz); ctx.lineTo(cx + sz, cy + sz); ctx.lineTo(cx + sz, cy + sz - arm);
  ctx.stroke();
  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(cx - sz + arm, cy + sz); ctx.lineTo(cx - sz, cy + sz); ctx.lineTo(cx - sz, cy + sz - arm);
  ctx.stroke();
  ctx.restore();
}

export function shipPath(id: string, size = 1) {
  const ship = SHIPS[id];
  const pts = ship?.render?.path;
  if (!pts) return;
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const [px, py] = pts[i];
    i === 0 ? ctx.moveTo(px * size, py * size) : ctx.lineTo(px * size, py * size);
  }
  ctx.closePath();
}

export function enemyPath(type: string, size = 1) {
  const def = ENEMY_DEFS[type];
  const cfg = def?.render;
  if (!cfg) return;
  ctx.beginPath();
  if (cfg.pathType === "polygon8") {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const [px, py] = cfg.path[i] || [0, 0];
      i === 0 ? ctx.moveTo(px * size, py * size) : ctx.lineTo(px * size, py * size);
    }
  } else {
    const pts = cfg.path;
    for (let i = 0; i < pts.length; i++) {
      const [px, py] = pts[i];
      i === 0 ? ctx.moveTo(px * size, py * size) : ctx.lineTo(px * size, py * size);
    }
  }
  ctx.closePath();
}

const _asteroidLockMap = new Map<string, LockSlot>();

export function drawAsteroids(alpha: number, sys: System, now: number) {
  if (!sys?._liveAsteroids) return;
  const state = getState();
  const player = state.player;
  const mineR = getStats().mineRange;
  _asteroidLockMap.clear();
  const primaryId = player.targetLock?.id;
  if (Array.isArray(player.lockQueue)) {
    for (const slot of player.lockQueue) _asteroidLockMap.set(slot.id, slot);
  }
  for (const a of sys._liveAsteroids) {
    if (!isVisible(a.x, a.y, a.radius + 10)) continue;
    const near = dst(player.x, player.y, a.x, a.y) - a.radius < mineR;
    const iSpin = lerp(a.prevSpin, a.spinAngle, alpha);
    // 3D drop shadow on the "ground" plane beneath the asteroid
    ctx.save();
    ctx.translate(a.x + a.radius * 0.1, a.y + a.radius * 0.25);
    ctx.fillStyle = getAsteroidDropShadowGrad(ctx, a.radius);
    ctx.beginPath(); ctx.ellipse(0, 0, a.radius * 0.8, a.radius * 0.35, 0, 0, TAU); ctx.fill();
    ctx.restore();

    ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(iSpin);
    const hp = a.hp / Math.max(1, a.maxHp);
    ctx.beginPath();
    ctx.moveTo(a.shape[0][0] * a.radius, a.shape[0][1] * a.radius);
    for (let i = 1; i < a.shape.length; i++) ctx.lineTo(a.shape[i][0] * a.radius, a.shape[i][1] * a.radius);
    ctx.closePath();
    // Thick dark outline for depth
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(8,6,4,0.92)";
    ctx.lineWidth = 3.5;
    ctx.stroke();
    const h = a.tintHue ?? 30;
    const s = a.tintSat ?? 13;
    // Direction from this asteroid toward the system star, then into local frame
    const sunWorldX = Math.cos(sys?.sunDir ?? 0) * 3500;
    const sunWorldY = Math.sin(sys?.sunDir ?? 0) * 3500;
    const localSun = Math.atan2(sunWorldY - a.y, sunWorldX - a.x) - iSpin;
    ctx.fillStyle = getAsteroidBodyGrad(ctx, a.radius, h, s, hp, localSun); ctx.fill();
    // Directional shadow overlay — dark side away from sun
    if (Client.settings?.directionalLighting !== false) {
      ctx.save(); ctx.beginPath();
      ctx.moveTo(a.shape[0][0] * a.radius, a.shape[0][1] * a.radius);
      for (let i = 1; i < a.shape.length; i++) ctx.lineTo(a.shape[i][0] * a.radius, a.shape[i][1] * a.radius);
      ctx.closePath(); ctx.clip();
      ctx.fillStyle = getAsteroidShadeGrad(ctx, a.radius, localSun); ctx.fillRect(-a.radius, -a.radius, a.radius * 2, a.radius * 2);
      ctx.restore();
    }
    // Rim light on sun-facing edge
    ctx.strokeStyle = near ? `rgba(180,165,140,0.85)` : `hsl(${h},${s + 6}%,${20 + hp * 10}%)`;
    ctx.lineWidth = near ? 2.1 : 1.4; ctx.stroke();
    ctx.lineJoin = "miter";

    if (a.hasCrystals && a.crystals) {
      const cHue = a.crystalHue ?? 200;
      for (const c of a.crystals) {
        const cx = c.x * a.radius, cy = c.y * a.radius;
        const cs = c.size * a.radius;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(c.rot);
        ctx.beginPath();
        ctx.moveTo(0, -cs);
        ctx.lineTo(cs * 0.5, 0);
        ctx.lineTo(0, cs);
        ctx.lineTo(-cs * 0.5, 0);
        ctx.closePath();
        ctx.fillStyle = `hsl(${cHue}, 85%, ${65 + hp * 15}%)`;
        ctx.fill();
        // Crystal highlight
        ctx.fillStyle = `hsl(${cHue}, 60%, ${85 + hp * 10}%)`;
        ctx.beginPath();
        ctx.moveTo(0, -cs);
        ctx.lineTo(cs * 0.3, 0);
        ctx.lineTo(0, cs * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    ctx.restore();
    const bw = a.radius * 2.2;
    if (hp < 1) {
      const by = a.y - a.radius - 7;
      ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(a.x - bw / 2, by, bw, 4);
      ctx.fillStyle = hp > .6 ? "#c8a060" : hp > .3 ? "#cc6622" : "#882211"; ctx.fillRect(a.x - bw / 2, by, bw * hp, 4);
    }

    drawLockBrackets(a.x, a.y, a.radius, _asteroidLockMap.get(a.id), primaryId, a.id, now);
  }
}

const _enemyLockMap = new Map<string, LockSlot>();

/**
 * Draws only the lock brackets / scan ring for each enemy.
 * Enemy hulls, HP bars, labels, and targeting indicators are now
 * rendered by PixiJS in pixi-entities.ts (syncPixiEntities).
 */
export function drawEnemyOverlays(alpha: number, sys: System, now: number) {
  if (!sys?._liveEnemies) return;
  const state = getState();
  const player = state.player;
  _enemyLockMap.clear();
  const primaryId = player.targetLock?.id;
  if (Array.isArray(player.lockQueue)) {
    for (const slot of player.lockQueue) _enemyLockMap.set(slot.id, slot);
  }
  for (const e of sys._liveEnemies) {
    if (!isVisible(e.x, e.y, 40)) continue;
    const ix = lerp(e.px, e.x, alpha);
    const iy = lerp(e.py, e.y, alpha);
    drawLockBrackets(ix, iy, 18, _enemyLockMap.get(e.id), primaryId, e.id, now);

    const glow = e.shieldHitGlow || 0;
    if (glow > 0) {
      const shieldR = e.sigRadius ?? 20;
      const hitAngle = e.shieldHitAngle || 0;
      const t = 1 - glow;
      const hx = Math.cos(hitAngle) * shieldR;
      const hy = Math.sin(hitAngle) * shieldR;

      ctx.save();
      ctx.translate(ix, iy);

      ctx.save();
      ctx.beginPath(); ctx.arc(0, 0, shieldR, 0, TAU); ctx.clip();

      ctx.globalAlpha = glow;
      ctx.fillStyle = getShieldBubbleGrad(ctx, 3, shieldR);
      ctx.beginPath(); ctx.arc(0, 0, shieldR, 0, TAU); ctx.fill();

      ctx.save();
      ctx.translate(hx, hy);
      ctx.globalAlpha = glow * 0.9;
      const flashSz = shieldR * 0.5;
      ctx.fillStyle = getShieldImpactGrad(ctx, flashSz);
      ctx.beginPath(); ctx.arc(0, 0, flashSz, 0, TAU); ctx.fill();

      for (let i = 0; i < 3; i++) {
        const phase = t * 1.5 - i * 0.2;
        if (phase <= 0 || phase >= 1) continue;
        ctx.globalAlpha = glow * (1 - phase) * 0.65;
        ctx.strokeStyle = "#aaddff";
        ctx.lineWidth = 2 * (1 - phase);
        ctx.beginPath(); ctx.arc(0, 0, phase * shieldR * 2.0, 0, TAU); ctx.stroke();
      }
      ctx.restore();

      ctx.restore();

      const waveWidth = t * Math.PI * 1.2;
      const waveA = glow * 0.4 * (1 - t * 0.6);
      if (waveWidth > 0.05 && waveA > 0.01) {
        ctx.globalAlpha = waveA;
        ctx.strokeStyle = "#66ccff";
        ctx.lineWidth = 2;
        ctx.shadowBlur = 8;
        ctx.shadowColor = "#3388cc";
        ctx.beginPath();
        ctx.arc(0, 0, shieldR * (0.96 + t * 0.06), hitAngle - waveWidth * 0.5, hitAngle + waveWidth * 0.5);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }
}

/**
 * Draws player hit-effect overlays only (shield pulse + hull spark).
 * Hull body + thrust flames are rendered by syncPixiPlayer in pixi-player.ts.
 */
export function drawPlayer(now: number, alpha: number) {
  const state = getState();
  const player = state.player;
  if (!player) return;
  const shieldGlow = player.shieldHitGlow || 0;
  const hullGlow = player.hullHitGlow || 0;
  if (shieldGlow <= 0 && hullGlow <= 0) return;

  const ix = lerp(player.px, player.x, alpha), iy = lerp(player.py, player.y, alpha);
  const ia = lerp(player.prevAngle, player.angle, alpha);
  if (player.invincible > 0 && Math.floor(now / 75) % 2 === 0) return;

  const latV = player.vx * Math.sin(ia) - player.vy * Math.cos(ia);
  const bankTilt = Math.max(-0.13, Math.min(0.13, latV * 0.0045));
  const angle = ia + (Math.abs(bankTilt) > 0.002 ? bankTilt : 0);

  ctx.save(); ctx.translate(ix, iy); ctx.rotate(angle);

  const shieldR = 34;
  const glow = shieldGlow;

  // Shield is completely invisible until impacted — only the impact pulse shows
  if (glow > 0) {
    // Convert world-space hit angle to local (ship-rotated) coordinates
    const hitAngle = player.shieldHitAngle - ia;
    const hx = Math.cos(hitAngle) * shieldR;
    const hy = Math.sin(hitAngle) * shieldR;
    const t = 1 - glow; // 0 at impact, 1 as it fades

    // Clip to shield sphere so everything looks like it's on the surface
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, shieldR, 0, TAU); ctx.clip();

    // Faint full-sphere flash that fades with the glow
    ctx.globalAlpha = glow;
    ctx.fillStyle = getShieldBubbleGrad(ctx, 5, shieldR);
    ctx.beginPath(); ctx.arc(0, 0, shieldR, 0, TAU); ctx.fill();

    // Bright impact flash and concentric ripples translated to contact point
    ctx.save();
    ctx.translate(hx, hy);
    ctx.globalAlpha = glow * 0.95;
    ctx.fillStyle = getShieldImpactGrad(ctx, 14);
    ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU); ctx.fill();

    // Expanding concentric ripples from impact point
    for (let i = 0; i < 3; i++) {
      const phase = t * 1.5 - i * 0.2;
      if (phase <= 0 || phase >= 1) continue;
      const rippleR = phase * shieldR * 2.2;
      const rippleA = glow * (1 - phase) * 0.7;
      ctx.globalAlpha = rippleA;
      ctx.strokeStyle = "#aaddff";
      ctx.lineWidth = 2.2 * (1 - phase);
      ctx.beginPath(); ctx.arc(0, 0, rippleR, 0, TAU); ctx.stroke();
    }
    ctx.restore();

    // Traveling arc wave along shield surface
    const waveWidth = t * Math.PI * 1.3;
    const waveA = glow * 0.45 * (1 - t * 0.6);
    if (waveWidth > 0.05 && waveA > 0.01) {
      ctx.globalAlpha = waveA;
      ctx.strokeStyle = "#66ccff";
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#3388cc";
      ctx.beginPath();
      ctx.arc(0, 0, shieldR * (0.96 + t * 0.06), hitAngle - waveWidth * 0.5, hitAngle + waveWidth * 0.5);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // Hull impact — fiery flash where the projectile struck the hull
  if (hullGlow > 0) {
    const hullAngle = player.hullHitAngle - ia;
    const hx = Math.cos(hullAngle) * 18;
    const hy = Math.sin(hullAngle) * 18;

    ctx.save();
    ctx.translate(hx, hy);

    // Bright impact spark
    const sparkR = 10 * hullGlow + 4;
    ctx.globalAlpha = hullGlow;
    ctx.fillStyle = getHullSparkGrad(ctx, sparkR);
    ctx.beginPath(); ctx.arc(0, 0, sparkR, 0, TAU); ctx.fill();

    // Scorch ring
    ctx.globalAlpha = hullGlow * 0.6;
    ctx.strokeStyle = "rgba(255,140,40,0.8)";
    ctx.lineWidth = 1.5 * hullGlow;
    ctx.beginPath(); ctx.arc(0, 0, 6 + (1 - hullGlow) * 8, 0, TAU); ctx.stroke();

    // Debris sparks
    ctx.globalAlpha = hullGlow * 0.5;
    const sparkCount = 5;
    for (let i = 0; i < sparkCount; i++) {
      const sa = hullAngle + (i - 2) * 0.4 + Math.PI;
      const sd = 8 + (1 - hullGlow) * 14;
      const sx = Math.cos(sa) * sd;
      const sy = Math.sin(sa) * sd;
      ctx.fillStyle = i % 2 === 0 ? "#ffbb44" : "#ff6622";
      ctx.fillRect(sx - 1.5, sy - 1.5, 3, 3);
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

export function drawAmbientLife(sys: System, now: number, _dt: number) {
  if (!sys._ambientTraders) return;
  for (const t of sys._ambientTraders) {
    if (!isVisible(t.x, t.y, 4)) continue;
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "#aaccff";
    ctx.beginPath();
    ctx.arc(t.x, t.y, 1.5, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}
