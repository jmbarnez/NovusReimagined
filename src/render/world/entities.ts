import { G, Client } from "../../state.js";
import { ctx } from "../../canvas.js";
import { TAU } from "../../constants.js";
import { lerp, dst } from "../../utils/math.js";
import { isVisible } from "../../utils/game.js";
import { getStats } from "../../player/player-stats.js";
import { SHIPS } from "../../data/ships.js";
import { ENEMY_DEFS } from "../../data/enemies.js";
import { worldText } from "../world-text.js";

export function drawLockBrackets(
  cx: number, cy: number, radius: number,
  slot: any, primaryId: string | undefined, entityId: string | undefined,
  now: number,
) {
  if (!slot || !entityId) return;
  const isPrimary = entityId === primaryId;

  // EVE-style corner brackets — short L-shaped ticks at each corner of an
  // invisible bounding square. While resolving they flash dim; once locked
  // they sit solid and steady.
  const sz = isPrimary ? radius + 9 : radius + 6;
  const arm = isPrimary ? 7 : 5;

  let color: string;
  let alpha: number;
  let lineWidth: number;

  if (slot.resolving) {
    // Soft blink ~2.2 Hz; dull cool grey-blue.
    const blink = 0.5 + 0.5 * Math.sin(now * 0.014);
    color = "#5a7a90";
    alpha = 0.30 + 0.40 * blink;
    lineWidth = 1.2;
  } else {
    // Locked: solid, no blink. Primary slightly warmer / brighter.
    color = isPrimary ? "#b88a55" : "#6a7c8c";
    alpha = isPrimary ? 0.85 : 0.65;
    lineWidth = isPrimary ? 1.6 : 1.3;
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

  if (!slot.resolving && isPrimary) {
    worldText(cx, cy, "PRIM", {
      font: "bold 8px ui-monospace, monospace",
      fill: "#c89868",
      offsetY: sz + 10,
      shadow: true,
      alpha: 0.85,
    });
  }
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

const _asteroidLockMap = new Map<string, any>();

export function drawAsteroids(alpha: number, sys: any, now: number) {
  if (!sys?._liveAsteroids) return;
  const mineR = getStats().mineRange;
  _asteroidLockMap.clear();
  const primaryId = G.P.targetLock?.id;
  if (Array.isArray(G.P.lockQueue)) {
    for (const slot of G.P.lockQueue) _asteroidLockMap.set(slot.id, slot);
  }
  for (const a of sys._liveAsteroids) {
    if (!isVisible(a.x, a.y, a.radius + 10)) continue;
    const near = dst(G.P.x, G.P.y, a.x, a.y) - a.radius < mineR;
    const iSpin = lerp(a.prevSpin, a.spinAngle, alpha);
    // 3D drop shadow on the "ground" plane beneath the asteroid
    const sg = ctx.createRadialGradient(a.x + a.radius * 0.1, a.y + a.radius * 0.25, 0, a.x + a.radius * 0.1, a.y + a.radius * 0.25, a.radius * 1.1);
    sg.addColorStop(0, "rgba(0,0,0,0.32)");
    sg.addColorStop(0.55, "rgba(0,0,0,0.14)");
    sg.addColorStop(1, "transparent");
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.ellipse(a.x + a.radius * 0.1, a.y + a.radius * 0.25, a.radius * 0.8, a.radius * 0.35, 0, 0, TAU); ctx.fill();

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
    // Direction from this asteroid toward the star at (0,0), then into local frame
    const localSun = Math.atan2(-a.y, -a.x) - iSpin;
    const aHL = a.radius * 0.38;
    const hlx = Math.cos(localSun) * aHL, hly = Math.sin(localSun) * aHL;
    const ag = ctx.createRadialGradient(hlx, hly, 0, 0, 0, a.radius);
    ag.addColorStop(0, `hsl(${h},${s + 4}%,${44 + hp * 14}%)`);
    ag.addColorStop(0.45, `hsl(${h},${s}%,${22 + hp * 8}%)`);
    ag.addColorStop(0.85, `hsl(${h},${Math.max(0, s - 4)}%,${10 + hp * 5}%)`);
    ag.addColorStop(1, `hsl(${h},${Math.max(0, s - 6)}%,${4 + hp * 3}%)`);
    ctx.fillStyle = ag; ctx.fill();
    // Directional shadow overlay — dark side away from sun
    if (Client.settings?.directionalLighting !== false) {
      ctx.save(); ctx.beginPath();
      ctx.moveTo(a.shape[0][0] * a.radius, a.shape[0][1] * a.radius);
      for (let i = 1; i < a.shape.length; i++) ctx.lineTo(a.shape[i][0] * a.radius, a.shape[i][1] * a.radius);
      ctx.closePath(); ctx.clip();
      const sdx = Math.cos(localSun), sdy = Math.sin(localSun);
      const shadeG = ctx.createLinearGradient(sdx * a.radius, sdy * a.radius, -sdx * a.radius, -sdy * a.radius);
      shadeG.addColorStop(0, "rgba(0,0,0,0)");
      shadeG.addColorStop(0.4, "rgba(0,0,0,0)");
      shadeG.addColorStop(0.75, "rgba(0,0,0,0.50)");
      shadeG.addColorStop(1, "rgba(0,0,0,0.78)");
      ctx.fillStyle = shadeG; ctx.fillRect(-a.radius, -a.radius, a.radius * 2, a.radius * 2);
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

const _enemyLockMap = new Map<string, any>();

/**
 * Draws only the lock brackets / scan ring for each enemy.
 * Enemy hulls, HP bars, labels, and targeting indicators are now
 * rendered by PixiJS in pixi-entities.ts (syncPixiEntities).
 */
export function drawEnemyOverlays(alpha: number, sys: any, now: number) {
  if (!sys?._liveEnemies) return;
  _enemyLockMap.clear();
  const primaryId = G.P.targetLock?.id;
  if (Array.isArray(G.P.lockQueue)) {
    for (const slot of G.P.lockQueue) _enemyLockMap.set(slot.id, slot);
  }
  for (const e of sys._liveEnemies) {
    if (!isVisible(e.x, e.y, 40)) continue;
    const ix = lerp(e.px, e.x, alpha);
    const iy = lerp(e.py, e.y, alpha);
    drawLockBrackets(ix, iy, 18, _enemyLockMap.get(e.id), primaryId, e.id, now);
  }
}

/**
 * Draws player hit-effect overlays only (shield pulse + hull spark).
 * Hull body + thrust flames are rendered by syncPixiPlayer in pixi-player.ts.
 */
export function drawPlayer(now: number, alpha: number) {
  if (!G.P) return;
  const shieldGlow = G.P.shieldHitGlow || 0;
  const hullGlow = G.P.hullHitGlow || 0;
  if (shieldGlow <= 0 && hullGlow <= 0) return;

  const ix = lerp(G.P.px, G.P.x, alpha), iy = lerp(G.P.py, G.P.y, alpha);
  const ia = lerp(G.P.prevAngle, G.P.angle, alpha);
  if (G.P.invincible > 0 && Math.floor(now / 75) % 2 === 0) return;

  const latV = G.P.vx * Math.sin(ia) - G.P.vy * Math.cos(ia);
  const bankTilt = Math.max(-0.13, Math.min(0.13, latV * 0.0045));
  const angle = ia + (Math.abs(bankTilt) > 0.002 ? bankTilt : 0);

  ctx.save(); ctx.translate(ix, iy); ctx.rotate(angle);

  const shieldR = 34;
  const glow = shieldGlow;

  // Shield is completely invisible until impacted — only the impact pulse shows
  if (glow > 0) {
    // Convert world-space hit angle to local (ship-rotated) coordinates
    const hitAngle = G.P.shieldHitAngle - ia;
    const hx = Math.cos(hitAngle) * shieldR;
    const hy = Math.sin(hitAngle) * shieldR;
    const t = 1 - glow; // 0 at impact, 1 as it fades

    // Clip to shield sphere so everything looks like it's on the surface
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, shieldR, 0, TAU); ctx.clip();

    // Faint full-sphere flash that fades with the glow
    const sphereA = glow * 0.12;
    const bubble = ctx.createRadialGradient(-5, -6, 2, 0, 0, shieldR);
    bubble.addColorStop(0, `rgba(30,100,180,${sphereA * 0.15})`);
    bubble.addColorStop(0.5, `rgba(40,140,210,${sphereA * 0.4})`);
    bubble.addColorStop(0.78, `rgba(50,170,240,${sphereA * 0.75})`);
    bubble.addColorStop(0.88, `rgba(80,200,255,${sphereA * 1.0})`);
    bubble.addColorStop(0.94, `rgba(100,220,255,${sphereA * 0.7})`);
    bubble.addColorStop(1, `rgba(40,120,200,0)`);
    ctx.fillStyle = bubble;
    ctx.beginPath(); ctx.arc(0, 0, shieldR, 0, TAU); ctx.fill();

    // Bright impact flash at the exact contact point
    ctx.globalAlpha = glow * 0.95;
    const flashG = ctx.createRadialGradient(hx, hy, 0, hx, hy, 14);
    flashG.addColorStop(0, "rgba(230,250,255,1.0)");
    flashG.addColorStop(0.35, "rgba(150,220,255,0.55)");
    flashG.addColorStop(0.7, "rgba(80,190,255,0.15)");
    flashG.addColorStop(1, "rgba(40,150,255,0)");
    ctx.fillStyle = flashG;
    ctx.beginPath(); ctx.arc(hx, hy, 14, 0, TAU); ctx.fill();

    // Expanding concentric ripples from impact point
    for (let i = 0; i < 3; i++) {
      const phase = t * 1.5 - i * 0.2;
      if (phase <= 0 || phase >= 1) continue;
      const rippleR = phase * shieldR * 2.2;
      const rippleA = glow * (1 - phase) * 0.7;
      ctx.globalAlpha = rippleA;
      ctx.strokeStyle = "#aaddff";
      ctx.lineWidth = 2.2 * (1 - phase);
      ctx.beginPath(); ctx.arc(hx, hy, rippleR, 0, TAU); ctx.stroke();
    }

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
    const hullAngle = G.P.hullHitAngle - ia;
    const hx = Math.cos(hullAngle) * 18;
    const hy = Math.sin(hullAngle) * 18;

    ctx.globalAlpha = hullGlow;

    // Bright impact spark
    const sparkG = ctx.createRadialGradient(hx, hy, 0, hx, hy, 10 * hullGlow + 4);
    sparkG.addColorStop(0, "rgba(255,255,220,0.95)");
    sparkG.addColorStop(0.25, "rgba(255,180,60,0.7)");
    sparkG.addColorStop(0.6, "rgba(255,100,30,0.25)");
    sparkG.addColorStop(1, "rgba(200,50,10,0)");
    ctx.fillStyle = sparkG;
    ctx.beginPath(); ctx.arc(hx, hy, 10 * hullGlow + 4, 0, TAU); ctx.fill();

    // Scorch ring
    ctx.globalAlpha = hullGlow * 0.6;
    ctx.strokeStyle = "rgba(255,140,40,0.8)";
    ctx.lineWidth = 1.5 * hullGlow;
    ctx.beginPath(); ctx.arc(hx, hy, 6 + (1 - hullGlow) * 8, 0, TAU); ctx.stroke();

    // Debris sparks
    ctx.globalAlpha = hullGlow * 0.5;
    const sparkCount = 5;
    for (let i = 0; i < sparkCount; i++) {
      const sa = hullAngle + (i - 2) * 0.4 + Math.PI;
      const sd = 8 + (1 - hullGlow) * 14;
      const sx = hx + Math.cos(sa) * sd;
      const sy = hy + Math.sin(sa) * sd;
      ctx.fillStyle = i % 2 === 0 ? "#ffbb44" : "#ff6622";
      ctx.fillRect(sx - 1.5, sy - 1.5, 3, 3);
    }

    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

export function drawAmbientLife(sys: any, now: number, _dt: number) {
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
