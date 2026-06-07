/**
 * PixiJS Celestial & Environmental Renderer.
 * 
 * Migrates the system Star, warp Gates, and World Border from Canvas 2D to PixiJS.
 * - Star: Photosphere, convection granulation, thin chromosphere, and outer pulsing corona.
 * - Warp Gates: Dynamic rotating segmentation rings, particle vortex core, and GPU-based labels.
 * - World Border: Static boundary ring that adjusts transparency dynamically relative to player position.
 */
import { Container, Sprite, Graphics, Texture, ImageSource, Text } from "pixi.js";
import { Client } from "../state.js";
import { getState } from "../state-access.js";
import type { System } from "../types/world.js";
import { planetLayer, stationLayer, effectLayer, pixiDpr } from "../pixi.js";
import {
  formatWorldLabelText,
  getWorldLabelTextStyle,
  layoutWorldLabelCard,
  refreshWorldLabelTextStyle,
} from "./world-label-card.js";
import { isVisible } from "../utils/game.js";
import { shouldShowWarpGate } from "../data/tutorial.js";
import { SECTOR_OUTER_RADIUS } from "../world-gen.js";
import { TUTORIAL_SECTOR } from "../data/tutorial-layout.js";
import { gateStableId, gateWorldLabel } from "../utils/warp-gates.js";

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
let _starContainer: Container | null = null;
let _starCoreSprite: Sprite | null = null;
let _starHazeSprite: Sprite | null = null;
let _starBloomSprite: Sprite | null = null;
let _starChromoSprite: Sprite | null = null;
let _starConvectSprites: Sprite[] = [];
let _starMask: Graphics | null = null;

export function refreshCelestialFonts() {
  refreshWorldLabelTextStyle();
  for (const b of _gateBundles) {
    layoutWorldLabelCard(b.labelBg, b.labelText);
  }
}

interface GateBundle {
  id: string;
  container: Container;
  foregroundContainer: Container;
  hull: Graphics;
  rings: Graphics;
  core: Graphics;
  foregroundRim: Graphics;
  labelBg: Graphics;
  labelText: Text;
}
let _gateBundles: GateBundle[] = [];

// World border
let _borderGfx: Graphics | null = null;
let _warningGfx: Graphics | null = null;
let _borderOuterRadius = -1;

function rebuildWorldBorder(radius: number): void {
  if (!_borderGfx || !_warningGfx) return;
  if (_borderOuterRadius === radius) return;
  _borderOuterRadius = radius;

  _borderGfx.clear();
  const segments = 120;
  for (let i = 0; i < segments; i++) {
    if (i % 2 === 0) {
      const a0 = (i / segments) * TAU;
      const a1 = ((i + 0.6) / segments) * TAU;
      _borderGfx.arc(0, 0, radius, a0, a1);
      _borderGfx.stroke({ color: 0x2a4560, width: 2.5 });
    }
  }

  _warningGfx.clear();
  _warningGfx.circle(0, 0, radius - 120).stroke({ color: 0x1a3048, width: 1.0 });
}

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

// ─── Public API ──────────────────────────────────────────────────────────────

export function initPixiCelestial(parent: Container, sys: System): void {
  destroyPixiCelestial();
  if (!sys) return;

  const starClass = sys.starClass ?? "G";
  const cfg = getStarCfg(starClass);
  const r = cfg.radius;

  // 1. Bake textures
  bakeStarTextures(starClass);

  const sunX = Math.cos(sys.sunDir ?? 0) * SUN_DIST;
  const sunY = Math.sin(sys.sunDir ?? 0) * SUN_DIST;

  // 2. Star Container & Sprites
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

  // 3. Warp Gates
  _gateBundles = [];
  if (sys.gates) {
    for (const g of sys.gates) {
      const gateCont = new Container();
      gateCont.x = g.x;
      gateCont.y = g.y;
      stationLayer!.addChild(gateCont);

      // Outer segmented hull ring (Expanse-style)
      const hull = new Graphics();
      gateCont.addChild(hull);

      // Core vortex
      const core = new Graphics();
      gateCont.addChild(core);

      // Segment rings
      const rings = new Graphics();
      gateCont.addChild(rings);

      const gateForeCont = new Container();
      gateForeCont.x = g.x;
      gateForeCont.y = g.y;
      (effectLayer ?? stationLayer)!.addChild(gateForeCont);

      const foregroundRim = new Graphics();
      gateForeCont.addChild(foregroundRim);

      // Background card
      const labelBg = new Graphics();
      gateCont.addChild(labelBg);

      // Label Text (now centered vertically for premium layout)
      const targetName = gateWorldLabel(g, getState().GALAXY);
      const labelY = g.radius + 22;
      const labelText = new Text({
        text: formatWorldLabelText(`⟩⟩ ${targetName}`),
        style: getWorldLabelTextStyle(),
      });
      labelText.anchor.set(0.5, 0.5);
      labelText.x = 0;
      labelText.y = labelY;
      labelBg.x = 0;
      labelBg.y = labelY;
      gateCont.addChild(labelText);
      layoutWorldLabelCard(labelBg, labelText);

      _gateBundles.push({
        id: gateStableId(g),
        container: gateCont,
        foregroundContainer: gateForeCont,
        hull,
        rings,
        core,
        foregroundRim,
        labelBg,
        labelText,
      });
    }
  }

  // 4. World Border (drawn at center 0,0 in planetLayer)
  _borderGfx = new Graphics();
  _warningGfx = new Graphics();
  rebuildWorldBorder(SECTOR_OUTER_RADIUS);
  _borderGfx.alpha = 0;
  planetLayer!.addChild(_borderGfx);

  _warningGfx.alpha = 0;
  planetLayer!.addChild(_warningGfx);
}

