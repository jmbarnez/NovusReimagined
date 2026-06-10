import { Container, Sprite, Texture, ImageSource, Graphics } from "pixi.js";
import type { Planet, System } from "../types/world.js";
import { TAU } from "../constants.js";

type MoonEntry = {
  gfx: Graphics;
  px: number; py: number; radius: number;
  moonIdx: number; totalMoons: number;
};

let _sprites: Sprite[] = [];
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

  const r = p.radius;
  const toStar = sys?.sunDir ?? Math.atan2(Math.sin(sys?.sunDir ?? 0) * 3500 - p.y, Math.cos(sys?.sunDir ?? 0) * 3500 - p.x);
  const dx = Math.cos(toStar), dy = Math.sin(toStar);

  cx.save();
  cx.translate(half, half);

  // Glow halo
  const glow = cx.createRadialGradient(0, 0, r * 0.55, 0, 0, r * 1.45);
  glow.addColorStop(0, hslStr(p.hue, p.sat, p.lit + 10, 0.16));
  glow.addColorStop(1, "transparent");
  cx.fillStyle = glow;
  cx.beginPath(); cx.arc(0, 0, r * 1.45, 0, TAU); cx.fill();

  // Base disc (lit from star direction)
  const base = cx.createRadialGradient(dx * r * 0.3, dy * r * 0.3, 0, 0, 0, r);
  base.addColorStop(0,   hslStr(p.hue, p.sat,      p.lit + 22));
  base.addColorStop(0.7, hslStr(p.hue, p.sat,      p.lit));
  base.addColorStop(1,   hslStr(p.hue, p.sat - 10, p.lit - 8));
  cx.fillStyle = base;
  cx.beginPath(); cx.arc(0, 0, r, 0, TAU); cx.fill();

  // Rim highlight + terminator shadow (clipped to disc)
  cx.save();
  cx.beginPath(); cx.arc(0, 0, r, 0, TAU); cx.clip();

  const rim = cx.createLinearGradient(-dx * r, -dy * r, dx * r, dy * r);
  rim.addColorStop(0,    "rgba(0,0,0,0)");
  rim.addColorStop(0.55, "rgba(0,0,0,0)");
  rim.addColorStop(0.92, "rgba(255,240,210,0.18)");
  rim.addColorStop(1,    "rgba(255,250,230,0.32)");
  cx.fillStyle = rim;
  cx.fillRect(-r, -r, r * 2, r * 2);

  const shadow = cx.createLinearGradient(dx * r, dy * r, -dx * r, -dy * r);
  shadow.addColorStop(0,    "rgba(0,0,0,0)");
  shadow.addColorStop(0.42, "rgba(0,0,0,0)");
  shadow.addColorStop(0.72, "rgba(0,0,0,0.45)");
  shadow.addColorStop(1,    "rgba(0,0,0,0.72)");
  cx.fillStyle = shadow;
  cx.fillRect(-r, -r, r * 2, r * 2);
  cx.restore();

  // Atmospheric scattering rim (additive)
  cx.save();
  cx.globalCompositeOperation = "lighter";
  const atmSat = Math.min(100, p.sat + 35);
  const atmLit = Math.min(95,  p.lit + 48);
  const atmOx  = dx * r * 0.18, atmOy = dy * r * 0.18;
  const atm = cx.createRadialGradient(atmOx, atmOy, r * 0.86, atmOx * 0.4, atmOy * 0.4, r * 1.20);
  atm.addColorStop(0.00, "rgba(0,0,0,0)");
  atm.addColorStop(0.55, hslStr(p.hue, atmSat,      atmLit, 0.04));
  atm.addColorStop(0.82, hslStr(p.hue, atmSat,      atmLit, 0.16));
  atm.addColorStop(1.00, hslStr(p.hue, atmSat + 10, atmLit, 0.26));
  cx.fillStyle = atm;
  cx.beginPath(); cx.arc(0, 0, r * 1.20, 0, TAU); cx.fill();
  cx.restore();

  // Cloud bands (clipped, static)
  cx.save();
  cx.beginPath(); cx.arc(0, 0, r, 0, TAU); cx.clip();
  cx.globalAlpha = 0.10;
  for (let b = 0; b < 4; b++) {
    cx.fillStyle = hslStr((p.hue + 40) % 360, 60, 70);
    cx.fillRect(-r, -r + b * r * 0.55, r * 2, r * 0.18);
  }
  cx.restore();
  cx.globalAlpha = 1;

  // Ring system (static — orbit tilt applied via scale)
  if (p.hasRing) {
    cx.save(); cx.scale(1, p.ringTilt ?? 0.4);
    cx.strokeStyle = hslStr(p.hue, p.sat, 60, 0.45);
    cx.lineWidth = r * 0.18;
    cx.beginPath(); cx.arc(0, 0, r * 1.62, 0, TAU); cx.stroke();
    cx.strokeStyle = hslStr(p.hue, p.sat, 70, 0.22);
    cx.lineWidth = r * 0.08;
    cx.beginPath(); cx.arc(0, 0, r * 1.9, 0, TAU); cx.stroke();
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
    _sprites.push(sprite);

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

export function syncPixiPlanets(now: number) {
  for (const e of _moonEntries) {
    const ma = (e.moonIdx / e.totalMoons) * TAU + now * 0.0003 * (e.moonIdx + 1);
    const mr = e.radius * 1.85 + e.moonIdx * 28;
    e.gfx.x = e.px + Math.cos(ma) * mr;
    e.gfx.y = e.py + Math.sin(ma) * mr * 0.55;
  }
}

export function destroyPlanetSprites() {
  for (const s of _sprites)      s.destroy({ texture: true });
  for (const e of _moonEntries)  e.gfx.destroy();
  _sprites     = [];
  _moonEntries = [];
}
