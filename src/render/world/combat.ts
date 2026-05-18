import { G, Client } from "../../state.js";
import { ctx } from "../../canvas.js";
import { TAU } from "../../constants.js";
import { lerp } from "../../utils/math.js";
import { isVisible } from "../../utils/game.js";
import { getThemeColors } from "../../data/settings.js";
import { getSalvagerBeam } from "../../salvager.js";
import { radialGlow } from "../grad-cache.js";

// Cached multi-stop glows for the mining laser / salvager contact points.
// Baked at pulse=1; per-frame pulse is folded into globalAlpha by the caller.
let _miningHotGrad: CanvasGradient | null = null;
let _miningFadeGrad: CanvasGradient | null = null;
const _salvageSparkCache = new Map<number, CanvasGradient>();

function miningHotGrad(): CanvasGradient {
  if (_miningHotGrad) return _miningHotGrad;
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 16);
  g.addColorStop(0, "rgba(255,255,200,0.9)");
  g.addColorStop(0.35, "rgba(255,230,80,0.65)");
  g.addColorStop(1, "rgba(255,180,20,0)");
  _miningHotGrad = g;
  return g;
}

function miningFadeGrad(): CanvasGradient {
  if (_miningFadeGrad) return _miningFadeGrad;
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 8);
  g.addColorStop(0, "rgba(255,255,180,0.5)");
  g.addColorStop(1, "rgba(255,230,80,0)");
  _miningFadeGrad = g;
  return g;
}

function salvageSparkGrad(radius: number): CanvasGradient {
  let g = _salvageSparkCache.get(radius);
  if (g) return g;
  g = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  g.addColorStop(0, "rgba(0,255,80,0.9)");
  g.addColorStop(1, "rgba(0,200,60,0)");
  _salvageSparkCache.set(radius, g);
  return g;
}

