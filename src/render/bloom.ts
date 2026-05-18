import { G, Client } from "../state.js";
import { bloomCtx, bloomScratchA, bloomScratchACtx, bloomScratchB, bloomScratchBCtx, _canvasDpr } from "../canvas.js";
import { TAU } from "../constants.js";
import { lerp } from "../utils/math.js";
import { isVisible } from "../utils/game.js";
import { viewCenterX, viewCenterY } from "./viewport.js";
import { radialGlow } from "./grad-cache.js";

import { getSalvagerBeam } from "../salvager.js";

// Cached 3-stop mining-laser hot glow — only two discrete variants (hit / miss).
const _miningHotCache = new Map<string, CanvasGradient>();
function miningHotGrad(hitting: boolean): CanvasGradient {
  const key = hitting ? "h" : "n";
  let g = _miningHotCache.get(key);
  if (g) return g;
  const radius = hitting ? 24 : 10;
  const alpha = hitting ? 0.7 : 0.3;
  g = bloomCtx.createRadialGradient(0, 0, 0, 0, 0, radius);
  g.addColorStop(0, `rgba(255,255,200,${alpha})`);
  g.addColorStop(0.5, `rgba(255,230,80,${alpha * 0.55})`);
  g.addColorStop(1, "transparent");
  _miningHotCache.set(key, g);
  return g;
}

// Cached salvager end glow — baked at pulse=1, intensity driven via globalAlpha.
let _salvagerEndGrad: CanvasGradient | null = null;
function salvagerEndGrad(): CanvasGradient {
  if (_salvagerEndGrad) return _salvagerEndGrad;
  const g = bloomCtx.createRadialGradient(0, 0, 0, 0, 0, 20);
  g.addColorStop(0, "rgba(0,255,80,0.85)");
  g.addColorStop(0.5, "rgba(0,200,60,0.4)");
  g.addColorStop(1, "transparent");
  _salvagerEndGrad = g;
  return g;
}

export function beginBloomPass(Wc: number, Hc: number, camxR: number, camyR: number, zoom: number) {
  bloomCtx.save();
  bloomCtx.setTransform(_canvasDpr, 0, 0, _canvasDpr, 0, 0);
  bloomCtx.clearRect(0, 0, Wc, Hc);
  bloomCtx.translate(viewCenterX(Wc), viewCenterY(Hc));
  bloomCtx.scale(zoom, zoom);
  bloomCtx.translate(-camxR, -camyR);
}

export function endBloomPass(ctx: CanvasRenderingContext2D, _Wc: number, _Hc: number) {
  bloomCtx.restore();
  const src = bloomCtx.canvas;
  const dw = src.width, dh = src.height;
  const d = _canvasDpr;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "screen";

  // Multi-pass: blur at half- and quarter-resolution scratch buffers (cheap),
  // then composite a tight core + mid halo + wide haze with falling alpha for
  // a soft layered falloff instead of one flat blur.
  const aCtx = bloomScratchACtx, bCtx = bloomScratchBCtx;
  const aw = bloomScratchA.width, ah = bloomScratchA.height;
  const bw = bloomScratchB.width, bh = bloomScratchB.height;

  // Half-res: downsample + blur in one pass on the small canvas.
  aCtx.setTransform(1, 0, 0, 1, 0, 0);
  aCtx.globalCompositeOperation = "source-over";
  aCtx.globalAlpha = 1;
  aCtx.clearRect(0, 0, aw, ah);
  aCtx.filter = `blur(${1.5 * d}px)`;
  aCtx.drawImage(src, 0, 0, aw, ah);
  aCtx.filter = "none";

  // Quarter-res: downsample the half-res copy + blur further.
  bCtx.setTransform(1, 0, 0, 1, 0, 0);
  bCtx.globalCompositeOperation = "source-over";
  bCtx.globalAlpha = 1;
  bCtx.clearRect(0, 0, bw, bh);
  bCtx.filter = `blur(${2 * d}px)`;
  bCtx.drawImage(bloomScratchA, 0, 0, bw, bh);
  bCtx.filter = "none";

  // Composite back, brightest/tightest first.
  ctx.filter = `blur(${1.5 * d}px)`;
  ctx.globalAlpha = 0.32;
  ctx.drawImage(src, 0, 0);
  ctx.filter = "none";
  ctx.globalAlpha = 0.24;
  ctx.drawImage(bloomScratchA, 0, 0, dw, dh);
  ctx.globalAlpha = 0.13;
  ctx.drawImage(bloomScratchB, 0, 0, dw, dh);

  ctx.filter = "none";
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
}

export function drawBloomBullets(alpha: number) {
  for (const b of G.bullets) {
    if (!isVisible(b.x, b.y, 12)) continue;
    const ix = lerp(b.px, b.x, alpha), iy = lerp(b.py, b.y, alpha);
    const glowR = b.sz * 3.5;
    bloomCtx.save();
    bloomCtx.globalAlpha = 0.7;
    bloomCtx.translate(ix, iy);
    bloomCtx.fillStyle = radialGlow(bloomCtx, b.color, glowR);
    bloomCtx.beginPath(); bloomCtx.arc(0, 0, glowR, 0, TAU); bloomCtx.fill();
    bloomCtx.restore();
  }
  for (const b of G.enemyBullets) {
    if (!isVisible(b.x, b.y, 8)) continue;
    const ix = lerp(b.px, b.x, alpha), iy = lerp(b.py, b.y, alpha);
    bloomCtx.save();
    bloomCtx.globalAlpha = 0.55;
    bloomCtx.translate(ix, iy);
    bloomCtx.fillStyle = radialGlow(bloomCtx, "#ff5533", 10);
    bloomCtx.beginPath(); bloomCtx.arc(0, 0, 10, 0, TAU); bloomCtx.fill();
    bloomCtx.restore();
  }
}

