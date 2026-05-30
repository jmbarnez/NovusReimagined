import { Sprite, Texture } from "pixi.js";
import { Client } from "../../state.js";
import { stationLayer } from "../../pixi.js";
import { drawGenericBody } from "./bake-generic.js";
import { drawHomeBody } from "./bake-home.js";
import { drawIndustrialHub } from "./bake-industrial.js";
import {
  COL,
  LIGHT_DIRS,
  LIGHT_RGB,
  TAU,
  type Station,
  type StationBundle,
  canvasToTexture,
  makeCanvas,
  texSizeFor,
} from "./shared.js";

export const bundles = new Map<string, StationBundle>();

function bakeStationBody(st: Station): { tex: Texture; texSize: number } {
  const size = texSizeFor(st);
  const { c, cx, half, superscale, dpr } = makeCanvas(size);
  if (st.structureType === "industrial") drawIndustrialHub(cx, half, st);
  else if (st.isHome) drawHomeBody(cx, half, st);
  else drawGenericBody(cx, half, st);
  const mipmap = Client.settings?.mipmapping ?? true;
  return { tex: canvasToTexture(c, superscale, dpr, mipmap), texSize: size };
}

function bakeStationShieldTexture(st: Station, texSize: number): Texture {
  const { c, cx, half, superscale, dpr } = makeCanvas(texSize);
  const R = st.radius;
  const isHome = st.isHome;
  const isIndustrial = st.structureType === "industrial";
  const shieldR = isHome ? R * 1.78 : R * 1.32;
  const rgb = isHome ? COL.cyan : isIndustrial ? COL.amber : COL.green;

  cx.save();
  cx.translate(half, half);

  // 1. Outer volumetric plasma energy halo
  const g = cx.createRadialGradient(0, 0, shieldR - 12 * (R / 55), 0, 0, shieldR + 6 * (R / 55));
  g.addColorStop(0, `rgba(${rgb}, 0)`);
  g.addColorStop(0.7, `rgba(${rgb}, 0.24)`);
  g.addColorStop(1, `rgba(${rgb}, 0)`);
  cx.fillStyle = g;
  cx.beginPath();
  cx.arc(0, 0, shieldR + 6 * (R / 55), 0, TAU);
  cx.arc(0, 0, shieldR - 12 * (R / 55), 0, TAU, true);
  cx.fill();

  // 2. Crisp, ultra-sharp vector hairline shield boundary
  cx.strokeStyle = `rgba(${rgb}, 0.65)`;
  cx.lineWidth = 1.0;
  cx.beginPath(); cx.arc(0, 0, shieldR, 0, TAU); cx.stroke();

  // 3. Faint interior auxiliary harmonic ring
  cx.strokeStyle = `rgba(${rgb}, 0.22)`;
  cx.lineWidth = 0.8;
  cx.beginPath(); cx.arc(0, 0, shieldR - 6 * (R / 55), 0, TAU); cx.stroke();

  // 4. Detailed calibration ticks / notches along vector shield perimeter
  cx.strokeStyle = `rgba(${rgb}, 0.45)`;
  cx.lineWidth = 1.2;
  const ticks = isHome ? 32 : 16;
  for (let i = 0; i < ticks; i++) {
    const a = (i / ticks) * TAU;
    const len = 5 * (R / 55);
    cx.beginPath();
    cx.moveTo(Math.cos(a) * (shieldR - len), Math.sin(a) * (shieldR - len));
    cx.lineTo(Math.cos(a) * (shieldR + len), Math.sin(a) * (shieldR + len));
    cx.stroke();
  }

  // 5. Stylized dynamic orbital energy segments (deflector arcs)
  cx.strokeStyle = `rgba(${rgb}, 0.25)`;
  cx.lineWidth = 1.8;
  for (let i = 0; i < 4; i++) {
    const start = (i * Math.PI / 2) + 0.15;
    const end = start + 0.65;
    cx.beginPath();
    cx.arc(0, 0, shieldR + 3 * (R / 55), start, end);
    cx.stroke();
  }

  cx.restore();
  const mipmap = Client.settings?.mipmapping ?? true;
  return canvasToTexture(c, superscale, dpr, mipmap);
}

function bakeStationLightTextures(st: Station, size: number): Texture[] {
  const LIGHT_SUPER = 1;
  const reach = st.isHome ? st.radius * 1.6 : st.radius * 1.1;
  const out: Texture[] = [];
  for (let d = 0; d < LIGHT_DIRS; d++) {
    const a = (d / LIGHT_DIRS) * TAU;
    const { c, cx, half, superscale, dpr } = makeCanvas(size, LIGHT_SUPER);
    cx.beginPath();
    cx.arc(half, half, reach, 0, TAU);
    cx.clip();
    const ex = Math.cos(a) * reach, ey = Math.sin(a) * reach;
    const g = cx.createLinearGradient(half - ex, half - ey, half + ex, half + ey);
    g.addColorStop(0.00, `rgba(${LIGHT_RGB},0)`);
    g.addColorStop(0.50, `rgba(${LIGHT_RGB},0)`);
    g.addColorStop(0.82, `rgba(${LIGHT_RGB},0.45)`);
    g.addColorStop(1.00, `rgba(${LIGHT_RGB},0.9)`);
    cx.fillStyle = g;
    cx.fillRect(0, 0, size, size);
    out.push(canvasToTexture(c, superscale, dpr));
  }
  return out;
}

export function createBundle(st: Station): StationBundle {
  const { tex, texSize } = bakeStationBody(st);
  const body = new Sprite(tex);
  body.anchor.set(0.5);
  stationLayer!.addChild(body);

  const lightTex = bakeStationLightTextures(st, texSize);
  const light = new Sprite(lightTex[0] ?? Texture.EMPTY);
  light.anchor.set(0.5);
  light.blendMode = "add";
  light.alpha = 0.7;
  light.visible = false;
  stationLayer!.addChild(light);

  // Bake secondary counter-rotating dynamic energy shield ring
  const shieldTex = bakeStationShieldTexture(st, texSize);
  const shield = new Sprite(shieldTex);
  shield.anchor.set(0.5);
  shield.blendMode = "add";
  shield.alpha = 0.55;
  shield.visible = true;
  stationLayer!.addChild(shield);

  return { body, light, lightTex, texSize, shield };
}

export function destroyBundle(id: string) {
  const b = bundles.get(id);
  if (!b) return;
  stationLayer!.removeChild(b.body); b.body.destroy();
  stationLayer!.removeChild(b.light); b.light.destroy();
  for (const t of b.lightTex) t.destroy();
  if (b.shield) {
    stationLayer!.removeChild(b.shield);
    b.shield.destroy();
  }
  bundles.delete(id);
}

export function clearStationTextureCaches(): void {
  for (const id of Array.from(bundles.keys())) destroyBundle(id);
}
