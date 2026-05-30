import { getState } from "../state-access.js";
import type { System, Star, DustParticle } from "../types/world.js";
import { Container, Sprite, Texture, ImageSource, Graphics } from "pixi.js";
import { W, H } from "../canvas.js";
import { TAU } from "../constants.js";

import { screenContainer, planetLayer } from "../pixi.js";
import { initPlanetSprites } from "./pixi-planets.js";

import {
  initNebulaMesh, updateNebulaMesh, setNebulaSystem, resizeNebulaMesh,
} from "./pixi-nebula-gpu.js";


const WRAP_FAR           = 6000;
const WRAP_MID           = 4000;
const WRAP_NEAR          = 3000;
const WRAP_DUST          = 3000;
const STAR_FAR_PARALLAX  = 0.006;
const STAR_MID_PARALLAX  = 0.018;
const STAR_NEAR_PARALLAX = 0.036;

let currentSysIdx = -1;
let _lastWc = 0, _lastHc = 0;
let starTexture: Texture | null = null;

// Screen-space sun position for lens flare (computed from sys.sunDir each frame)
let _distantSunScreenX   = 0;
let _distantSunScreenY   = 0;

export function getDistantSunScreenPos() {
  return { x: _distantSunScreenX, y: _distantSunScreenY };
}

export let farStarContainer:  Container | null = null;
export let midStarContainer:  Container | null = null;
export let nearStarContainer: Container | null = null;
export let dustContainer:     Container | null = null;

// Compute the sun's screen position for lens flare without rendering a sprite
function updateSunScreenPos(Wc: number, Hc: number, camX: number, camY: number, sys: System) {
  if (!sys) return;
  const sunDir  = sys.sunDir ?? 0;
  const screenDist = Math.min(Wc, Hc) * 0.38;
  const SUN_PARALLAX = 0.003;
  _distantSunScreenX = Wc / 2 + Math.cos(sunDir) * screenDist - camX * SUN_PARALLAX;
  _distantSunScreenY = Hc / 2 + Math.sin(sunDir) * screenDist - camY * SUN_PARALLAX;
}

// ── Background star texture ────────────────────────────────────────────────
function bakeStarTexture(): Texture {
  const S = 96;
  const c = document.createElement("canvas");
  c.width = S; c.height = S;
  const ctx = c.getContext("2d")!;
  const cx = S / 2, cy = S / 2;

  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, S * 0.08);
  core.addColorStop(0,    "rgba(255,255,255,1)");
  core.addColorStop(0.45, "rgba(255,255,255,0.55)");
  core.addColorStop(1,    "rgba(255,255,255,0)");
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, S, S);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.rotate(i * Math.PI / 2);
    const g = ctx.createLinearGradient(0, 0, S / 2 - 2, 0);
    g.addColorStop(0,    "rgba(255,255,255,0.95)");
    g.addColorStop(0.04, "rgba(255,255,255,0.55)");
    g.addColorStop(0.18, "rgba(255,255,255,0.12)");
    g.addColorStop(0.5,  "rgba(255,255,255,0.02)");
    g.addColorStop(1,    "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, -0.9, S / 2 - 2, 1.8);
    ctx.restore();
  }
  ctx.restore();

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(cx - 1, cy - 1, 2, 2);

  return new Texture({ source: new ImageSource({ resource: c, resolution: 1, scaleMode: "linear" }) });
}

function spawnStarSprites() {
  if (!starTexture) starTexture = bakeStarTexture();
  const spawnFor = (container: Container, stars: Star[]) => {
    container.removeChildren();
    for (const s of stars) {
      const sprite = new Sprite(starTexture!);
      sprite.anchor.set(0.5);
      sprite.scale.set(Math.max(0.018, s.r * (5 / 96)));
      sprite.alpha = s.a;
      container.addChild(sprite);
    }
  };
  spawnFor(farStarContainer!,  getState().STARS_FAR  ?? []);
  spawnFor(midStarContainer!,  getState().STARS      ?? []);
  spawnFor(nearStarContainer!, getState().STARS_NEAR ?? []);
}

function spawnDustSprites() {
  dustContainer!.removeChildren();
  for (const d of getState().DUST ?? []) {
    const g = new Graphics() as Graphics & { _dustData?: DustParticle };
    const dotR = 0.6 + d.r * 3;
    g.circle(0, 0, dotR);
    g.fill({ color: 0xffffff, alpha: d.a * 3.5 });
    g._dustData = d;
    dustContainer!.addChild(g);
  }
}

export function refreshBackground() {
  currentSysIdx = -1;
}

// ── Init ───────────────────────────────────────────────────────────────────
export function initBackground() {
  if (!screenContainer) return;

  // GPU nebula mesh at z-index 0 (back of screenContainer)
  initNebulaMesh(screenContainer);

  // Star containers
  farStarContainer  = new Container();
  screenContainer.addChild(farStarContainer);
  midStarContainer  = new Container();
  screenContainer.addChild(midStarContainer);
  nearStarContainer = new Container();
  screenContainer.addChild(nearStarContainer);
  dustContainer     = new Container();
  screenContainer.addChild(dustContainer);

  spawnStarSprites();
  spawnDustSprites();
}