export function drawBloomBeams() {
  for (const b of G.beams) {
    bloomCtx.save();
    bloomCtx.globalAlpha = b.life * 0.75;
    bloomCtx.strokeStyle = b.color;
    bloomCtx.lineWidth = b.width * 2.5;
    bloomCtx.lineCap = "round";
    bloomCtx.beginPath(); bloomCtx.moveTo(b.x1, b.y1); bloomCtx.lineTo(b.x2, b.y2); bloomCtx.stroke();
    bloomCtx.restore();
  }
}

export function drawBloomParticles() {
  for (const p of G.particles) {
    const pr = p.r ?? 1;
    const pl = p.life ?? 0;
    if (!isVisible(p.x, p.y, pr + 2)) continue;
    const glowR = pr * 1.8;
    bloomCtx.save();
    bloomCtx.globalAlpha = pl * 0.6;
    bloomCtx.translate(p.x, p.y);
    bloomCtx.fillStyle = radialGlow(bloomCtx, p.color, glowR);
    bloomCtx.beginPath(); bloomCtx.arc(0, 0, glowR, 0, TAU); bloomCtx.fill();
    bloomCtx.restore();
  }
}

export function drawBloomMiningLaser(now: number) {
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
  bloomCtx.save();
  bloomCtx.globalAlpha = 0.35 * pulse;
  bloomCtx.strokeStyle = "rgb(255,230,80)";
  bloomCtx.lineWidth = 14;
  bloomCtx.lineCap = "round";
  bloomCtx.beginPath(); bloomCtx.moveTo(x1, y1); bloomCtx.lineTo(endX, endY); bloomCtx.stroke();
  const radius = hittingAsteroid ? 24 : 10;
  bloomCtx.globalAlpha = pulse * (hittingAsteroid ? 1.0 : 0.4);
  bloomCtx.translate(endX, endY);
  bloomCtx.fillStyle = miningHotGrad(hittingAsteroid);
  bloomCtx.beginPath(); bloomCtx.arc(0, 0, radius, 0, TAU); bloomCtx.fill();
  bloomCtx.restore();
}

export function drawBloomSalvagerBeam() {
  const sv = getSalvagerBeam();
  if (!sv.active) return;
  const { x1, y1, x2, y2, phase } = sv;
  const pulse = 0.7 + 0.3 * Math.sin(phase * 2.5);
  bloomCtx.save();
  bloomCtx.globalAlpha = 0.28 * pulse;
  bloomCtx.strokeStyle = "rgb(0,220,70)";
  bloomCtx.lineWidth = 14;
  bloomCtx.lineCap = "round";
  bloomCtx.beginPath(); bloomCtx.moveTo(x1, y1); bloomCtx.lineTo(x2, y2); bloomCtx.stroke();
  // Cached gradient is baked at pulse=1; fold the per-stop pulse into globalAlpha.
  bloomCtx.globalAlpha = pulse * 0.65 * pulse;
  bloomCtx.translate(x2, y2);
  bloomCtx.fillStyle = salvagerEndGrad();
  bloomCtx.beginPath(); bloomCtx.arc(0, 0, 20, 0, TAU); bloomCtx.fill();
  bloomCtx.restore();
}

export function drawBloomShockwaves() {
  if (!G.shockwaves?.length) return;
  for (const s of G.shockwaves) {
    if (!isVisible(s.x, s.y, s.maxRadius)) continue;
    const a = s.life / s.maxLife;
    bloomCtx.save();
    bloomCtx.globalAlpha = a * 0.45;
    bloomCtx.strokeStyle = s.color;
    bloomCtx.lineWidth = (s.width * a) * 2.5;
    bloomCtx.beginPath();
    bloomCtx.arc(s.x, s.y, s.radius || 0, 0, TAU);
    bloomCtx.stroke();
    bloomCtx.restore();
  }
}

export function drawBloomImpacts(now: number, alpha: number) {
  // Shield impact glow
  const ia = lerp(G.P.prevAngle, G.P.angle, alpha);
  const shieldR = 34;
  const glow = G.P.shieldHitGlow;
  if (glow > 0) {
    const hitAngle = G.P.shieldHitAngle - ia;
    const hx = Math.cos(hitAngle) * shieldR;
    const hy = Math.sin(hitAngle) * shieldR;
    bloomCtx.save();
    bloomCtx.translate(G.P.x, G.P.y);
    bloomCtx.rotate(ia);
    bloomCtx.translate(hx, hy);
    bloomCtx.globalAlpha = glow * 0.6;
    bloomCtx.fillStyle = radialGlow(bloomCtx, "rgba(100,200,255,0.9)", 24);
    bloomCtx.beginPath(); bloomCtx.arc(0, 0, 24, 0, TAU); bloomCtx.fill();
    bloomCtx.restore();
  }
  // Hull impact glow
  const hullGlow = G.P.hullHitGlow;
  if (hullGlow > 0) {
    const hullAngle = G.P.hullHitAngle - ia;
    const hx = Math.cos(hullAngle) * 18;
    const hy = Math.sin(hullAngle) * 18;
    bloomCtx.save();
    bloomCtx.translate(G.P.x, G.P.y);
    bloomCtx.rotate(ia);
    bloomCtx.translate(hx, hy);
    bloomCtx.globalAlpha = hullGlow * 0.55;
    bloomCtx.fillStyle = radialGlow(bloomCtx, "rgba(255,160,40,0.9)", 18);
    bloomCtx.beginPath(); bloomCtx.arc(0, 0, 18, 0, TAU); bloomCtx.fill();
    bloomCtx.restore();
  }
}
