import { Client } from "../../state.js";
import { ctx, bloomCtx } from "../../canvas.js";
import { TAU } from "../../constants.js";
import { isVisible } from "../../utils/game.js";
import { viewCenterX, viewCenterY, HUD_INSETS } from "../viewport.js";

// ── Star configuration tables ──────────────────────────────────────────────
export const STAR_CONFIG: Record<string, {
  radius: number;
  coreColor: string;
  midColor: string;
  limbColor: string;
  coronaColor: string;
  bloomColor: string;
  coronaAlpha: number;
}> = {
  O: { radius: 390, coreColor: "#e8f0ff", midColor: "#a0c0ff", limbColor: "#4060cc", coronaColor: "#8ab0ff", bloomColor: "#6090ff", coronaAlpha: 0.55 },
  B: { radius: 356, coreColor: "#f0f6ff", midColor: "#b8d4ff", limbColor: "#5078cc", coronaColor: "#a0c8ff", bloomColor: "#78aaff", coronaAlpha: 0.50 },
  A: { radius: 316, coreColor: "#ffffff", midColor: "#dde8ff", limbColor: "#6888cc", coronaColor: "#c0d8ff", bloomColor: "#aaccff", coronaAlpha: 0.45 },
  F: { radius: 280, coreColor: "#fffcf0", midColor: "#fff0c0", limbColor: "#cc9944", coronaColor: "#ffe888", bloomColor: "#ffdd66", coronaAlpha: 0.42 },
  G: { radius: 250, coreColor: "#fff8cc", midColor: "#ffd840", limbColor: "#cc7714", coronaColor: "#ffcc44", bloomColor: "#ffbb22", coronaAlpha: 0.42 },
  K: { radius: 216, coreColor: "#ffe8a0", midColor: "#ff9822", limbColor: "#993300", coronaColor: "#ff8840", bloomColor: "#ff7722", coronaAlpha: 0.45 },
  M: { radius: 184, coreColor: "#ffb080", midColor: "#ff4818", limbColor: "#881400", coronaColor: "#ff6030", bloomColor: "#ff3810", coronaAlpha: 0.50 },
};

export function getStarCfg(starClass: string) {
  return STAR_CONFIG[starClass] ?? STAR_CONFIG.G;
}

