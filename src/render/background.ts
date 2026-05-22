import { getState, WorldAccess } from "../state-access.js";
import { Client } from "../state.js";
import { ctx } from "../canvas.js";
import { TAU } from "../constants.js";
import { mkRng, rf } from "../utils/math.js";
import { _pixiReady } from "../pixi.js";
import type { System, Star, Silhouette } from "../types/world.js";

const STAR_FAR_PARALLAX = 0.006;
const STAR_MID_PARALLAX = 0.018;
const STAR_NEAR_PARALLAX = 0.036;

const WRAP_FAR  = 6000;
const WRAP_MID  = 4000; // legacy compat with G.STARS
const WRAP_NEAR = 3000;
const WRAP_DUST = 3000;

const DETAIL_MULT: Record<string, number> = { low: 0.5, medium: 0.75, high: 1.0 };

function getDetailMult(): number {
  return DETAIL_MULT[Client.settings?.backgroundDetail] ?? 1.0;
}

/** Draw a single star layer with wrapping. scintillateAmt > 0 adds a twinkle. */
function drawStarLayer(stars: Star[], wrapW: number, parallaxRate: number, Wc: number, Hc: number, starHueBase: number, camX: number, camY: number, now: number, scintillateAmt = 0, tintRGB?: [number, number, number], tintMix = 0) {
  const offX = camX * parallaxRate;
  const offY = camY * parallaxRate;
  const useTint = tintRGB && tintMix > 0;

  for (const s of stars) {
    let sx = s.ox - offX;
    let sy = s.oy - offY;
    sx = ((sx % wrapW) + wrapW) % wrapW;
    sy = ((sy % Hc) + Hc) % Hc;
    // Clamp wrap to screen dims (far layer wraps at its own size)
    if (sx > Wc) continue;

    const twinkle = scintillateAmt > 0
      ? 1 + scintillateAmt * Math.sin(now * 0.00025 * (1 + s.r * 1.8) + s.hue * 0.7)
      : 1;
    const alpha = s.a * 0.68 * twinkle;
    if (alpha < 0.03) continue;

    ctx.globalAlpha = Math.min(1, alpha);
    if (useTint) {
      // Atmospheric perspective: bias far-layer star color toward system tint.
      // Base star is a desaturated grey-white (~hsl 18%,72%).
      const baseR = 184, baseG = 184, baseB = 184;
      const r = Math.round(baseR * (1 - tintMix) + tintRGB![0] * tintMix);
      const g = Math.round(baseG * (1 - tintMix) + tintRGB![1] * tintMix);
      const b = Math.round(baseB * (1 - tintMix) + tintRGB![2] * tintMix);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
    } else {
      ctx.fillStyle = `hsl(${starHueBase + s.hue},18%,72%)`;
    }

    // 4-point spike star shape
    const r = s.r;
    const spike = r * (2.2 + s.hue * 0.04); // spike length varies per star
    const thin = r * 0.28;
    ctx.beginPath();
    ctx.moveTo(sx,          sy - spike);
    ctx.lineTo(sx + thin,   sy - thin);
    ctx.lineTo(sx + spike,  sy);
    ctx.lineTo(sx + thin,   sy + thin);
    ctx.lineTo(sx,          sy + spike);
    ctx.lineTo(sx - thin,   sy + thin);
    ctx.lineTo(sx - spike,  sy);
    ctx.lineTo(sx - thin,   sy - thin);
    ctx.closePath();
    ctx.fill();
  }
}

