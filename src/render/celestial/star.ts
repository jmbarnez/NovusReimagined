/**
 * Star rendering - photosphere, convection, chromosphere, corona.
 */
import { Container, Sprite, Graphics, Texture, ImageSource } from "pixi.js";
import { Client } from "../../state.js";
import { pixiDpr } from "../../pixi.js";

/** Distance from world origin to the system star, in world units. */
export const SUN_DIST = 3500;

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

const TAU = Math.PI * 2;

// ─── Textures & Cache ────────────────────────────────────────────────────────
let _starCoreTex: Texture | null = null;
let _starHazeTex: Texture | null = null;
let _starBloomTex: Texture | null = null;
let _starChromoTex: Texture | null = null;
let _starConvectTex: Texture | null = null;

// ─── Celestial Container References ──────────────────────────────────────────
export let _starContainer: Container | null = null;
export let _starCoreSprite: Sprite | null = null;
export let _starHazeSprite: Sprite | null = null;
export let _starBloomSprite: Sprite | null = null;
export let _starChromoSprite: Sprite | null = null;
export let _starConvectSprites: Sprite[] = [];
export let _starMask: Graphics | null = null;

// ─── Star texture baking ──────────────────────────────────────────────────────
function bakeStarTextures(starClass: string) {
  destroyBakedStarTextures();
  const cfg = getStarCfg(starClass);
  const r = cfg.radius;
  const dpr = Math.min(pixiDpr, 2.0); // Cap resolution for stars to avoid blowing VRAM

  // 1. Photosphere core (limb darkening)
  {
    const size = Math.ceil(r * 2);
    const c = document.createElement("canvas");
    c.width = c.height = size * dpr;
    const cx = c.getContext("2d")!;
    cx.scale(dpr, dpr);
    cx.translate(r, r);

    const photo = cx.createRadialGradient(0, 0, 0, 0, 0, r);
    photo.addColorStop(0.00, cfg.coreColor);
    photo.addColorStop(0.38, cfg.coreColor);
    photo.addColorStop(0.68, cfg.midColor);
    photo.addColorStop(0.88, cfg.limbColor);
    photo.addColorStop(1.00, shadeHex(cfg.limbColor, 0.4));
    cx.fillStyle = photo;
    cx.beginPath(); cx.arc(0, 0, r, 0, TAU); cx.fill();

    _starCoreTex = new Texture({ source: new ImageSource({ resource: c, resolution: dpr, scaleMode: "linear" }) });
  }

  // 2. Diffuse Haze
  {
    const size = Math.ceil(r * 6);
    const hr = r * 3;
    const c = document.createElement("canvas");
    c.width = c.height = size * dpr;
    const cx = c.getContext("2d")!;
    cx.scale(dpr, dpr);
    cx.translate(hr, hr);

    const haze = cx.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 3.0);
    haze.addColorStop(0.00, hexToRgba(cfg.coronaColor, 0.10));
    haze.addColorStop(0.25, hexToRgba(cfg.coronaColor, 0.06));
    haze.addColorStop(0.60, hexToRgba(cfg.bloomColor, 0.02));
    haze.addColorStop(1.00, "rgba(0,0,0,0)");
    cx.fillStyle = haze;
    cx.beginPath(); cx.arc(0, 0, r * 3.0, 0, TAU); cx.fill();

    _starHazeTex = new Texture({ source: new ImageSource({ resource: c, resolution: dpr, scaleMode: "linear" }) });
  }

  // 3. Bright Bloom
  {
    const size = Math.ceil(r * 3.6);
    const br = r * 1.8;
    const c = document.createElement("canvas");
    c.width = c.height = size * dpr;
    const cx = c.getContext("2d")!;
    cx.scale(dpr, dpr);
    cx.translate(br, br);

    const bloom = cx.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 1.8);
    bloom.addColorStop(0.00, hexToRgba(cfg.coreColor, 0.18));
    bloom.addColorStop(0.35, hexToRgba(cfg.coronaColor, 0.12));
    bloom.addColorStop(0.70, hexToRgba(cfg.bloomColor, 0.04));
    bloom.addColorStop(1.00, "rgba(0,0,0,0)");
    cx.fillStyle = bloom;
    cx.beginPath(); cx.arc(0, 0, r * 1.8, 0, TAU); cx.fill();

    _starBloomTex = new Texture({ source: new ImageSource({ resource: c, resolution: dpr, scaleMode: "linear" }) });
  }

  // 4. Chromosphere ring
  {
    const size = Math.ceil(r * 2.3);
    const cr = r * 1.15;
    const c = document.createElement("canvas");
    c.width = c.height = size * dpr;
    const cx = c.getContext("2d")!;
    cx.scale(dpr, dpr);
    cx.translate(cr, cr);

    const chromo = cx.createRadialGradient(0, 0, r * 0.97, 0, 0, r * 1.12);
    chromo.addColorStop(0.00, "rgba(0,0,0,0)");
    chromo.addColorStop(0.35, cfg.coronaColor);
    chromo.addColorStop(0.70, cfg.coronaColor);
    chromo.addColorStop(1.00, "rgba(0,0,0,0)");
    cx.fillStyle = chromo;
    cx.beginPath(); cx.arc(0, 0, r * 1.12, 0, TAU); cx.fill();

    _starChromoTex = new Texture({ source: new ImageSource({ resource: c, resolution: dpr, scaleMode: "linear" }) });
  }

  // 5. Convective cell granulation particle
  {
    const cr = r * 0.7;
    const size = Math.ceil(cr * 2);
    const c = document.createElement("canvas");
    c.width = c.height = size * dpr;
    const cx = c.getContext("2d")!;
    cx.scale(dpr, dpr);
    cx.translate(cr, cr);

    const gg = cx.createRadialGradient(0, 0, 0, 0, 0, cr);
    gg.addColorStop(0, cfg.coreColor);
    gg.addColorStop(1, "rgba(0,0,0,0)");
    cx.fillStyle = gg;
    cx.beginPath(); cx.arc(0, 0, cr, 0, TAU); cx.fill();

    _starConvectTex = new Texture({ source: new ImageSource({ resource: c, resolution: dpr, scaleMode: "linear" }) });
  }
}

