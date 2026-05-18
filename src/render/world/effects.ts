import { G } from "../../state.js";
import { ctx } from "../../canvas.js";
import { TAU } from "../../constants.js";
import { isVisible } from "../../utils/game.js";
import { getStarCfg, hexToRgb } from "./celestial.js";
import { addImpactDecal, removeImpactDecal } from "../../utils/entities.js";
import { worldText, worldCardText } from "../world-text.js";

export function drawShockwaves() {
  if (!G.shockwaves?.length) return;
  ctx.save();
  for (const s of G.shockwaves) {
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

export function drawFloatTexts(sys: any) {
  if (!sys) return;
  for (const f of G.floatTexts) {
    if (!isVisible(f.x, f.y, 20)) continue;
    const alpha = f.life ?? 1;
    if (f.bgColor) {
      worldCardText(f.x, f.y, f.text, {
        textColor: "#ffffff",
        bgColor: f.bgColor,
        alpha,
      });
    } else {
      worldText(f.x, f.y, f.text, {
        font: "bold 12px monospace",
        fill: f.color ?? "#ffffff",
        alpha,
        shadow: true,
      });
    }
  }
}

export function updateAndDrawImpactDecals(dt: number) {
  const decals = G.impactDecals;
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

export function spawnImpactDecal(x: number, y: number, color = "#ff8844") {
  if (G.impactDecals.length >= 80) removeImpactDecal(0);
  const pts: number[][] = [];
  const n = 5 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + (Math.random() - 0.5) * 0.8;
    const r = 4 + Math.random() * 10;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  addImpactDecal({ x, y, poly: pts, color, life: 8, maxLife: 8 });
}

/**
 * Optical lens flare — small artifact circles strung along the star→screen-center
 * axis, with a faint horizontal streak when the star is near mid-screen.
 * Drawn in screen space with "lighter" after the world restore.
 */
export function drawLensFlare(Wc: number, Hc: number, camxR: number, camyR: number, zoom: number, sys: any) {
  const sx = Wc / 2 - camxR * zoom;
  const sy = Hc / 2 - camyR * zoom;
  if (sx < -300 || sx > Wc + 300 || sy < -300 || sy > Hc + 300) return;

  const cfg = getStarCfg(sys?.starClass ?? "G");
  const rgb = hexToRgb(cfg.coronaColor);
  const coreRgb = hexToRgb(cfg.coreColor);
  const cx = Wc / 2, cy = Hc / 2;
  const dx = cx - sx, dy = cy - sy;
  const distToCenter = Math.hypot(dx, dy);
  const proximity = Math.max(0, Math.min(1, distToCenter / (Math.hypot(Wc, Hc) * 0.15)));

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  // Artifact circles along the axis (t=0 is star, t=1 is screen center, t>1 is beyond)
  const artifacts: Array<{ t: number; r: number; a: number; warm: boolean }> = [
    { t: 0.28, r: 6,  a: 0.04, warm: true  },
    { t: 0.50, r: 22, a: 0.02, warm: false },
    { t: 0.72, r: 4,  a: 0.05, warm: true  },
    { t: 0.90, r: 14, a: 0.025, warm: false },
    { t: 1.15, r: 32, a: 0.015, warm: false },
    { t: 1.35, r: 8,  a: 0.03, warm: true  },
    { t: 1.60, r: 18, a: 0.012, warm: false },
  ];

  for (const art of artifacts) {
    const ax = sx + dx * art.t;
    const ay = sy + dy * art.t;
    const alpha = art.a * proximity;
    const artRgb = art.warm ? coreRgb : rgb;
    const ag = ctx.createRadialGradient(ax, ay, 0, ax, ay, art.r);
    ag.addColorStop(0, `rgba(${artRgb},${alpha})`);
    ag.addColorStop(0.5, `rgba(${artRgb},${alpha * 0.4})`);
    ag.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = ag;
    ctx.beginPath(); ctx.arc(ax, ay, art.r, 0, TAU); ctx.fill();
  }

  // Horizontal glare streak through the star
  if (distToCenter > 10) {
    const streakAlpha = proximity * 0.012;
    const streakW = Wc * 0.55;
    const sg = ctx.createLinearGradient(sx - streakW, sy, sx + streakW, sy);
    sg.addColorStop(0.00, "rgba(0,0,0,0)");
    sg.addColorStop(0.38, `rgba(${coreRgb},${streakAlpha * 0.35})`);
    sg.addColorStop(0.50, `rgba(${coreRgb},${streakAlpha})`);
    sg.addColorStop(0.62, `rgba(${coreRgb},${streakAlpha * 0.35})`);
    sg.addColorStop(1.00, "rgba(0,0,0,0)");
    ctx.fillStyle = sg;
    ctx.fillRect(sx - streakW, sy - 2, streakW * 2, 4);
  }

  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
}
