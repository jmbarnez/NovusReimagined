
import { ctx } from "../../canvas.js";
import { getState } from "../../state-access.js";
import { TAU } from "../../constants.js";
import { isVisible } from "../../utils/game.js";
import { addImpactDecal, removeImpactDecal } from "../../utils/entities.js";
import { worldText, worldCardText } from "../world-text.js";
import { getUIFont } from "../ui-font.js";
import { Client } from "../../state.js";
import { getDistantSunScreenPos } from "../pixi-background.js";
import type { System } from "../../types/world.js";

export function drawShockwaves() {
  const state = getState();
  if (!state.shockwaves?.length) return;
  ctx.save();
  for (const s of state.shockwaves) {
    if (!isVisible(s.x, s.y, s.maxRadius)) continue;
    const a = s.life / Math.max(0.001, s.maxLife);
    ctx.globalAlpha = a * 0.55;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width * a;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.radius || 0, 0, TAU);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

export function drawFloatTexts(sys: System) {
  if (!sys) return;
  const state = getState();
  for (const f of state.floatTexts) {
    if (!isVisible(f.x, f.y, 20)) continue;
    const alpha = f.life ?? 1;
    if (f.bgColor) {
      worldCardText(f.x, f.y, f.text, {
        textColor: "#000000",
        bgColor: f.bgColor,
        alpha,
      });
    } else {
      worldText(f.x, f.y, f.text, {
        font: `bold 12px ${getUIFont()}`,
        fill: f.color ?? "#ffffff",
        alpha,
        shadow: true,
      });
    }
  }
}

export function updateAndDrawImpactDecals(dt: number) {
  const state = getState();
  const decals = state.impactDecals;
  for (let i = decals.length - 1; i >= 0; i--) {
    const d = decals[i];
    d.life -= dt;
    if (d.life <= 0) { removeImpactDecal(i); continue; }
    if (!isVisible(d.x, d.y, 30)) continue;
    const a = (d.life / d.maxLife) * 0.6;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(d.x, d.y);
    ctx.fillStyle = d.color;
    ctx.beginPath();
    for (let j = 0; j < d.poly.length; j++) {
      const [px, py] = d.poly[j];
      j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
  }
}

// ── Cinematic lens flare ────────────────────────────────────────────────────
// Screen-space effect anchored to the distant-sun sprite position. Draws after
// the world-clipped block so all elements are in CSS-pixel screen coordinates.
export function drawLensFlare(Wc: number, Hc: number) {
  if (!Client.settings?.lensFlare) return;

  const { x: sx, y: sy } = getDistantSunScreenPos();
  if (sx === 0 && sy === 0) return;  // sun not yet positioned

  // Direction from sun to screen center (axis along which ghosts string)
  const cx = Wc / 2, cy = Hc / 2;
  const dx = cx - sx, dy = cy - sy;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return;
  const nx = dx / dist, ny = dy / dist;

  // Proximity-only strength — no base value so the flare vanishes at screen edges
  const proximity = Math.max(0, 1 - dist / (Math.min(Wc, Hc) * 0.7));
  const strength  = proximity * 0.7;
  if (strength < 0.01) { ctx.restore(); return; }

  ctx.save();

  // 1. Anamorphic horizontal streak ─────────────────────────────────────
  {
    const sW = Wc * 0.14, sH = 1 + proximity;
    const g = ctx.createLinearGradient(sx - sW / 2, sy, sx + sW / 2, sy);
    g.addColorStop(0.00, "rgba(0,0,0,0)");
    g.addColorStop(0.30, "rgba(0,0,0,0)");
    g.addColorStop(0.50, `rgba(255,240,200,${0.05 * strength})`);
    g.addColorStop(0.70, "rgba(0,0,0,0)");
    g.addColorStop(1.00, "rgba(0,0,0,0)");
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = g;
    ctx.fillRect(sx - sW / 2, sy - sH / 2, sW, sH);
    ctx.restore();
  }

  // 2. Ghost circles strung along the sun→center axis ──────────────────
  const ghosts = [
    { t: 0.30, r:  8, color: "255,200,120" },
    { t: 0.60, r: 16, color: "180,210,255" },
    { t: 0.90, r:  6, color: "255,160,100" },
    { t: 1.20, r: 10, color: "200,180,255" },
  ];
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const g of ghosts) {
    const gx = sx + dx * g.t;
    const gy = sy + dy * g.t;
    const alpha = 0.03 * strength;
    const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, g.r);
    grad.addColorStop(0.0, `rgba(${g.color},${alpha})`);
    grad.addColorStop(0.5, `rgba(${g.color},${alpha * 0.3})`);
    grad.addColorStop(1.0, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(gx, gy, g.r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // 3. Chromatic chord — thin dispersion artifact crossing the streak ──
  {
    const chord = ctx.createLinearGradient(sx - 10, sy, sx + 10, sy);
    chord.addColorStop(0.0, `rgba(255,60,60,${0.02 * strength})`);
    chord.addColorStop(0.5, `rgba(60,255,60,${0.015 * strength})`);
    chord.addColorStop(1.0, `rgba(60,60,255,${0.02 * strength})`);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = chord;
    ctx.fillRect(sx - 10, sy - 1, 20, 2);
    ctx.restore();
  }

  ctx.restore();
}

export function spawnImpactDecal(x: number, y: number, color = "#ff8844") {
  const state = getState();
  if (state.impactDecals.length >= 80) removeImpactDecal(0);
  const pts: number[][] = [];
  const n = 5 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + (Math.random() - 0.5) * 0.8;
    const r = 4 + Math.random() * 10;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  addImpactDecal({ x, y, poly: pts, color, life: 8, maxLife: 8 });
}