function destroyBakedStarTextures() {
  if (_starCoreTex) { _starCoreTex.destroy(true); _starCoreTex = null; }
  if (_starHazeTex) { _starHazeTex.destroy(true); _starHazeTex = null; }
  if (_starBloomTex) { _starBloomTex.destroy(true); _starBloomTex = null; }
  if (_starChromoTex) { _starChromoTex.destroy(true); _starChromoTex = null; }
  if (_starConvectTex) { _starConvectTex.destroy(true); _starConvectTex = null; }
}

function hexToRgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  return `rgba(${rgb},${alpha})`;
}

export function initStarSprites(parent: Container, sunDir: number, starClass: string): void {
  const cfg = getStarCfg(starClass);
  const r = cfg.radius;

  // Bake textures
  bakeStarTextures(starClass);

  const sunX = Math.cos(sunDir) * SUN_DIST;
  const sunY = Math.sin(sunDir) * SUN_DIST;

  // Star Container & Sprites
  _starContainer = new Container();
  _starContainer.x = sunX;
  _starContainer.y = sunY;
  parent.addChild(_starContainer);

  // Outer haze
  _starHazeSprite = new Sprite(_starHazeTex!);
  _starHazeSprite.anchor.set(0.5);
  _starHazeSprite.blendMode = "add";
  _starContainer.addChild(_starHazeSprite);

  // Outer bloom
  _starBloomSprite = new Sprite(_starBloomTex!);
  _starBloomSprite.anchor.set(0.5);
  _starBloomSprite.blendMode = "add";
  _starContainer.addChild(_starBloomSprite);

  // Photosphere core
  _starCoreSprite = new Sprite(_starCoreTex!);
  _starCoreSprite.anchor.set(0.5);
  _starContainer.addChild(_starCoreSprite);

  // Granulation convective cells (overlapping and rotating within mask)
  const granulationWrapper = new Container();
  _starContainer.addChild(granulationWrapper);

  _starMask = new Graphics();
  _starMask.circle(0, 0, r * 0.97).fill({ color: 0xffffff });
  granulationWrapper.addChild(_starMask);
  granulationWrapper.mask = _starMask;

  _starConvectSprites = [];
  for (let i = 0; i < 3; i++) {
    const s = new Sprite(_starConvectTex!);
    s.anchor.set(0.5);
    s.alpha = 0.07;
    granulationWrapper.addChild(s);
    _starConvectSprites.push(s);
  }

  // Chromosphere limb
  _starChromoSprite = new Sprite(_starChromoTex!);
  _starChromoSprite.anchor.set(0.5);
  _starChromoSprite.blendMode = "add";
  _starChromoSprite.alpha = 0.35;
  _starContainer.addChild(_starChromoSprite);
}

export function syncStarSprites(now: number, sunDir: number, starClass: string, visible: boolean): void {
  if (!_starContainer) return;

  const cfg = getStarCfg(starClass);
  const r = cfg.radius;

  const sunX = Math.cos(sunDir) * SUN_DIST;
  const sunY = Math.sin(sunDir) * SUN_DIST;

  _starContainer.visible = visible;

  if (visible) {
    const pulse = (1 + 0.06 * Math.sin(now * 0.0006)) * (Client.settings?.bloomIntensity ?? 1.0);
    
    // Pulse outer corona elements
    if (_starHazeSprite) _starHazeSprite.alpha = pulse;
    if (_starBloomSprite) _starBloomSprite.alpha = pulse;

    // Animate convective plasma cells in photosphere
    const t = now * 0.00025;
    for (let i = 0; i < _starConvectSprites.length; i++) {
      const s = _starConvectSprites[i];
      if (s) {
        const ox = Math.cos(t + i * TAU / 3) * r * 0.38;
        const oy = Math.sin(t + i * TAU / 3) * r * 0.38;
        s.x = ox;
        s.y = oy;
      }
    }
  }
}

export function destroyStarSprites(): void {
  if (_starContainer) {
    _starContainer.destroy({ children: true });
    _starContainer = null;
  }
  _starCoreSprite = null;
  _starHazeSprite = null;
  _starBloomSprite = null;
  _starChromoSprite = null;
  _starConvectSprites = [];
  _starMask = null;

  destroyBakedStarTextures();
}
