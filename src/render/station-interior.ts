import { getState } from "../state-access.js";

import { ctx, W, H } from "../canvas.js";
import { TAU } from "../constants.js";
import { shipPath } from "./world/entities.js";

interface InteriorDust {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  alpha: number;
}

const _dust: InteriorDust[] = [];
for (let i = 0; i < 40; i++) {
  _dust.push({
    x: Math.random(),
    y: Math.random(),
    vx: (Math.random() - 0.5) * 0.02,
    vy: (Math.random() - 0.5) * 0.015,
    r: 0.5 + Math.random() * 1.5,
    alpha: 0.1 + Math.random() * 0.3,
  });
}

interface InteriorSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

let _sparks: InteriorSpark[] = [];
let _nextSpark = 0;

export function drawStationInterior(Wc: number, Hc: number, now: number) {
  const cx = Wc / 2;
  const cy = Hc / 2;
  const floorY = cy + 80;

  // ── Background ──
  ctx.fillStyle = "#030508";
  ctx.fillRect(0, 0, Wc, Hc);

  const bgGlow = ctx.createRadialGradient(cx, cy - 40, 0, cx, cy - 40, Math.max(Wc, Hc) * 0.6);
  bgGlow.addColorStop(0, "rgba(10,25,40,0.25)");
  bgGlow.addColorStop(1, "rgba(3,5,8,0)");
  ctx.fillStyle = bgGlow;
  ctx.fillRect(0, 0, Wc, Hc);

  // ── Side walls (dark panels) ──
  const wallGradL = ctx.createLinearGradient(0, 0, Wc * 0.25, 0);
  wallGradL.addColorStop(0, "rgba(4,8,12,0.95)");
  wallGradL.addColorStop(1, "rgba(4,8,12,0)");
  ctx.fillStyle = wallGradL;
  ctx.fillRect(0, 0, Wc * 0.35, Hc);

  const wallGradR = ctx.createLinearGradient(Wc, 0, Wc * 0.75, 0);
  wallGradR.addColorStop(0, "rgba(4,8,12,0.95)");
  wallGradR.addColorStop(1, "rgba(4,8,12,0)");
  ctx.fillStyle = wallGradR;
  ctx.fillRect(Wc * 0.65, 0, Wc * 0.35, Hc);

  // Horizontal wall stripes
  ctx.strokeStyle = "rgba(20,40,55,0.35)";
  ctx.lineWidth = 1;
  for (let y = 40; y < Hc; y += 60) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(Wc * 0.18, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(Wc, y); ctx.lineTo(Wc * 0.82, y); ctx.stroke();
  }

  // ── Floor perspective grid ──
  ctx.save();
  ctx.strokeStyle = "rgba(20,45,65,0.35)";
  ctx.lineWidth = 1;
  const vanishY = Hc + 120;
  // Radial lines from vanishing point
  for (let i = -8; i <= 8; i++) {
    const ang = i * 0.09;
    ctx.beginPath();
    ctx.moveTo(cx + Math.sin(ang) * 40, floorY + Math.cos(ang) * 20);
    ctx.lineTo(cx + Math.sin(ang) * (Wc * 0.8), vanishY);
    ctx.stroke();
  }
  // Horizontal arcs
  for (let d = 0; d < 8; d++) {
    const y = floorY + d * 55 + (d * d) * 3;
    if (y > Hc) break;
    const w = 120 + d * 160;
    ctx.globalAlpha = 0.25 - d * 0.025;
    ctx.beginPath();
    ctx.ellipse(cx, y, w, 12, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // ── Overhead light strips ──
  const stripW = 180;
  for (const sx of [cx - stripW - 40, cx + 40]) {
    const lg = ctx.createLinearGradient(sx, 0, sx + stripW, 0);
    lg.addColorStop(0, "rgba(30,80,110,0)");
    lg.addColorStop(0.5, "rgba(60,160,200,0.12)");
    lg.addColorStop(1, "rgba(30,80,110,0)");
    ctx.fillStyle = lg;
    ctx.fillRect(sx, 0, stripW, Hc * 0.55);
  }

  // ── Pulsing status lamps ──
  const lampPulse = 0.6 + 0.4 * Math.sin(now * 0.0018);
  for (const lx of [Wc * 0.12, Wc * 0.88]) {
    const lg = ctx.createRadialGradient(lx, Hc * 0.22, 0, lx, Hc * 0.22, 60);
    lg.addColorStop(0, `rgba(40,130,180,${0.18 * lampPulse})`);
    lg.addColorStop(1, "rgba(40,130,180,0)");
    ctx.fillStyle = lg;
    ctx.beginPath(); ctx.arc(lx, Hc * 0.22, 60, 0, TAU); ctx.fill();
  }

  // ── Circular viewport (top center) with drifting stars ──
  const vpR = 55;
  const vpX = cx;
  const vpY = 75;
  ctx.save();
  ctx.beginPath(); ctx.arc(vpX, vpY, vpR, 0, TAU); ctx.clip();
  ctx.fillStyle = "#02040a";
  ctx.fillRect(vpX - vpR, vpY - vpR, vpR * 2, vpR * 2);
  // Drift stars
  ctx.fillStyle = "#88aacc";
  for (let s = 0; s < 18; s++) {
    const sx = (vpX + Math.sin(s * 1.3 + now * 0.0002 * (s % 3 + 1)) * (vpR - 4));
    const sy = (vpY + Math.cos(s * 2.1 + now * 0.00015 * (s % 4 + 1)) * (vpR - 4));
    ctx.beginPath(); ctx.arc(sx, sy, 0.8 + (s % 3) * 0.4, 0, TAU); ctx.fill();
  }
  ctx.restore();
  // Viewport rim
  ctx.strokeStyle = "rgba(40,90,120,0.5)";
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(vpX, vpY, vpR, 0, TAU); ctx.stroke();
  ctx.strokeStyle = "rgba(60,140,180,0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(vpX, vpY, vpR + 3, 0, TAU); ctx.stroke();

  // ── Docking platform ──
  ctx.save();
  ctx.translate(cx, floorY + 30);
  const platGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, 140);
  platGlow.addColorStop(0, "rgba(20,50,70,0.35)");
  platGlow.addColorStop(0.6, "rgba(15,40,60,0.15)");
  platGlow.addColorStop(1, "rgba(10,30,50,0)");
  ctx.fillStyle = platGlow;
  ctx.beginPath(); ctx.ellipse(0, 0, 140, 28, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = "rgba(40,100,140,0.45)";
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(0, 0, 120, 24, 0, 0, TAU); ctx.stroke();
  ctx.strokeStyle = "rgba(30,80,120,0.3)";
  ctx.beginPath(); ctx.ellipse(0, 0, 140, 28, 0, 0, TAU); ctx.stroke();
  ctx.restore();

  // ── Player ship (3× scale, static yaw) ──
  ctx.save();
  ctx.translate(cx, floorY + 10);
  ctx.scale(3, 3);
  ctx.rotate(-0.25); // slight three-quarter view
  const ship = getState().player?.shipId || "starter";
  ctx.lineJoin = "round";
  shipPath(ship); ctx.strokeStyle = "rgba(0,0,0,0.9)"; ctx.lineWidth = 3.5; ctx.stroke();
  shipPath(ship); ctx.fillStyle = "#102a48"; ctx.fill();
  shipPath(ship); ctx.strokeStyle = "#2a8ec8"; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();

  // ── Hologram rings around ship ──
  const ringPulse = 0.75 + 0.25 * Math.sin(now * 0.0015);
  ctx.save();
  ctx.translate(cx, floorY + 10);
  ctx.strokeStyle = `rgba(80,200,255,${0.35 * ringPulse})`;
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.ellipse(0, 0, 90 + Math.sin(now * 0.001) * 6, 22 + Math.sin(now * 0.001) * 2, 0, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = `rgba(60,170,220,${0.25 * ringPulse})`;
  ctx.lineWidth = 0.8;
  ctx.setLineDash([4, 8]);
  ctx.beginPath();
  ctx.ellipse(0, 0, 110 + Math.cos(now * 0.0013) * 8, 28 + Math.cos(now * 0.0013) * 3, 0, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // ── Ambient dust particles ──
  ctx.save();
  for (const d of _dust) {
    d.x += d.vx;
    d.y += d.vy;
    if (d.x < 0) d.x += 1;
    if (d.x > 1) d.x -= 1;
    if (d.y < 0) d.y += 1;
    if (d.y > 1) d.y -= 1;
    const dx = d.x * Wc;
    const dy = d.y * Hc;
    ctx.globalAlpha = d.alpha;
    ctx.fillStyle = "#88bbcc";
    ctx.beginPath(); ctx.arc(dx, dy, d.r, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // ── Occasional welding sparks ──
  if (now > _nextSpark) {
    _nextSpark = now + 800 + Math.random() * 2200;
    const sx = Wc * 0.15 + Math.random() * Wc * 0.7;
    const sy = Hc * 0.25 + Math.random() * Hc * 0.4;
    for (let i = 0; i < 5; i++) {
      _sparks.push({
        x: sx, y: sy,
        vx: (Math.random() - 0.5) * 40,
        vy: (Math.random() - 1.0) * 40,
        life: 0.3 + Math.random() * 0.4,
        color: Math.random() > 0.5 ? "#ffaa44" : "#ffdd88",
      });
    }
  }
  let sW = 0;
  for (let i = 0; i < _sparks.length; i++) {
    const s = _sparks[i];
    s.x += s.vx * (1 / 60);
    s.y += s.vy * (1 / 60);
    s.vy += 30 * (1 / 60); // gravity
    s.life -= 1 / 60;
    if (s.life > 0) {
      _sparks[sW++] = s;
      ctx.globalAlpha = Math.min(1, s.life * 3);
      ctx.fillStyle = s.color;
      ctx.fillRect(s.x - 1, s.y - 1, 2, 2);
    }
  }
  _sparks.length = sW;
  ctx.globalAlpha = 1;
}