/** Ambient space dust — tiny translucent dots drifting slowly with high parallax. */
function drawDust(Wc: number, Hc: number, now: number, camX: number, camY: number) {
  ctx.save();
  const state = getState();
  for (const d of state.DUST) {
    const offX = camX * d.parallax;
    const offY = camY * d.parallax;

    // Slow drift animation
    let dx = d.ox - offX + now * d.drift;
    let dy = d.oy - offY + now * d.drift * 0.6;
    dx = ((dx % WRAP_DUST) + WRAP_DUST) % WRAP_DUST;
    dy = ((dy % Hc) + Hc) % Hc;
    if (dx > Wc) continue;

    ctx.globalAlpha = d.a;
    ctx.fillStyle = "#889aac";
    ctx.beginPath();
    ctx.arc(dx, dy, d.r, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ── Near-plane silhouettes (gas giants, derelicts) ─────────────────────────
// Drawn once-per-system, blitted with a slow parallax. Sells background
// scale without competing with foreground gameplay clarity.
const SILHOUETTE_PARALLAX = 0.05;
const WRAP_SILH = 5200;

function ensureSilhouettes(sys: System) {
  if (sys._silhouettes) return;
  const rng = mkRng(sys.id + "-silh");
  const archetype = sys.archetype || "wisps";
  const baseCount = archetype === "void" ? 2 : archetype === "dense" ? 5 : 4;
  const out: Silhouette[] = [];
  for (let i = 0; i < baseCount; i++) {
    const kind = rng() < 0.6 ? "giant" : "derelict";
    const r = kind === "giant" ? rf(rng, 110, 260) : rf(rng, 22, 48);
    // Bias planet tint based on system tint, with per-planet hue offset.
    const baseHue = ((sys.starHue ?? 30) + (rng() - 0.5) * 120 + 360) % 360;
    const sat = 28 + rng() * 32;        // %
    const lit = 28 + rng() * 12;        // %
    out.push({
      kind,
      x: (rng() - 0.5) * WRAP_SILH,
      y: (rng() - 0.5) * WRAP_SILH,
      r,
      baseHue, sat, lit,
      hue: ((sys.tintRGB?.[0] ?? 200) + rng() * 40 - 20) | 0,
      tilt: rf(rng, 0, TAU),
      hasRing: kind === "giant" && rng() < 0.4,
      ringTilt: rf(rng, 0.18, 0.55),
      seed: rng(),
    });
  }
  sys._silhouettes = out;
}

function drawSilhouettes(Wc: number, Hc: number, sys: System, camX: number, camY: number) {
  ensureSilhouettes(sys);
  const tint = sys.tintRGB || [200, 200, 200];
  const offX = camX * SILHOUETTE_PARALLAX;
  const offY = camY * SILHOUETTE_PARALLAX;
  ctx.save();
  for (const s of sys._silhouettes ?? []) {
    let cx = ((s.x - offX) % WRAP_SILH + WRAP_SILH) % WRAP_SILH - WRAP_SILH * 0.5 + Wc * 0.5;
    let cy = ((s.y - offY) % WRAP_SILH + WRAP_SILH) % WRAP_SILH - WRAP_SILH * 0.5 + Hc * 0.5;
    if (cx + s.r < 0 || cx - s.r > Wc || cy + s.r < 0 || cy - s.r > Hc) continue;

    if (s.kind === "giant") {
      // Distant gas giant — atmospheric body with sun-side highlight + soft rim.
      const sunDir = sys.sunDir ?? 0;
      const litX = Math.cos(sunDir) * s.r * 0.45;
      const litY = Math.sin(sunDir) * s.r * 0.45;
      const bodyCol = `hsl(${s.baseHue},${s.sat}%,${s.lit}%)`;
      const shadeCol = `hsl(${s.baseHue},${Math.max(10, s.sat - 12)}%,${Math.max(4, s.lit - 22)}%)`;
      const litCol   = `hsl(${s.baseHue},${Math.min(80, s.sat + 8)}%,${Math.min(72, s.lit + 28)}%)`;

      if (!s._gradCache) {
        const bg = ctx.createRadialGradient(litX * 0.3, litY * 0.3, s.r * 0.15, 0, 0, s.r);
        bg.addColorStop(0.0, bodyCol);
        bg.addColorStop(0.55, bodyCol);
        bg.addColorStop(1.0, shadeCol);

        const lg = ctx.createRadialGradient(litX, litY, 0, litX, litY, s.r * 0.95);
        lg.addColorStop(0.0, `hsla(${s.baseHue},${Math.min(80, s.sat + 8)}%,${Math.min(72, s.lit + 28)}%,0.55)`);
        lg.addColorStop(0.4, `hsla(${s.baseHue},${s.sat}%,${Math.min(60, s.lit + 14)}%,0.18)`);
        lg.addColorStop(1.0, "rgba(0,0,0,0)");

        let rg: CanvasGradient | undefined;
        if (s.hasRing) {
          const rR = s.r * 1.55, rW = s.r * 0.10;
          rg = ctx.createRadialGradient(0, 0, rR - rW, 0, 0, rR + rW);
          rg.addColorStop(0.0, "rgba(0,0,0,0)");
          rg.addColorStop(0.5, `hsla(${s.baseHue},${s.sat}%,${Math.min(70, s.lit + 20)}%,0.55)`);
          rg.addColorStop(1.0, "rgba(0,0,0,0)");
        }

        s._gradCache = { bg, lg, rg };
      }

      ctx.save();
      ctx.translate(cx, cy);

      // Optional back-half of ring (drawn first so the planet body occludes it).
      if (s.hasRing && s._gradCache?.rg) {
        ctx.save();
        ctx.rotate(sunDir);
        ctx.scale(1, s.ringTilt);
        const rR = s.r * 1.55, rW = s.r * 0.10;
        ctx.beginPath(); ctx.arc(0, 0, rR, Math.PI, TAU);
        ctx.strokeStyle = s._gradCache.rg;
        ctx.lineWidth = rW * 2;
        ctx.stroke();
        ctx.restore();
      }

      // Body — dark-to-shaded gradient
      ctx.globalAlpha = 0.88;
      ctx.fillStyle = s._gradCache.bg;
      ctx.beginPath(); ctx.arc(0, 0, s.r, 0, TAU); ctx.fill();

      // Sun-facing crescent highlight (clipped to body)
      ctx.save();
      ctx.beginPath(); ctx.arc(0, 0, s.r, 0, TAU); ctx.clip();
      ctx.fillStyle = s._gradCache.lg;
      ctx.fillRect(-s.r, -s.r, s.r * 2, s.r * 2);
      ctx.restore();

      // Subtle atmospheric rim
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = litCol;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      const rimA = sunDir - Math.PI * 0.45;
      const rimB = sunDir + Math.PI * 0.45;
      ctx.arc(0, 0, s.r * 1.005, rimA, rimB);
      ctx.stroke();

      // Front-half of ring (in front of planet)
      if (s.hasRing && s._gradCache?.rg) {
        ctx.save();
        ctx.rotate(sunDir);
        ctx.scale(1, s.ringTilt);
        const rR = s.r * 1.55, rW = s.r * 0.10;
        ctx.beginPath(); ctx.arc(0, 0, rR, 0, Math.PI);
        ctx.strokeStyle = s._gradCache.rg;
        ctx.lineWidth = rW * 2;
        ctx.stroke();
        ctx.restore();
      }

      ctx.restore();
    } else {
      // Derelict: small angular silhouette
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(s.tilt);
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = "rgba(8,10,16,0.92)";
      ctx.beginPath();
      ctx.moveTo(-s.r, -s.r * 0.35);
      ctx.lineTo(s.r * 0.6, -s.r * 0.5);
      ctx.lineTo(s.r, 0);
      ctx.lineTo(s.r * 0.6, s.r * 0.5);
      ctx.lineTo(-s.r, s.r * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},0.4)`;
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

export function initBackgroundStars(detail = "high") {
  const mult = DETAIL_MULT[detail] ?? 1.0;
  const starsFar = Array.from({ length: Math.max(80, Math.round(220 * mult)) }, () => ({
    ox: Math.random() * 6000,
    oy: Math.random() * 6000,
    r: 0.10 + Math.pow(Math.random(), 3.0) * 0.4,
    a: 0.03 + Math.pow(Math.random(), 2.2) * 0.16,
    hue: Math.random() * 40,
  }));
  const stars = Array.from({ length: Math.max(55, Math.round(150 * mult)) }, () => ({
    ox: Math.random() * 4000,
    oy: Math.random() * 4000,
    r: 0.18 + Math.pow(Math.random(), 2.5) * 0.7,
    a: 0.07 + Math.pow(Math.random(), 2.0) * 0.32,
    hue: (Math.random() - 0.5) * 40,
  }));
  const starsNear = Array.from({ length: Math.max(10, Math.round(24 * mult)) }, () => {
    const bright = Math.random() < 0.20;
    return {
      ox: Math.random() * 3000,
      oy: Math.random() * 3000,
      r: bright ? 1.4 + Math.random() * 0.8 : 0.35 + Math.pow(Math.random(), 2.0) * 0.9,
      a: bright ? 0.55 + Math.random() * 0.20 : 0.15 + Math.pow(Math.random(), 2.0) * 0.35,
      hue: Math.random() * 50,
    };
  });
  const dust = Array.from({ length: Math.max(50, Math.round(150 * mult)) }, () => ({
    ox: Math.random() * 3000,
    oy: Math.random() * 3000,
    r: 0.05 + Math.random() * 0.1,
    a: 0.03 + Math.random() * 0.05,
    drift: 0.01 + Math.random() * 0.015,
    parallax: 0.10 + Math.random() * 0.10,
  }));
  WorldAccess.setStarsFar(starsFar);
  WorldAccess.setStars(stars);
  WorldAccess.setStarsNear(starsNear);
  WorldAccess.setDust(dust);
}

export function drawBackground(Wc: number, Hc: number, sys: System, now: number, camX: number, camY: number) {
  if (!sys) return;
  const state = getState();

  const starHueBase = (sys.starHue + 360) % 360;

  // === Three star layers (gated when PixiJS handles them) ===
  if (!_pixiReady) {
    ctx.save();

    // Far layer: dense, tiny, slow parallax — atmospheric perspective biases
    // the color toward the system tint to suggest haze/distance.
    if (state.STARS_FAR.length) {
      drawStarLayer(state.STARS_FAR, WRAP_FAR, STAR_FAR_PARALLAX, Wc, Hc, starHueBase, camX, camY, now, 0, sys.tintRGB, 0.55);
    }

    // Near-plane silhouettes (gas giants / derelicts) — drawn between far &
    // mid star layers so they sit in the middle of the parallax stack.
    ctx.restore();
    drawSilhouettes(Wc, Hc, sys, camX, camY);
    ctx.save();

    // Mid layer (original stars) — subtle shimmer
    drawStarLayer(state.STARS, WRAP_MID, STAR_MID_PARALLAX, Wc, Hc, starHueBase, camX, camY, now, 0.08);

    // Near layer: rare bright stars with fast parallax + full twinkle
    if (state.STARS_NEAR.length) {
      drawStarLayer(state.STARS_NEAR, WRAP_NEAR, STAR_NEAR_PARALLAX, Wc, Hc, starHueBase, camX, camY, now, 0.22);
    }

    ctx.globalAlpha = 1;
    ctx.restore();

    // Ambient space dust
    drawDust(Wc, Hc, now, camX, camY);
  } else {
    // PixiJS handles stars/dust; still draw silhouettes
    drawSilhouettes(Wc, Hc, sys, camX, camY);
  }

}
