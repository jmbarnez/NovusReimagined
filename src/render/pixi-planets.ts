import { Container, Sprite, Texture, ImageSource, Graphics } from "pixi.js";
import type { Planet, System } from "../types/world.js";
import { TAU } from "../constants.js";
import { getSunWorldPos } from "../utils/sun-position.js";
import { mkRng } from "../utils/math.js";

type PlanetEntry = {
  sprite: Sprite;
};

type MoonEntry = {
  gfx: Graphics;
  px: number; py: number; radius: number;
  moonIdx: number; totalMoons: number;
};

let _planetEntries: PlanetEntry[] = [];
let _moonEntries: MoonEntry[] = [];

function hslStr(h: number, s: number, l: number, a = 1): string {
  return `hsla(${((h % 360) + 360) % 360},${Math.max(0, Math.min(100, s))}%,${Math.max(0, Math.min(100, l))}%,${a})`;
}

function hslInt(h: number, s: number, l: number): number {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => Math.round((l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))) * 255);
  return (f(0) << 16) | (f(8) << 8) | f(4);
}

function bakePlanet(p: Planet, sys: System): Texture {
  const texSize = Math.max(128, Math.ceil(p.radius * 5));
  const half = texSize / 2;
  const c = document.createElement("canvas");
  c.width = c.height = texSize;
  const cx = c.getContext("2d")!;
  const rng = mkRng(`${sys.id}:planet:${Math.round(p.x)}:${Math.round(p.y)}:${p.radius}`);
  const r = p.radius;
  const sun = getSunWorldPos(sys);
  const lightAngle = Math.atan2(sun.y - p.y, sun.x - p.x);
  const lightX = Math.cos(lightAngle);
  const lightY = Math.sin(lightAngle);

  cx.save();
  cx.translate(half, half);

  // Keep atmosphere and lighting planet-local so it cannot drift with filter bounds.
  const glow = cx.createRadialGradient(0, 0, r * 0.55, 0, 0, r * 1.45);
  glow.addColorStop(0, hslStr(p.hue, Math.min(100, p.sat + 18), p.lit + 18, 0.12));
  glow.addColorStop(1, "transparent");
  cx.fillStyle = glow;
  cx.beginPath(); cx.arc(0, 0, r * 1.45, 0, TAU); cx.fill();

  const base = cx.createRadialGradient(0, 0, r * 0.1, 0, 0, r);
  base.addColorStop(0, hslStr(p.hue, p.sat, p.lit + 7));
  base.addColorStop(0.72, hslStr(p.hue + 5, p.sat, p.lit));
  base.addColorStop(1, hslStr(p.hue - 8, Math.max(0, p.sat - 8), p.lit - 4));
  cx.fillStyle = base;
  cx.beginPath(); cx.arc(0, 0, r, 0, TAU); cx.fill();

  cx.save();
  cx.beginPath(); cx.arc(0, 0, r, 0, TAU); cx.clip();

  const bandTilt = (rng() - 0.5) * 0.36;
  cx.rotate(bandTilt);
  const bandCount = 5 + Math.floor(rng() * 4);
  for (let b = 0; b < bandCount; b++) {
    const y = -r * 0.82 + (b / Math.max(1, bandCount - 1)) * r * 1.64 + (rng() - 0.5) * r * 0.12;
    const h = r * (0.08 + rng() * 0.12);
    const alpha = 0.055 + rng() * 0.06;
    cx.fillStyle = hslStr(p.hue + 24 + rng() * 32, Math.min(100, p.sat + 18), Math.min(92, p.lit + 20), alpha);
    cx.beginPath();
    cx.ellipse(0, y, r * (1.04 + rng() * 0.12), h, 0, 0, TAU);
    cx.fill();
  }

  cx.globalCompositeOperation = "multiply";
  for (let b = 0; b < 4; b++) {
    const y = -r * 0.72 + rng() * r * 1.44;
    cx.fillStyle = hslStr(p.hue - 18, Math.max(0, p.sat - 18), Math.max(8, p.lit - 20), 0.045);
    cx.beginPath();
    cx.ellipse(0, y, r * (0.75 + rng() * 0.35), r * (0.035 + rng() * 0.04), 0, 0, TAU);
    cx.fill();
  }
  cx.globalCompositeOperation = "source-over";

  for (let i = 0; i < 8; i++) {
    const a = rng() * TAU;
    const d = Math.sqrt(rng()) * r * 0.78;
    const spotR = r * (0.025 + rng() * 0.055);
    cx.fillStyle = hslStr(p.hue + (rng() - 0.5) * 45, Math.min(100, p.sat + 10), p.lit + (rng() - 0.5) * 16, 0.07);
    cx.beginPath();
    cx.ellipse(Math.cos(a) * d, Math.sin(a) * d, spotR * 1.8, spotR, rng() * TAU, 0, TAU);
    cx.fill();
  }

  const dayLight = cx.createLinearGradient(-lightX * r, -lightY * r, lightX * r, lightY * r);
  dayLight.addColorStop(0, "rgba(255,246,224,0.22)");
  dayLight.addColorStop(0.38, "rgba(255,246,224,0.10)");
  dayLight.addColorStop(0.72, "rgba(255,246,224,0)");
  cx.fillStyle = dayLight;
  cx.fillRect(-r, -r, r * 2, r * 2);

  const nightShade = cx.createLinearGradient(lightX * r, lightY * r, -lightX * r, -lightY * r);
  nightShade.addColorStop(0, "rgba(0,0,0,0)");
  nightShade.addColorStop(0.46, "rgba(0,0,0,0.05)");
  nightShade.addColorStop(0.78, "rgba(0,0,0,0.44)");
  nightShade.addColorStop(1, "rgba(0,0,0,0.68)");
  cx.fillStyle = nightShade;
  cx.fillRect(-r, -r, r * 2, r * 2);

  const limb = cx.createRadialGradient(lightX * r * 0.12, lightY * r * 0.12, r * 0.66, 0, 0, r * 1.05);
  limb.addColorStop(0, "rgba(0,0,0,0)");
  limb.addColorStop(0.72, "rgba(0,0,0,0)");
  limb.addColorStop(0.93, hslStr(p.hue + 18, Math.min(100, p.sat + 34), Math.min(92, p.lit + 42), 0.16));
  limb.addColorStop(1, hslStr(p.hue + 18, Math.min(100, p.sat + 34), Math.min(92, p.lit + 48), 0.26));
  cx.globalCompositeOperation = "lighter";
  cx.fillStyle = limb;
  cx.beginPath();
  cx.arc(0, 0, r * 1.02, 0, TAU);
  cx.fill();
  cx.globalCompositeOperation = "source-over";

  const highlightX = lightX * r * 0.34;
  const highlightY = lightY * r * 0.34;
  const glint = cx.createRadialGradient(highlightX, highlightY, 0, highlightX, highlightY, r * 0.38);
  glint.addColorStop(0, "rgba(255,250,232,0.14)");
  glint.addColorStop(1, "rgba(255,250,232,0)");
  cx.fillStyle = glint;
  cx.beginPath();
  cx.arc(0, 0, r, 0, TAU);
  cx.fill();
  cx.restore();

  if (p.hasRing) {
    cx.save(); cx.scale(1, p.ringTilt ?? 0.4);
    cx.strokeStyle = hslStr(p.hue, p.sat, 62, 0.42);
    cx.lineWidth = r * 0.18;
    cx.beginPath(); cx.arc(0, 0, r * 1.62, 0, TAU); cx.stroke();
    cx.strokeStyle = hslStr(p.hue + 20, Math.min(100, p.sat + 12), 76, 0.24);
    cx.lineWidth = r * 0.08;
    cx.beginPath(); cx.arc(0, 0, r * 1.9, 0, TAU); cx.stroke();
    cx.strokeStyle = hslStr(p.hue - 20, Math.max(0, p.sat - 20), 36, 0.18);
    cx.lineWidth = r * 0.05;
    cx.beginPath(); cx.arc(0, 0, r * 1.38, 0, TAU); cx.stroke();
    cx.restore();
  }

  cx.restore(); // translate(half, half)

  return new Texture({ source: new ImageSource({ resource: c, resolution: 1, scaleMode: "linear" }) });
}

