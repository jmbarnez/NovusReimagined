import { G, Client } from "../state.js";
import { Container, Sprite } from "pixi.js";
import { HUD_SIDE_W, HUD_BOTTOM_H } from "../constants.js";
import { mkRng } from "../utils/math.js";
import { TAU } from "../constants.js";

const NEB_TEX_SIZE = 1024;
const DUST_PARALLAX = 0.45;
const WRAP_FAR = 4000;
const WRAP_MID = 3000;
const WRAP_NEAR = 2000;
const WRAP_DUST = 2500;
const STAR_FAR_PARALLAX = 0.15;
const STAR_MID_PARALLAX = 0.35;
const STAR_NEAR_PARALLAX = 0.65;
const NEB_WRAP = [WRAP_FAR, WRAP_MID, WRAP_NEAR];
const NEB_PARALLAX = [0.1, 0.25, 0.5];

export const nebulaLayers: Container[] = [];
export let farStarContainer: Container | null = null;
export let midStarContainer: Container | null = null;
export let nearStarContainer: Container | null = null;
export let dustContainer: Container | null = null;

export function initBackground() {
  for (let i = 0; i < 3; i++) nebulaLayers.push(new Container());
  farStarContainer = new Container();
  midStarContainer = new Container();
  nearStarContainer = new Container();
  nearStarContainer = new Container();
  dustContainer = new Container();
}

export function updateBackground(now: number, camX: number, camY: number) {
  const uiRight = Client.gameStarted ? HUD_SIDE_W : 0;
  const uiBottom = Client.gameStarted ? HUD_BOTTOM_H : 0;
  const Wc = window.innerWidth - uiRight;
  const Hc = window.innerHeight - uiBottom;

  for (let i = 0; i < nebulaLayers.length; i++) {
    updateNebulaLayer(nebulaLayers[i], NEB_WRAP[i], NEB_PARALLAX[i], Wc, Hc, now, camX, camY);
  }

  if (farStarContainer) {
    updateStarLayer(farStarContainer, G.STARS_FAR ?? [], WRAP_FAR, STAR_FAR_PARALLAX, Wc, Hc, now, 0, camX, camY);
  }
  if (midStarContainer) {
    updateStarLayer(midStarContainer, G.STARS ?? [], WRAP_MID, STAR_MID_PARALLAX, Wc, Hc, now, 0.08, camX, camY);
  }
  if (nearStarContainer) {
    updateStarLayer(nearStarContainer, G.STARS_NEAR ?? [], WRAP_NEAR, STAR_NEAR_PARALLAX, Wc, Hc, now, 0.22, camX, camY);
  }
  if (dustContainer) {
    updateDustLayer(dustContainer, Wc, Hc, now, camX, camY);
  }
}

export function getNebulaDensity(camX: number, camY: number): number {
  let total = 0;
  let count = 0;
  for (const layer of nebulaLayers) {
    for (const sprite of layer.children as any[]) {
      const dx = sprite.x - (window.innerWidth / 2);
      const dy = sprite.y - (window.innerHeight / 2);
      const d2 = dx * dx + dy * dy;
      // Weight sprites closer to the ship (center of screen) higher
      const weight = Math.max(0, 1 - Math.sqrt(d2) / 800);
      if (weight > 0) {
        total += sprite.alpha * weight;
        count += weight;
      }
    }
  }
  return count > 0 ? total / count : 0;
}

function updateNebulaLayer(container: Container, wrap: number, parallaxRate: number, Wc: number, Hc: number, now: number, camX: number, camY: number) {
  const offX = camX * parallaxRate;
  const offY = camY * parallaxRate;
  const halfW = wrap / 2;

  for (const child of container.children as Sprite[]) {
    const n = (child as any)._neb;
    if (!n) continue;

    // Position within a wrap-sized cell centred on the view.
    child.x = ((n.x - offX) % wrap + wrap) % wrap - halfW + Wc / 2;
    child.y = ((n.y - offY) % wrap + wrap) % wrap - halfW + Hc / 2;

    // Slow breathing pulse + very slow rotation drift for a living feel.
    const pulse = 1 - n.pulseAmp * 0.5 + n.pulseAmp * (0.5 + 0.5 * Math.sin(now * n.pulseSpeed));
    child.alpha = n.baseAlpha * pulse;
    child.rotation = n.rot + now * n.driftRot;
  }
}

function updateStarLayer(container: Container, stars: any[], _wrapW: number, parallaxRate: number, Wc: number, Hc: number, now: number, scintillateAmt: number, camX: number, camY: number) {
  const offX = camX * parallaxRate;
  const offY = camY * parallaxRate;
  let i = 0;

  for (const child of container.children) {
    const s = stars[i];
    if (!s) { i++; continue; }

    let sx = s.ox - offX;
    let sy = s.oy - offY;
    sx = ((sx % Wc) + Wc) % Wc;
    sy = ((sy % Hc) + Hc) % Hc;

    const twinkle = scintillateAmt > 0
      ? 1 + scintillateAmt * Math.sin(now * 0.00025 * (1 + s.r * 1.8) + s.hue * 0.7)
      : 1;
    const alpha = s.a * 0.95 * twinkle;

    child.x = sx;
    child.y = sy;
    child.alpha = Math.min(1, alpha);

    i++;
  }
}

function updateDustLayer(container: Container, Wc: number, Hc: number, now: number, camX: number, camY: number) {
  const offX = camX * DUST_PARALLAX;
  const offY = camY * DUST_PARALLAX;
  let i = 0;

  for (const child of container.children) {
    const d = G.DUST?.[i];
    if (!d) { i++; continue; }

    let dx = d.ox - offX + now * d.drift;
    let dy = d.oy - offY + now * d.drift * 0.6;
    dx = ((dx % WRAP_DUST) + WRAP_DUST) % WRAP_DUST;
    dy = ((dy % Hc) + Hc) % Hc;

    child.x = dx;
    child.y = dy;

    i++;
  }
}