/** Draw the star body at world-space origin (0,0) for the current system. */
export function drawStar(now: number, sys: any) {
  if (!sys) return;
  const cfg = getStarCfg(sys.starClass ?? "G");
  const r = cfg.radius;
  const flarePulse = (sys.flareTint || 0);

  // Visibility check with generous cull radius for corona
  if (!isVisible(0, 0, r * 5)) return;

  ctx.save();

  // ── Corona — single continuous gradient, inner=0 so no banding rings ──
  {
    const flareBoost = 1 + flarePulse * 0.5;
    const rgb = hexToRgb(cfg.coronaColor);
    const coreRgb = hexToRgb(cfg.coreColor);
    const midRgb = hexToRgb(cfg.midColor);
    const outerR = r * 2.0 * flareBoost;
    // p(n) converts "multiples of r" → stop position in [0,1]
    const p = (m: number) => Math.min(m / (2.0 * flareBoost), 1);

    ctx.globalCompositeOperation = "lighter";
    const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, outerR);
    cg.addColorStop(0,       "rgba(0,0,0,0)");
    cg.addColorStop(p(0.92), "rgba(0,0,0,0)");
    cg.addColorStop(p(1.00), `rgba(${coreRgb},${0.35 * flareBoost})`);
    cg.addColorStop(p(1.14), `rgba(${coreRgb},${0.15 * flareBoost})`);
    cg.addColorStop(p(1.42), `rgba(${midRgb},0.08)`);
    cg.addColorStop(p(1.78), `rgba(${midRgb},0.04)`);
    cg.addColorStop(p(2.20), `rgba(${rgb},0.025)`);
    cg.addColorStop(p(2.80), `rgba(${rgb},${cfg.coronaAlpha * 0.06})`);
    cg.addColorStop(p(3.20), `rgba(${rgb},${cfg.coronaAlpha * 0.015})`);
    cg.addColorStop(1,       "rgba(0,0,0,0)");
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(0, 0, outerR, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }

  // ── Corona diffraction spikes (4-point star, like real telescope images) ──
  {
    const spikeLen = r * (2.6 + flarePulse * 1.4);
    const spikeAlpha = 0.18 + flarePulse * 0.22;
    const pulse = 0.85 + 0.15 * Math.sin(now * 0.0008);
    const baseAngle = sys.sunDir ?? 0; // spikes align with system sun direction
    ctx.globalCompositeOperation = "lighter";
    for (let s = 0; s < 4; s++) {
      const a = baseAngle + s * Math.PI * 0.5;
      const grad = ctx.createLinearGradient(0, 0, Math.cos(a) * spikeLen, Math.sin(a) * spikeLen);
      grad.addColorStop(0.00, `rgba(${hexToRgb(cfg.coreColor)},${spikeAlpha * pulse})`);
      grad.addColorStop(0.08, `rgba(${hexToRgb(cfg.coreColor)},${spikeAlpha * 0.82 * pulse})`);
      grad.addColorStop(0.20, `rgba(${hexToRgb(cfg.midColor)},${spikeAlpha * 0.48 * pulse})`);
      grad.addColorStop(0.42, `rgba(${hexToRgb(cfg.coronaColor)},${spikeAlpha * 0.18 * pulse})`);
      grad.addColorStop(0.70, `rgba(${hexToRgb(cfg.coronaColor)},${spikeAlpha * 0.05 * pulse})`);
      grad.addColorStop(1.00, "rgba(0,0,0,0)");
      const half = r * 0.06;
      const px = Math.cos(a + Math.PI * 0.5);
      const py = Math.sin(a + Math.PI * 0.5);
      ctx.beginPath();
      ctx.moveTo(px * half, py * half);
      ctx.lineTo(Math.cos(a) * spikeLen, Math.sin(a) * spikeLen);
      ctx.lineTo(-px * half, -py * half);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  // ── Photosphere disc — limb darkening ──
  {
    // Limb darkening: bright white core → saturated mid → darker limb
    const photo = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    photo.addColorStop(0.00, cfg.coreColor);
    photo.addColorStop(0.38, cfg.coreColor);
    photo.addColorStop(0.68, cfg.midColor);
    photo.addColorStop(0.88, cfg.limbColor);
    photo.addColorStop(1.00, shadeHex(cfg.limbColor, 0.4));
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU);
    ctx.fillStyle = photo; ctx.fill();
  }

  // ── Surface granulation suggestion (convection cells) ──
  {
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.97, 0, TAU); ctx.clip();
    ctx.globalAlpha = 0.07 + flarePulse * 0.04;
    const t = now * 0.00025;
    // Three overlapping off-center gradients suggest plasma motion
    for (let i = 0; i < 3; i++) {
      const ox = Math.cos(t + i * TAU / 3) * r * 0.38;
      const oy = Math.sin(t + i * TAU / 3) * r * 0.38;
      const gg = ctx.createRadialGradient(ox, oy, 0, ox, oy, r * 0.7);
      gg.addColorStop(0, cfg.coreColor);
      gg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gg;
      ctx.beginPath(); ctx.arc(ox, oy, r * 0.7, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // ── Active-region prominence (when flareTint > 0) ──
  if (flarePulse > 0.05) {
    const flareRgb = hexToRgb(cfg.coronaColor);
    const px2 = Math.cos(sys.sunDir ?? 0);
    const py2 = Math.sin(sys.sunDir ?? 0);
    const fg = ctx.createRadialGradient(
      px2 * r * 0.85, py2 * r * 0.85, 0,
      px2 * r * 0.85, py2 * r * 0.85, r * 0.6
    );
    fg.addColorStop(0, `rgba(${flareRgb},${flarePulse * 0.85})`);
    fg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.arc(px2 * r * 0.85, py2 * r * 0.85, r * 0.6, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }

  // ── Thin hard edge stroke ──
  ctx.strokeStyle = shadeHex(cfg.limbColor, 0.5);
  ctx.lineWidth = 1.2;
  ctx.globalAlpha = 0.6;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.restore();
}

/**
 * Distant-sun overlay drawn in SCREEN space.
 * Places a sun-coloured halo at the screen edge in the system's sun direction,
 * so the star is felt even when the camera is nowhere near world (0,0).
 * Skipped while the real star body is on-screen (would double-up).
 */
export function drawDistantSun(Wc: number, Hc: number, _camX: number, _camY: number, _zoom: number, now: number, sys: any) {
  if (!sys) return;
  const cfg = getStarCfg(sys.starClass ?? "G");
  const a = sys.sunDir ?? 0;
  // Anchor the beacon at the edge of the PLAYABLE rectangle so it doesn't
  // appear behind the side panel / bottom HUD.
  const vcX = viewCenterX(Wc);
  const vcY = viewCenterY(Hc);
  const margin = 40;
  const halfW = Math.max(40, Math.min(vcX, (Wc - HUD_INSETS.right) - vcX) - margin);
  const halfH = Math.max(40, Math.min(vcY, (Hc - HUD_INSETS.bottom) - vcY) - margin);
  const cx = Math.cos(a), cy = Math.sin(a);
  const tX = halfW / Math.max(Math.abs(cx), 1e-6);
  const tY = halfH / Math.max(Math.abs(cy), 1e-6);
  const t = Math.min(tX, tY);
  const sx = vcX + cx * t;
  const sy = vcY + cy * t;

  const pulse = 0.92 + 0.08 * Math.sin(now * 0.0009);
  const rgb = hexToRgb(cfg.coronaColor);
  const coreRgb = hexToRgb(cfg.coreColor);
  const haloR = Math.min(Wc, Hc) * 0.32 * pulse;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  // Soft outer halo
  const g1 = ctx.createRadialGradient(sx, sy, 0, sx, sy, haloR);
  g1.addColorStop(0.00, `rgba(${coreRgb},0.45)`);
  g1.addColorStop(0.12, `rgba(${coreRgb},0.22)`);
  g1.addColorStop(0.35, `rgba(${rgb},0.10)`);
  g1.addColorStop(0.70, `rgba(${rgb},0.03)`);
  g1.addColorStop(1.00, "rgba(0,0,0,0)");
  ctx.fillStyle = g1;
  ctx.beginPath(); ctx.arc(sx, sy, haloR, 0, TAU); ctx.fill();
  // Small bright disc
  const discR = Math.min(Wc, Hc) * 0.018;
  const g2 = ctx.createRadialGradient(sx, sy, 0, sx, sy, discR);
  g2.addColorStop(0.0, `rgba(${coreRgb},0.95)`);
  g2.addColorStop(0.6, `rgba(${coreRgb},0.55)`);
  g2.addColorStop(1.0, "rgba(0,0,0,0)");
  ctx.fillStyle = g2;
  ctx.beginPath(); ctx.arc(sx, sy, discR, 0, TAU); ctx.fill();
  ctx.restore();
}

/** Bloom-pass contribution from the star — large soft glow on bloomCtx. */
export function drawBloomStar(now: number, sys: any) {
  if (!sys) return;
  const cfg = getStarCfg(sys.starClass ?? "G");
  const r = cfg.radius;
  if (!isVisible(0, 0, r * 6)) return;

  const pulse = 0.9 + 0.1 * Math.sin(now * 0.0007);
  const flarePulse = sys.flareTint || 0;
  const bloomR = r * (1.2 + flarePulse * 0.4) * pulse;

  bloomCtx.save();
  bloomCtx.globalAlpha = 0.12 + flarePulse * 0.05;
  const bg = bloomCtx.createRadialGradient(0, 0, r * 0.4, 0, 0, bloomR);
  bg.addColorStop(0.0, cfg.bloomColor);
  bg.addColorStop(0.3, `rgba(${hexToRgb(cfg.bloomColor)},0.30)`);
  bg.addColorStop(0.65, `rgba(${hexToRgb(cfg.bloomColor)},0.08)`);
  bg.addColorStop(1.0, "rgba(0,0,0,0)");
  bloomCtx.fillStyle = bg;
  bloomCtx.beginPath(); bloomCtx.arc(0, 0, bloomR, 0, TAU); bloomCtx.fill();
  bloomCtx.restore();
}

// Helpers
export function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r},${g},${b}`;
}

export function shadeHex(hex: string, factor: number): string {
  const h = hex.replace("#", "");
  const r = Math.round(parseInt(h.substring(0, 2), 16) * factor);
  const g = Math.round(parseInt(h.substring(2, 4), 16) * factor);
  const b = Math.round(parseInt(h.substring(4, 6), 16) * factor);
  return `rgb(${r},${g},${b})`;
}

export function drawPlanets(now: number, sys: any) {
  if (!sys?.planets) return;
  for (const p of sys.planets) {
    if (!isVisible(p.x, p.y, p.radius * 2.2)) continue;

    // Planet gradients depend only on static planet properties (hue/sat/lit/
    // radius/position) — build them once and cache on the planet object rather
    // than reallocating ~5 gradients per planet per frame.
    if (!p._gradCache) {
      const toStar = Math.atan2(-p.y, -p.x);
      const dx = Math.cos(toStar), dy = Math.sin(toStar);
      const r = p.radius;

      const glow = ctx.createRadialGradient(0, 0, r * 0.55, 0, 0, r * 1.45);
      glow.addColorStop(0, `hsla(${p.hue},${p.sat}%,${p.lit + 10}%, 0.16)`);
      glow.addColorStop(1, "transparent");

      const base = ctx.createRadialGradient(dx * r * 0.3, dy * r * 0.3, 0, 0, 0, r);
      base.addColorStop(0, `hsl(${p.hue},${p.sat}%,${p.lit + 22}%)`);
      base.addColorStop(.7, `hsl(${p.hue},${p.sat}%,${p.lit}%)`);
      base.addColorStop(1, `hsl(${p.hue},${p.sat - 10}%,${p.lit - 8}%)`);

      const rim = ctx.createLinearGradient(-dx * r, -dy * r, dx * r, dy * r);
      rim.addColorStop(0, "rgba(0,0,0,0)");
      rim.addColorStop(0.55, "rgba(0,0,0,0)");
      rim.addColorStop(0.92, "rgba(255,240,210,0.18)");
      rim.addColorStop(1, "rgba(255,250,230,0.32)");

      const shadow = ctx.createLinearGradient(dx * r, dy * r, -dx * r, -dy * r);
      shadow.addColorStop(0, "rgba(0,0,0,0)");
      shadow.addColorStop(0.42, "rgba(0,0,0,0)");
      shadow.addColorStop(0.72, "rgba(0,0,0,0.45)");
      shadow.addColorStop(1, "rgba(0,0,0,0.72)");

      const atmInner = r * 0.86, atmOuter = r * 1.20;
      const atmOx = dx * r * 0.18, atmOy = dy * r * 0.18;
      const atm = ctx.createRadialGradient(atmOx, atmOy, atmInner, atmOx * 0.4, atmOy * 0.4, atmOuter);
      const atmSat = Math.min(100, p.sat + 35);
      const atmLit = Math.min(95, p.lit + 48);
      atm.addColorStop(0.00, "rgba(0,0,0,0)");
      atm.addColorStop(0.55, `hsla(${p.hue},${atmSat}%,${atmLit}%,0.04)`);
      atm.addColorStop(0.82, `hsla(${p.hue},${atmSat}%,${atmLit}%,0.16)`);
      atm.addColorStop(1.00, `hsla(${p.hue},${atmSat + 10}%,${atmLit}%,0.26)`);

      p._gradCache = { glow, base, rim, shadow, atm };
    }
    const gc = p._gradCache;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = gc.glow;
    ctx.beginPath(); ctx.arc(0, 0, p.radius * 1.45, 0, TAU); ctx.fill();

    // Base fill — highlight offset toward star
    ctx.beginPath(); ctx.arc(0, 0, p.radius, 0, TAU); ctx.fillStyle = gc.base; ctx.fill();

    // Sun-side rim crescent + shadow
    if (Client.settings?.directionalLighting !== false) {
      ctx.save();
      ctx.beginPath(); ctx.arc(0, 0, p.radius, 0, TAU); ctx.clip();
      ctx.fillStyle = gc.rim;
      ctx.fillRect(-p.radius, -p.radius, p.radius * 2, p.radius * 2);
      ctx.fillStyle = gc.shadow;
      ctx.fillRect(-p.radius, -p.radius, p.radius * 2, p.radius * 2);
      ctx.restore();
    }

    // Atmospheric scattering rim — thicker on sun-facing limb, faint on shadow side
    if (Client.settings?.atmosphericRim !== false) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = gc.atm;
      ctx.beginPath(); ctx.arc(0, 0, p.radius * 1.20, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      ctx.restore();
    }

    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, p.radius, 0, TAU); ctx.clip();
    ctx.globalAlpha = 0.1;
    for (let b = 0; b < 4; b++) {
      ctx.fillStyle = `hsl(${(p.hue + 40) % 360},60%,70%)`;
      ctx.fillRect(-p.radius, -p.radius + b * p.radius * .55, p.radius * 2, p.radius * .18);
    }
    ctx.restore(); ctx.globalAlpha = 1;

    if (p.hasRing) {
      ctx.save(); ctx.scale(1, p.ringTilt);
      ctx.strokeStyle = `hsla(${p.hue},${p.sat}%,60%,0.45)`; ctx.lineWidth = p.radius * .18;
      ctx.beginPath(); ctx.arc(0, 0, p.radius * 1.62, 0, TAU); ctx.stroke();
      ctx.strokeStyle = `hsla(${p.hue},${p.sat}%,70%,0.22)`; ctx.lineWidth = p.radius * .08;
      ctx.beginPath(); ctx.arc(0, 0, p.radius * 1.9, 0, TAU); ctx.stroke();
      ctx.restore();
    }
    for (let m = 0; m < p.moons; m++) {
      const ma = (m / p.moons) * TAU + now * 0.0003 * (m + 1);
      const mr = p.radius * 1.85 + m * 28;
      ctx.beginPath(); ctx.arc(Math.cos(ma) * mr, Math.sin(ma) * mr * 0.55, p.radius * .13, 0, TAU);
      ctx.fillStyle = `hsl(${(p.hue + 80) % 360},20%,48%)`; ctx.fill();
    }
    ctx.restore();
  }
}
