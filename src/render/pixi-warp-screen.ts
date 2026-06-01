/**
 * Warp drive screen effect.
 *
 * Migrated from Canvas 2D (`render/hud/warp-screen.ts`) to PixiJS.
 * Renders into the screen-space container so the effect sits in front of
 * the playable world, mimicking the pre-migration on-screen overlay.
 */
import { Container, Graphics, Text } from "pixi.js";
import { Client } from "../state.js";
import { screenContainer } from "../pixi.js";
import { getState } from "../state-access.js";
import { TAU } from "../constants.js";
import { mulberry32 } from "../utils/math.js";
import { viewportW, viewportH } from "./viewport.js";
import { getUIFont } from "./ui-font.js";

const PRE_WARP_DURATION = 2.4;
const POST_WARP_DURATION = 0.5;

let warpLayer: Container | null = null;
let overlayGfx: Graphics | null = null;
let streakGfx: Graphics | null = null;
let bloomGfx: Graphics | null = null;
let vigGfx: Graphics | null = null;
let flashGfx: Graphics | null = null;
let titleText: Text | null = null;
let destText: Text | null = null;
let secText: Text | null = null;

interface Streak {
  a: number;
  sp: number;
  lm: number;
  ir: number;
  w: number;
  br: number;
}

const _STREAKS: Streak[] = (() => {
  const rng = mulberry32(0xBEEF1234);
  const arr: Streak[] = [];
  for (let i = 0; i < 130; i++) {
    arr.push({
      a: rng() * TAU,
      sp: 0.22 + rng() * 0.78,
      lm: 0.45 + rng() * 0.55,
      ir: 5 + rng() * 22,
      w: 0.3 + rng() * 1.6,
      br: 0.45 + rng() * 0.55,
    });
  }
  return arr;
})();

function ensureLayer(): Container | null {
  if (warpLayer && warpLayer.parent) return warpLayer;
  if (!screenContainer) return null;
  warpLayer = new Container();
  warpLayer.label = "warp-screen";
  warpLayer.eventMode = "none";
  screenContainer.addChild(warpLayer);

  overlayGfx = new Graphics();
  streakGfx = new Graphics();
  bloomGfx = new Graphics();
  vigGfx = new Graphics();
  flashGfx = new Graphics();
  warpLayer.addChild(overlayGfx, streakGfx, bloomGfx, vigGfx, flashGfx);

  const baseStyle = (size: number, weight: "bold" | "normal", color: number) => ({
    fontFamily: getUIFont(),
    fontSize: size,
    fontWeight: weight,
    fill: color,
    align: "center" as const,
  });
  titleText = new Text({ text: "JUMP DRIVE ENGAGED", style: baseStyle(10, "bold", 0x344e72) });
  destText = new Text({ text: "", style: baseStyle(24, "bold", 0xaaceff) });
  secText = new Text({ text: "", style: baseStyle(10, "normal", 0xffcc44) });
  for (const t of [titleText, destText, secText]) {
    t.anchor.set(0.5);
    t.eventMode = "none";
    warpLayer.addChild(t);
  }
  return warpLayer;
}

export function refreshWarpScreenFonts(): void {
  const scale = Client.settings?.fontScale ?? 1.0;
  if (titleText) { titleText.style.fontFamily = getUIFont(); titleText.style.fontSize = 10 * scale; }
  if (destText) { destText.style.fontFamily = getUIFont(); destText.style.fontSize = 24 * scale; }
  if (secText) { secText.style.fontFamily = getUIFont(); secText.style.fontSize = 10 * scale; }
}