export function drawBullets(alpha: number, sys: any) {
  for (const b of G.bullets) {
    if (!isVisible(b.x, b.y, 14)) continue;
    const ix = lerp(b.px, b.x, alpha), iy = lerp(b.py, b.y, alpha);
    const spd = Math.hypot(b.vx, b.vy);
    const kind = b.kind || "projectile";
    const isMissile = kind === "missile";
    const isGauss = b.weaponId === "tu-gauss";

    // Longer, richer trails for heavy weapons
    const trailSegs = isMissile ? 5 : isGauss ? 4 : 3;
    if (spd > 0) {
      const ndx = -b.vx / spd, ndy = -b.vy / spd;
      ctx.save();
      for (let t = trailSegs; t >= 1; t--) {
        const dist = b.sz * (isGauss ? 3.2 : 2.5) * t;
        const ta = (0.12 + (trailSegs - t) * 0.06) * (isMissile ? 0.85 : 1);
        const tr = b.sz * (0.8 - t * (isGauss ? 0.1 : 0.14));
        ctx.globalAlpha = ta;
        ctx.fillStyle = b.trail || b.color;
        ctx.beginPath();
        ctx.arc(ix + ndx * dist, iy + ndy * dist, Math.max(0.4, tr), 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }

    // Head glow scaled by weapon type
    ctx.save();
    ctx.globalAlpha = isGauss ? 0.65 : 0.5;
    const glowR = b.sz * (isGauss ? 4 : isMissile ? 3.2 : 2.5);
    ctx.translate(ix, iy);
    ctx.fillStyle = radialGlow(ctx, b.color, glowR);
    ctx.beginPath(); ctx.arc(0, 0, glowR, 0, TAU); ctx.fill();
    ctx.restore();

    // Core bullet / slug
    ctx.save();
    ctx.fillStyle = b.color;
    if (isGauss) {
      // Oblong slug shape
      const ba = Math.atan2(b.vy, b.vx);
      ctx.translate(ix, iy); ctx.rotate(ba);
      ctx.beginPath(); ctx.ellipse(0, 0, b.sz * 1.4, b.sz * 0.65, 0, 0, TAU); ctx.fill();
      ctx.rotate(-ba); ctx.translate(-ix, -iy);
    } else if (isMissile) {
      ctx.beginPath(); ctx.arc(ix, iy, b.sz * 0.9, 0, TAU); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(ix, iy, b.sz, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = "rgba(255,255,255,0.28)"; ctx.lineWidth = isGauss ? 1.1 : 0.85; ctx.stroke();
    ctx.restore();
  }
  for (const b of G.enemyBullets) {
    if (!isVisible(b.x, b.y, 14)) continue;
    const ix = lerp(b.px, b.x, alpha), iy = lerp(b.py, b.y, alpha);
    const spd = Math.hypot(b.vx, b.vy);
    const sz = b.sz || 3;
    const color = b.color || "#ff5533";

    if (spd > 0) {
      const ndx = -b.vx / spd, ndy = -b.vy / spd;
      ctx.save();
      for (let t = 2; t >= 1; t--) {
        const dist = sz * 2.5 * t;
        const ta = (0.12 + (2 - t) * 0.06);
        const tr = sz * (0.8 - t * 0.14);
        ctx.globalAlpha = ta;
        ctx.fillStyle = b.trail || color;
        ctx.beginPath(); ctx.arc(ix + ndx * dist, iy + ndy * dist, Math.max(0.4, tr), 0, TAU); ctx.fill();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = 0.35;
    const glowR = sz * 2.5;
    ctx.translate(ix, iy);
    ctx.fillStyle = radialGlow(ctx, color, glowR);
    ctx.beginPath(); ctx.arc(0, 0, glowR, 0, TAU); ctx.fill();
    ctx.restore();

    ctx.save(); ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(ix, iy, sz, 0, TAU); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 0.8; ctx.stroke(); ctx.restore();
  }
}

export function drawBeams(sys: any) {
  for (const b of G.beams) {
    ctx.save(); ctx.globalAlpha = b.life * .92; ctx.shadowBlur = 0;
    ctx.strokeStyle = b.color; ctx.lineWidth = b.width; ctx.lineCap = "butt";
    ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
    ctx.globalAlpha = b.life * .45; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = b.width * .35;
    ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
    ctx.restore();
  }
}

export function drawMiningLaser(now: number) {
  if (!G.miningLaser.active) return;
  const { x1, y1, x2, y2, phase, hitNx, hitNy, hitR } = G.miningLaser;
  const pulse = 0.82 + 0.18 * Math.sin(now * 0.022);
  const hittingAsteroid = hitR > 0;
  let endX = x2, endY = y2;
  if (hittingAsteroid) {
    const osc = Math.sin(phase || 0) * 3.5;
    endX += -(hitNy || 0) * osc;
    endY += (hitNx || 1) * osc;
  }

  ctx.save();

  ctx.globalAlpha = 0.28 * pulse;
  ctx.strokeStyle = "rgb(255,220,40)";
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(endX, endY); ctx.stroke();

  ctx.globalAlpha = 0.65 * pulse;
  ctx.strokeStyle = "rgb(255,230,80)";
  ctx.lineWidth = 4.5;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(endX, endY); ctx.stroke();

  ctx.globalAlpha = 0.95 * pulse;
  ctx.strokeStyle = "rgb(255,255,180)";
  ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(endX, endY); ctx.stroke();

  if (hittingAsteroid) {
    // Cached gradient is baked at pulse=1; fold the per-stop pulse into globalAlpha.
    ctx.globalAlpha = pulse * pulse;
    ctx.save();
    ctx.translate(endX, endY);
    ctx.fillStyle = miningHotGrad();
    ctx.beginPath(); ctx.arc(0, 0, 16, 0, TAU); ctx.fill();
    ctx.restore();

    const sparkCount = 3;
    for (let i = 0; i < sparkCount; i++) {
      const sa = Math.atan2(hitNy || 0, hitNx || 1) + (Math.random() - 0.5) * 1.6;
      const sd = 4 + Math.random() * 10;
      const sx = endX + Math.cos(sa) * sd;
      const sy = endY + Math.sin(sa) * sd;
      const sz = 1.0 + Math.random() * 1.5;
      ctx.globalAlpha = 0.4 + Math.random() * 0.4;
      ctx.fillStyle = Math.random() < 0.5 ? "#ffee66" : "#ffaa22";
      ctx.beginPath(); ctx.arc(sx, sy, sz, 0, TAU); ctx.fill();
    }
  } else {
    ctx.globalAlpha = pulse * 0.6 * pulse;
    ctx.save();
    ctx.translate(endX, endY);
    ctx.fillStyle = miningFadeGrad();
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

export function drawSalvagerBeam() {
  const sv = getSalvagerBeam();
  if (!sv.active) return;
  const { x1, y1, x2, y2, phase } = sv;
  const pulse = 0.7 + 0.3 * Math.sin(phase * 2.5);

  ctx.save();
  ctx.lineCap = "round";

  // Outer glow
  ctx.globalAlpha = 0.18 * pulse;
  ctx.strokeStyle = "#00cc44";
  ctx.lineWidth = 10;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();

  // Animated dashed core beam
  ctx.globalAlpha = 0.60 * pulse;
  ctx.strokeStyle = "#00ff55";
  ctx.lineWidth = 2.5;
  ctx.setLineDash([14, 10]);
  ctx.lineDashOffset = -phase * 16;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.setLineDash([]);

  // Bright center line
  ctx.globalAlpha = 0.90 * pulse;
  ctx.strokeStyle = "#aaffbb";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();

  // Sparkle at wreck contact point — cached gradient baked at pulse=1.
  const sparkR = Math.max(1, Math.round((4 + Math.sin(phase * 4) * 2) * 2));
  ctx.globalAlpha = pulse * pulse;
  ctx.save();
  ctx.translate(x2, y2);
  ctx.fillStyle = salvageSparkGrad(sparkR);
  ctx.beginPath(); ctx.arc(0, 0, sparkR, 0, TAU); ctx.fill();
  ctx.restore();

  ctx.restore();
}

export function drawCrosshair() {
  const { x, y } = Client.mouseWorld;
  const sz = 12 / Client.zoom;
  const theme = getThemeColors(Client.settings?.theme || "default");

  ctx.save();
  ctx.strokeStyle = theme.textMain;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 1.5 / Client.zoom;
  ctx.beginPath();
  ctx.moveTo(x - sz, y); ctx.lineTo(x + sz, y);
  ctx.moveTo(x, y - sz); ctx.lineTo(x, y + sz);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, sz * 0.6, 0, TAU);
  ctx.stroke();
  ctx.restore();
}