// ── Per-frame update ───────────────────────────────────────────────────────
export function updateBackground(now: number, camX: number, camY: number) {
  const state   = getState();
  const sysIdx  = state.player?.sysIdx ?? 0;
  const sys     = state.GALAXY?.[sysIdx];
  const starHue = sys?.starHue ?? 210;

  const Wc = W();
  const Hc = H();

  // Resize GPU nebula mesh when viewport changes
  if (Wc !== _lastWc || Hc !== _lastHc) {
    _lastWc = Wc; _lastHc = Hc;
    resizeNebulaMesh();
  }

  if (sysIdx !== currentSysIdx) {
    refreshBackground();
    currentSysIdx = sysIdx;
    spawnStarSprites();
    spawnDustSprites();
    if (sys) {
      setNebulaSystem(sys);
      if (planetLayer) initPlanetSprites(planetLayer, sys);
    }
  }

  updateNebulaMesh(now, camX, camY);

  if (farStarContainer)  updateStarLayer(farStarContainer,  getState().STARS_FAR  ?? [], WRAP_FAR,  STAR_FAR_PARALLAX,  Wc, Hc, now, 0,    camX, camY);
  if (midStarContainer)  updateStarLayer(midStarContainer,  getState().STARS      ?? [], WRAP_MID,  STAR_MID_PARALLAX,  Wc, Hc, now, 0.08, camX, camY);
  if (nearStarContainer) updateStarLayer(nearStarContainer, getState().STARS_NEAR ?? [], WRAP_NEAR, STAR_NEAR_PARALLAX, Wc, Hc, now, 0.22, camX, camY);
  if (dustContainer)     updateDustLayer(dustContainer, Wc, Hc, now, camX, camY, starHue);

  updateSunScreenPos(Wc, Hc, camX, camY, sys);
}

export function getNebulaDensity(_camX: number, _camY: number): number {
  return 0.4;  // consistent ambient hull-light brightness when nebulae are on
}

// ── Star / dust layer updaters ─────────────────────────────────────────────
function updateStarLayer(
  container: Container, stars: Star[], _wrapW: number,
  parallaxRate: number, Wc: number, Hc: number,
  now: number, scintillateAmt: number, camX: number, camY: number,
) {
  const offX = camX * parallaxRate;
  const offY = camY * parallaxRate;
  let i = 0;
  for (const child of container.children) {
    const s = stars[i]; if (!s) { i++; continue; }
    let sx = ((s.ox - offX) % Wc + Wc) % Wc;
    let sy = ((s.oy - offY) % Hc + Hc) % Hc;
    const twinkle = scintillateAmt > 0
      ? 1 + scintillateAmt * Math.sin(now * 0.00025 * (1 + s.r * 1.8) + s.hue * 0.7)
      : 1;
    child.x = sx; child.y = sy;
    child.alpha = Math.min(1, s.a * 0.80 * twinkle);
    if (s.hue !== undefined) {
      const h = ((s.hue + 360) % 360);
      const r = Math.round(255 * (0.85 + 0.15 * Math.cos((h - 30)  * TAU / 360)));
      const g = Math.round(255 * (0.85 + 0.15 * Math.cos((h - 150) * TAU / 360)));
      const b = Math.round(255 * (0.85 + 0.15 * Math.cos((h - 270) * TAU / 360)));
      (child as Sprite).tint = (r << 16) | (g << 8) | b;
    }
    i++;
  }
}

function updateDustLayer(
  container: Container, Wc: number, Hc: number,
  now: number, camX: number, camY: number, starHue: number,
) {
  const tintR = 0.88 + 0.12 * Math.cos((starHue - 30)  * TAU / 360);
  const tintG = 0.88 + 0.12 * Math.cos((starHue - 150) * TAU / 360);
  const tintB = 0.88 + 0.12 * Math.cos((starHue - 270) * TAU / 360);
  const tint = (Math.round(255 * tintR) << 16) | (Math.round(255 * tintG) << 8) | Math.round(255 * tintB);
  let i = 0;
  for (const child of container.children) {
    const d = getState().DUST?.[i]; if (!d) { i++; continue; }
    const offX = camX * d.parallax;
    const offY = camY * d.parallax;
    child.x = ((d.ox - offX + now * d.drift)        % WRAP_DUST + WRAP_DUST) % WRAP_DUST;
    child.y = ((d.oy - offY + now * d.drift * 0.6)  % Hc        + Hc)        % Hc;
    (child as Graphics).tint = tint;
    i++;
  }
}

export const initPixiBackground  = initBackground;
export const updatePixiBackground = updateBackground;