export function syncPixiCelestial(now: number, alpha: number, sys: System): void {
  if (!_starContainer) return;

  const cfg = getStarCfg(sys.starClass ?? "G");
  const r = cfg.radius;

  const sunX = Math.cos(sys.sunDir ?? 0) * SUN_DIST;
  const sunY = Math.sin(sys.sunDir ?? 0) * SUN_DIST;

  const visible = isVisible(sunX, sunY, r * 3.5);
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

  // Sync Warp Gates
  const gateIdsMatch = _gateBundles.length === (sys.gates?.length ?? 0)
    && (sys.gates ?? []).every((g, i) => _gateBundles[i]?.id === gateStableId(g));
  if (!gateIdsMatch && stationLayer) {
    initPixiCelestial(stationLayer, sys);
    return;
  }
  if (sys.gates && _gateBundles.length === sys.gates.length) {
    for (let i = 0; i < sys.gates.length; i++) {
      const g = sys.gates[i]!;
      const b = _gateBundles[i]!;
      const isGateVisible = shouldShowWarpGate(g, sys.idx, getState().player) && isVisible(g.x, g.y, g.radius * 2.5);
      b.container.x = g.x;
      b.container.y = g.y;
      b.foregroundContainer.x = g.x;
      b.foregroundContainer.y = g.y;
      b.container.visible = isGateVisible;
      b.foregroundContainer.visible = isGateVisible;

      if (isGateVisible) {
        const pulse = 0.5 + 0.5 * Math.sin(now * 0.0022);
        const corePulse = 0.7 + 0.3 * Math.sin(now * 0.004);
        const RENDER_SCALE = 3.5;
        const visR = g.radius * RENDER_SCALE;

        // --- 0. OUTER SEGMENTED HULL RING ---
        b.hull.clear();
        const hullSpin = now * 0.0003;
        const hullSegments = 24;
        for (let j = 0; j < hullSegments; j++) {
          const a = hullSpin + (j / hullSegments) * TAU;
          const ar = a + (1 / hullSegments) * TAU * 0.85;
          const isMajor = j % 4 === 0;
          const segR = visR * (isMajor ? 1.0 : 0.96);
          b.hull.moveTo(Math.cos(a) * segR, Math.sin(a) * segR);
          b.hull.arc(0, 0, segR, a, ar);
          b.hull.stroke({
            color: isMajor ? 0x78c0ff : 0x3c6078,
            width: isMajor ? 4.5 : 3.0,
            alpha: isMajor ? (0.55 + pulse * 0.2) : 0.35,
          });
        }
        // Inner rim glow
        b.hull.circle(0, 0, visR * 0.92).stroke({
          color: 0xa0d8ff,
          width: 1.2,
          alpha: 0.25 + pulse * 0.1,
        });

        // --- 1. CORE VORTEX (HYPERSPACE CORE) ---
        b.core.clear();

        // A. Subtle outer glow behind rings
        b.core.circle(0, 0, g.radius * 1.15).fill({
          color: 0x285ac8,
          alpha: (0.04 + pulse * 0.02)
        });

        // B. Deep base glow
        b.core.circle(0, 0, g.radius * 0.75).fill({
          color: 0x142b6e,
          alpha: (0.15 + pulse * 0.1)
        });

        // C. Energetic core center
        b.core.circle(0, 0, g.radius * 0.48).fill({
          color: 0x285ac8,
          alpha: (0.35 + corePulse * 0.25)
        });

        // D. Saturated hyper-core event horizon
        b.core.circle(0, 0, g.radius * 0.22).fill({
          color: 0xe0f0ff,
          alpha: (0.70 + corePulse * 0.25)
        });

        // E. Flat event horizon disc (shimmering plane inside the ring)
        const horizonR = g.radius * 0.92;
        b.core.circle(0, 0, horizonR).fill({
          color: 0xe0f0ff,
          alpha: (0.08 + corePulse * 0.06),
        });
        // Inner edge bright rim
        b.core.circle(0, 0, horizonR * 0.85).stroke({
          color: 0xc0e8ff,
          width: 1.5,
          alpha: 0.35 + corePulse * 0.2,
        });

        // F. Rim-orbiting spark particles
        const numSparks = 10;
        for (let sIdx = 0; sIdx < numSparks; sIdx++) {
          const sparkAng = (sIdx / numSparks) * TAU + now * 0.0012 + Math.sin(now * 0.0003 + sIdx) * 0.3;
          const orbitR = visR * (0.94 + 0.06 * Math.sin(now * 0.002 + sIdx * 1.7));
          const sx = Math.cos(sparkAng) * orbitR;
          const sy = Math.sin(sparkAng) * orbitR;
          const sparkAlpha = (0.4 + 0.4 * Math.sin(now * 0.01 + sIdx)) * (0.6 + corePulse * 0.4);
          b.core.circle(sx, sy, 1.8)
            .fill({ color: sIdx % 2 === 0 ? 0xffffff : 0x78c0ff, alpha: sparkAlpha });
        }

        // --- 2. CONCENTRIC COUNTER-ROTATING RINGS ---
        b.rings.clear();

        const spin = g.spin ?? 0;

        // A. OUTER STRUCTURAL RING — thick metallic segments
        const outerTicks = 16;
        const outerDash = 0.55;
        for (let j = 0; j < outerTicks; j++) {
          if (j % 2 !== 0) continue;
          const a = spin + (j / outerTicks) * TAU;
          const ar = a + (1 / outerTicks) * TAU * outerDash;
          const isMajor = j % 4 === 0;
          b.rings.moveTo(Math.cos(a) * g.radius, Math.sin(a) * g.radius);
          b.rings.arc(0, 0, g.radius, a, ar);
          b.rings.stroke({
            color: isMajor ? 0x78c0ff : 0x3c6078,
            width: isMajor ? 3.2 : 2.0,
            alpha: isMajor ? (0.65 + pulse * 0.2) : 0.35,
          });
        }

        // B. INNER COUNTER-SPIN STRUT RING — fewer, thicker segments
        const innerRadius = g.radius * 0.72;
        const innerSpin = -spin * 0.6;
        const innerTicks = 12;
        const innerDash = 0.5;
        for (let j = 0; j < innerTicks; j++) {
          if (j % 2 !== 0) continue;
          const a = innerSpin + (j / innerTicks) * TAU;
          const ar = a + (1 / innerTicks) * TAU * innerDash;
          const isMajor = j % 3 === 0;
          b.rings.moveTo(Math.cos(a) * innerRadius, Math.sin(a) * innerRadius);
          b.rings.arc(0, 0, innerRadius, a, ar);
          b.rings.stroke({
            color: isMajor ? 0x5fa0d0 : 0x2a4a60,
            width: isMajor ? 2.4 : 1.4,
            alpha: isMajor ? (0.55 + pulse * 0.2) : 0.28,
          });
        }

        b.foregroundRim.clear();
        b.foregroundRim.circle(0, 0, visR * 0.98).stroke({
          color: 0x9ee8ff,
          width: 2.2,
          alpha: 0.18 + pulse * 0.18,
        });
        b.foregroundRim.circle(0, 0, g.radius * 0.9).stroke({
          color: 0xe0f6ff,
          width: 1.4,
          alpha: 0.18 + corePulse * 0.18,
        });
        const glintSpin = -spin * 0.8 + now * 0.0008;
        for (let j = 0; j < 8; j++) {
          const a = glintSpin + (j / 8) * TAU;
          const ar = a + TAU * 0.035;
          b.foregroundRim.arc(0, 0, visR * 1.02, a, ar).stroke({
            color: j % 2 === 0 ? 0xffffff : 0x78d8ff,
            width: j % 2 === 0 ? 4.2 : 2.8,
            alpha: 0.28 + pulse * 0.32,
          });
        }

      }
    }
  }

  // Sync World Border
  if (_borderGfx && _warningGfx && getState().player) {
    const tutorialBorder = sys.idx === 0 && getState().player.tutorial?.active;
    if (tutorialBorder) {
      _borderGfx.visible = false;
      _warningGfx.visible = false;
    } else {
      const outerR = sys.idx === 0 ? TUTORIAL_SECTOR.radius : SECTOR_OUTER_RADIUS;
      rebuildWorldBorder(outerR);
      const pr = Math.hypot(getState().player.x, getState().player.y);
      const distToEdge = outerR - pr;
      const fadeStart = 1800;
      const fadeEnd = 600;

      if (distToEdge <= fadeStart) {
        const t = Math.min(1, (fadeStart - distToEdge) / (fadeStart - fadeEnd));
        const borderAlpha = t * 0.18;
        const pulse = 0.92 + 0.08 * Math.sin(performance.now() * 0.0018);

        _borderGfx.alpha = borderAlpha * pulse;
        _borderGfx.visible = true;

        _warningGfx.alpha = borderAlpha * 0.35 * pulse;
        _warningGfx.visible = true;
      } else {
        _borderGfx.visible = false;
        _warningGfx.visible = false;
      }
    }
  }
}

export function destroyPixiCelestial(): void {
  // Destroy Star elements
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

  // Destroy Gates
  for (const b of _gateBundles) {
    b.container.destroy({ children: true });
    b.foregroundContainer.destroy({ children: true });
  }
  _gateBundles = [];

  // Destroy border
  if (_borderGfx) { _borderGfx.destroy(); _borderGfx = null; }
  if (_warningGfx) { _warningGfx.destroy(); _warningGfx = null; }
}