export function initPlanetSprites(parent: Container, sys: System) {
  destroyPlanetSprites();
  if (!sys?.planets) return;

  for (const p of sys.planets) {
    const sprite = new Sprite(bakePlanet(p, sys));
    sprite.anchor.set(0.5);
    sprite.x = p.x;
    sprite.y = p.y;
    parent.addChild(sprite);
    _planetEntries.push({ sprite });

    for (let m = 0; m < (p.moons || 0); m++) {
      const moonR = Math.max(1.5, p.radius * 0.13);
      const gfx = new Graphics();
      gfx.circle(0, 0, moonR);
      gfx.fill({ color: hslInt((p.hue + 80) % 360, 20, 48) });
      // Seed an initial position at the planet centre. Without this the moon sits
      // at world (0,0) until the first syncPixiPlanets — which never runs in title
      // mode, leaving a stray dot in the screen's top-left corner.
      gfx.x = p.x;
      gfx.y = p.y;
      parent.addChild(gfx);
      _moonEntries.push({ gfx, px: p.x, py: p.y, radius: p.radius, moonIdx: m, totalMoons: p.moons });
    }
  }
}

export function syncPixiPlanets(now: number, _sys?: System) {
  for (const e of _moonEntries) {
    const ma = (e.moonIdx / e.totalMoons) * TAU + now * 0.0003 * (e.moonIdx + 1);
    const mr = e.radius * 1.85 + e.moonIdx * 28;
    e.gfx.x = e.px + Math.cos(ma) * mr;
    e.gfx.y = e.py + Math.sin(ma) * mr * 0.55;
  }
}

export function destroyPlanetSprites() {
  for (const e of _planetEntries) e.sprite.destroy({ texture: true });
  for (const e of _moonEntries)  e.gfx.destroy();
  _planetEntries = [];
  _moonEntries = [];
}
