import { Client } from "../../state.js";
import { ctx } from "../../canvas.js";
import { TAU } from "../../constants.js";
import { isVisible } from "../../utils/game.js";

/** Distance from world origin to the system star, in world units. */
export const SUN_DIST = 3500;

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

/** Draw the star body at its world-space position along sys.sunDir. */
export function drawStar(now: number, sys: any) {
  if (!sys) return;
  const cfg = getStarCfg(sys.starClass ?? "G");
  const r = cfg.radius;
  const sunX = Math.cos(sys.sunDir ?? 0) * SUN_DIST;
  const sunY = Math.sin(sys.sunDir ?? 0) * SUN_DIST;

  if (!isVisible(sunX, sunY, r * 3.5)) return;

  ctx.save();
  ctx.translate(sunX, sunY);

  // ── Outer corona glow — large, soft, pulsing halo ──
  // Two additive layers: a wide diffuse haze and a tighter bright bloom.
  {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const pulse = 1 + 0.06 * Math.sin(now * 0.0006);

    // Wide diffuse corona haze
    const haze = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 3.0);
    haze.addColorStop(0.00, hexToRgba(cfg.coronaColor, 0.10 * pulse));
    haze.addColorStop(0.25, hexToRgba(cfg.coronaColor, 0.06 * pulse));
    haze.addColorStop(0.60, hexToRgba(cfg.bloomColor, 0.02 * pulse));
    haze.addColorStop(1.00, "rgba(0,0,0,0)");
    ctx.fillStyle = haze;
    ctx.beginPath(); ctx.arc(0, 0, r * 3.0, 0, TAU); ctx.fill();

    // Tighter bright bloom around the disc edge
    const bloom = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 1.8);
    bloom.addColorStop(0.00, hexToRgba(cfg.coreColor, 0.18 * pulse));
    bloom.addColorStop(0.35, hexToRgba(cfg.coronaColor, 0.12 * pulse));
    bloom.addColorStop(0.70, hexToRgba(cfg.bloomColor, 0.04 * pulse));
    bloom.addColorStop(1.00, "rgba(0,0,0,0)");
    ctx.fillStyle = bloom;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.8, 0, TAU); ctx.fill();

    ctx.restore();
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
    ctx.globalAlpha = 0.07;
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

  // ── Chromosphere — thin glowing limb ring just outside the photosphere ──
  // Sells the star as a hot plasma body without bloom. Drawn additively so it
  // brightens the limb without darkening anything inside the disc.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const chromo = ctx.createRadialGradient(0, 0, r * 0.97, 0, 0, r * 1.12);
  chromo.addColorStop(0.00, "rgba(0,0,0,0)");
  chromo.addColorStop(0.35, cfg.coronaColor);
  chromo.addColorStop(0.70, cfg.coronaColor);
  chromo.addColorStop(1.00, "rgba(0,0,0,0)");
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = chromo;
  ctx.beginPath(); ctx.arc(0, 0, r * 1.12, 0, TAU); ctx.fill();
  ctx.restore();

  // ── Thin hard edge stroke ──
  ctx.strokeStyle = shadeHex(cfg.limbColor, 0.5);
  ctx.lineWidth = 1.2;
  ctx.globalAlpha = 0.6;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.restore();
}

// Helpers
export function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r},${g},${b}`;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  if (h.length < 6) return `rgba(255,255,255,${alpha})`;
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
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
      const sunDirVal = sys?.sunDir ?? 0;
      const toStar = sys?.sunDir ?? Math.atan2(Math.sin(sunDirVal) * 3500 - p.y, Math.cos(sunDirVal) * 3500 - p.x);
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