export function syncPixiWarpScreen(now: number): void {
  const layer = ensureLayer();
  if (!layer || !overlayGfx || !streakGfx || !bloomGfx || !vigGfx || !flashGfx) return;
  const state = getState();
  const player = state.player;
  if (!player) {
    layer.visible = false;
    return;
  }
  const Wc = viewportW();
  const Hc = viewportH();
  if (Wc <= 0 || Hc <= 0) {
    layer.visible = false;
    return;
  }

  const preWarp = state.warpTargetIdx >= 0;
  const cx = Wc / 2;
  const cy = Hc / 2;
  const halfDiag = Math.hypot(Wc, Hc) * 0.5;

  let progress: number;
  let arrFade: number;
  if (preWarp) {
    progress = Math.max(0, 1 - state.warpCooldown / PRE_WARP_DURATION);
    arrFade = 0;
  } else {
    progress = 1;
    arrFade = Math.min(1, (state.warpCooldown - 2.0) / POST_WARP_DURATION);
  }

  if (!preWarp && arrFade <= 0.01) {
    layer.visible = false;
    return;
  }
  layer.visible = true;

  // Dark overlay
  const overlayA = preWarp
    ? Math.min(0.92, 0.15 + progress * 0.82)
    : Math.max(0, arrFade) * 0.7;
  overlayGfx.clear();
  if (overlayA > 0.001) {
    overlayGfx.rect(0, 0, Wc, Hc).fill({ color: 0x00010a, alpha: overlayA });
  }

  // Streaks, bloom, vignette
  if (preWarp && progress > 0.02) {
    streakGfx.clear();
    for (const s of _STREAKS) {
      const len = s.lm * Math.pow(progress, 1.35) * halfDiag * s.sp;
      if (len < 3) continue;
      const alpha = s.br * Math.min(1, progress * 2) * s.sp;
      if (alpha < 0.03) continue;
      const x1 = cx + Math.cos(s.a) * s.ir;
      const y1 = cy + Math.sin(s.a) * s.ir;
      const x2 = cx + Math.cos(s.a) * (s.ir + len);
      const y2 = cy + Math.sin(s.a) * (s.ir + len);
      const w = s.w * (0.4 + progress * 0.8);
      // Approximate the linear gradient with two color segments: midpoint + tip.
      const midX = x1 + (x2 - x1) * 0.2;
      const midY = y1 + (y2 - y1) * 0.2;
      streakGfx.moveTo(x1, y1).lineTo(midX, midY).stroke({ color: 0x5082ff, width: w, alpha: alpha * 0.55 });
      streakGfx.moveTo(midX, midY).lineTo(x2, y2).stroke({ color: 0xffffff, width: w, alpha });
    }

    bloomGfx.clear();
    const bloomR = 60 + progress * 140;
    const innerR = bloomR * 0.5;
    bloomGfx.circle(cx, cy, bloomR).fill({ color: 0x466edc, alpha: 0.12 * progress });
    bloomGfx.circle(cx, cy, innerR).fill({ color: 0x8cbeff, alpha: 0.22 * progress * progress });

    vigGfx.clear();
    const innerR2 = halfDiag * 0.35;
    vigGfx.circle(cx, cy, halfDiag).fill({ color: 0x000012, alpha: 0 });
    vigGfx.circle(cx, cy, innerR2).fill({ color: 0x000012, alpha: 0.75 * progress });
  } else {
    streakGfx.clear();
    bloomGfx.clear();
    vigGfx.clear();
  }

  // Arrival flash
  flashGfx.clear();
  if (arrFade > 0.01) {
    flashGfx.rect(0, 0, Wc, Hc).fill({ color: 0xaad2ff, alpha: arrFade * 0.8 });
  }

  // Text overlays
  const destIdx = preWarp ? state.warpTargetIdx : player.sysIdx;
  const destSys = state.GALAXY[destIdx];
  const destName = (destSys?.name || "").toUpperCase();
  const textA = preWarp ? Math.min(1, (progress - 0.12) / 0.18) : arrFade;

  if (!titleText || !destText || !secText) return;
  if (textA > 0.01 && destName) {
    titleText.visible = preWarp;
    secText.visible = preWarp && !!destSys;
    if (preWarp) {
      titleText.text = "JUMP DRIVE ENGAGED";
      titleText.position.set(cx, cy - 32);
      titleText.alpha = textA;
      destText.text = `⟩⟩ ${destName}`;
      destText.position.set(cx, cy + 6);
      destText.alpha = textA;
      if (destSys) {
        const sec = destSys.security?.toFixed(1);
        const secColor = destSys.security >= 0.7 ? 0x44ff88 : destSys.security >= 0.4 ? 0xffcc44 : 0xff5544;
        secText.style.fill = secColor;
        secText.text = `SECURITY ${sec}`;
        secText.position.set(cx, cy + 28);
        secText.alpha = textA * 0.7;
      }
    } else {
      destText.text = destName;
      destText.position.set(cx, cy);
      destText.alpha = textA;
      destText.style.fill = 0xffffff;
    }
  } else {
    titleText.visible = false;
    destText.visible = false;
    secText.visible = false;
  }
}

export function destroyPixiWarpScreen(): void {
  warpLayer?.destroy({ children: true });
  warpLayer = null;
  overlayGfx = null;
  streakGfx = null;
  bloomGfx = null;
  vigGfx = null;
  flashGfx = null;
  titleText = null;
  destText = null;
  secText = null;
}
