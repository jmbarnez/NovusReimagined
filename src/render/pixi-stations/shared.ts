import { ImageSource, Sprite, Texture } from "pixi.js";
import { pixiDpr } from "../../pixi.js";
import { ri, rf } from "../../utils/math.js";

export const TAU = Math.PI * 2;
/**
 * Supersampling multiplier. Matches ships/enemies (TEX_SCALE=3) so all baked
 * sprites share the same per-pixel sharpness.
 */
export const TEX_SCALE = 3;
export const LIGHT_DIRS = 8;
export const LIGHT_RGB = "255,248,230";

export interface Station {
  id: string;
  x: number;
  y: number;
  radius: number;
  spin: number;
  isHome: boolean;
  name: string;
  structureType?: string;
  collectRadius?: number;
}

export interface StationBundle {
  body: Sprite;
  light: Sprite;
  lightTex: Texture[];
  texSize: number;
  shield?: Sprite;
}

/** Caps the per-bake DPR so huge station textures don't blow GPU memory. */
function stationDpr(): number {
  return Math.min(pixiDpr, 1.5);
}

export function texSizeFor(st: Station): number {
  // Overlap includes outer torus segments, solar arrays, and the pulsing energy shield bounds
  const reach = st.isHome ? st.radius * 1.95 : st.radius * 1.55;
  return Math.ceil(reach * 2 + 16);
}

export function makeCanvas(size: number, superscale: number = TEX_SCALE): { c: HTMLCanvasElement; cx: CanvasRenderingContext2D; half: number; superscale: number; dpr: number } {
  const dpr = stationDpr();
  const c = document.createElement("canvas");
  c.width = c.height = Math.max(1, Math.ceil(size * superscale * dpr));
  const cx = c.getContext("2d")!;
  cx.scale(superscale * dpr, superscale * dpr);
  return { c, cx, half: size / 2, superscale, dpr };
}

export function canvasToTexture(c: HTMLCanvasElement, superscale: number, dpr: number, mipmap = false): Texture {
  return new Texture({ source: new ImageSource({ resource: c, resolution: superscale * dpr, scaleMode: "linear", autoGenerateMipmaps: mipmap }) });
}

// ─── Shared Palette ─────────────────────────────────────────────────────────
export const COL = {
  // Sleek titanium and carbon space hulls
  hullDark:   "#12151c",
  hullMid:    "#222832",
  hullLite:   "#384352",
  hullEdge:   "#506075",
  steelRim:   "rgba(160,190,225,0.65)",
  shadow:     "rgba(0,0,0,0.65)",
  shadowSoft: "rgba(0,0,0,0.35)",

  // Emissive Neon Energies
  amber:      "255,150,30",        // sodium residential window / core glow
  amberSoft:  "255,185,90",
  cyan:       "0,210,255",         // sci-fi cyber blue
  cyanSoft:   "110,230,255",
  green:      "40,245,130",        // biosphere / research align
  greenSoft:  "120,255,180",
  hazard:     "255,60,40",         // flashing warning beacons

  // Volcanic Mining & Industrial Copper/Bronze
  copperDark: "#4a2106",
  copperMid:  "#8e4414",
  copperLite: "#d6732f",
  copperGold: "#b57e33",

  // Solar Wafer System
  solarBase:  "#0b1426",
  solarCell:  "#1a305a",
  solarRim:   "rgba(85,155,225,0.4)",
};

// ─── Graphics Drawing Helpers ──────────────────────────────────────────────────

export function drawHullDisc(cx: CanvasRenderingContext2D, r: number) {
  // Rich volumetric drum - shaded base + rim specular + ambient occlusion
  const g = cx.createLinearGradient(0, -r, 0, r);
  g.addColorStop(0.0, COL.hullLite);
  g.addColorStop(0.45, COL.hullMid);
  g.addColorStop(1.0, COL.hullDark);
  cx.fillStyle = g;
  cx.beginPath(); cx.arc(0, 0, r, 0, TAU); cx.fill();

  // Bottom shadow / ambient occlusion
  cx.save();
  cx.beginPath(); cx.arc(0, 0, r, 0, TAU); cx.clip();
  const ao = cx.createLinearGradient(0, r * 0.15, 0, r);
  ao.addColorStop(0, "rgba(0,0,0,0)");
  ao.addColorStop(1, "rgba(0,0,0,0.55)");
  cx.fillStyle = ao;
  cx.fillRect(-r, -r, r * 2, r * 2);
  cx.restore();

  // Double technical outlines
  cx.strokeStyle = "rgba(0,0,0,0.9)";
  cx.lineWidth = 1.3;
  cx.beginPath(); cx.arc(0, 0, r, 0, TAU); cx.stroke();

  // Highlight on upper-left quadrant rim (simulates light reflection)
  cx.strokeStyle = COL.steelRim;
  cx.lineWidth = 1.0;
  cx.beginPath(); cx.arc(0, 0, r - 0.7, Math.PI * 1.12, Math.PI * 1.88);
  cx.stroke();
}

export function drawLatticeSpoke(cx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number, LW: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;

  cx.save();

  // Draw shadow
  cx.strokeStyle = "rgba(0,0,0,0.45)";
  cx.lineWidth = 3.5 * LW;
  cx.beginPath();
  cx.moveTo(x1 + px * 3, y1 + py * 3);
  cx.lineTo(x2 + px * 2, y2 + py * 2);
  cx.stroke();

  // Draw main structural outer beams
  cx.strokeStyle = COL.hullMid;
  cx.lineWidth = 2.0 * LW;
  cx.beginPath();
  cx.moveTo(x1 + px * w / 2, y1 + py * w / 2);
  cx.lineTo(x2 + px * w / 3, y2 + py * w / 3);
  cx.moveTo(x1 - px * w / 2, y1 - py * w / 2);
  cx.lineTo(x2 - px * w / 3, y2 - py * w / 3);
  cx.stroke();

  // Metallic rim highlight on beams
  cx.strokeStyle = COL.steelRim;
  cx.lineWidth = 0.7 * LW;
  cx.beginPath();
  cx.moveTo(x1 + px * (w / 2 - 0.6), y1 + py * (w / 2 - 0.6));
  cx.lineTo(x2 + px * (w / 3 - 0.6), y2 + py * (w / 3 - 0.6));
  cx.stroke();

  // Detailed diagonal lattice bracing (zig-zag struts)
  cx.strokeStyle = COL.hullDark;
  cx.lineWidth = 1.2 * LW;
  cx.beginPath();
  const steps = Math.ceil(len / (w * 1.1));
  for (let i = 0; i < steps; i++) {
    const t1 = i / steps;
    const t2 = (i + 1) / steps;
    const ax = x1 + dx * t1;
    const ay = y1 + dy * t1;
    const bx = x1 + dx * t2;
    const by = y1 + dy * t2;

    const aw = w * (1 - t1 * 0.33);
    const bw = w * (1 - t2 * 0.33);

    if (i % 2 === 0) {
      cx.moveTo(ax + px * aw / 2, ay + py * aw / 2);
      cx.lineTo(bx - px * bw / 2, by - py * bw / 2);
    } else {
      cx.moveTo(ax - px * aw / 2, ay - py * aw / 2);
      cx.lineTo(bx + px * bw / 2, by + py * bw / 2);
    }
  }
  cx.stroke();

  cx.restore();
}

export function drawEnergyConduit(cx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, LW: number) {
  cx.save();
  // 1. Dark outer tube
  cx.strokeStyle = "#080c10";
  cx.lineWidth = 2.4 * LW;
  cx.beginPath(); cx.moveTo(x1, y1); cx.lineTo(x2, y2); cx.stroke();

  // 2. Neon energy core line
  cx.strokeStyle = `rgba(${color}, 0.95)`;
  cx.lineWidth = 1.0 * LW;
  cx.beginPath(); cx.moveTo(x1, y1); cx.lineTo(x2, y2); cx.stroke();

  // 3. Ambient neon glow wash
  cx.strokeStyle = `rgba(${color}, 0.35)`;
  cx.lineWidth = 3.5 * LW;
  cx.beginPath(); cx.moveTo(x1, y1); cx.lineTo(x2, y2); cx.stroke();
  cx.restore();
}

export function drawSolarSail(cx: CanvasRenderingContext2D, px: number, py: number, pW: number, pH: number, angle: number, S: number, LW: number) {
  cx.save();
  cx.translate(px, py);
  cx.rotate(angle);

  // 1. Heavy shadow
  cx.fillStyle = "rgba(0,0,0,0.45)";
  cx.beginPath();
  cx.roundRect(-pW / 2 + 3 * S, -pH / 2 + 3 * S, pW, pH, 3 * S);
  cx.fill();

  // 2. Plated structural outer frame
  const frame = cx.createLinearGradient(0, -pH / 2, 0, pH / 2);
  frame.addColorStop(0, COL.hullLite);
  frame.addColorStop(0.5, COL.hullMid);
  frame.addColorStop(1, COL.hullDark);
  cx.fillStyle = frame;
  cx.beginPath();
  cx.roundRect(-pW / 2, -pH / 2, pW, pH, 3 * S);
  cx.fill();
  cx.strokeStyle = "rgba(0,0,0,0.85)";
  cx.lineWidth = 1.2 * LW;
  cx.stroke();

  // Inner steel rim highlight
  cx.strokeStyle = COL.steelRim;
  cx.lineWidth = 0.7 * LW;
  cx.beginPath();
  cx.roundRect(-pW / 2 + 0.8 * S, -pH / 2 + 0.8 * S, pW - 1.6 * S, pH - 1.6 * S, 2 * S);
  cx.stroke();

  // 3. Solar Crystalline Silicon Grid (Inset)
  const inset = 3.0 * S;
  cx.save();
  cx.beginPath();
  cx.roundRect(-pW / 2 + inset, -pH / 2 + inset, pW - inset * 2, pH - inset * 2, 1.5 * S);
  cx.clip();

  const sg = cx.createLinearGradient(0, -pH / 2, 0, pH / 2);
  sg.addColorStop(0, COL.solarCell);
  sg.addColorStop(0.5, COL.solarBase);
  sg.addColorStop(1.0, "#030610");
  cx.fillStyle = sg;
  cx.fillRect(-pW / 2, -pH / 2, pW, pH);

  // Cell divisions (neon blue hairline lines for advanced power grid)
  cx.strokeStyle = COL.solarRim;
  cx.lineWidth = 0.6 * LW;
  for (let g = -pH / 2 + 6 * S; g < pH / 2; g += 6 * S) {
    cx.beginPath(); cx.moveTo(-pW / 2, g); cx.lineTo(pW / 2, g); cx.stroke();
  }
  for (let gx = -pW / 2 + 6 * S; gx < pW / 2; gx += 6 * S) {
    cx.beginPath(); cx.moveTo(gx, -pH / 2); cx.lineTo(gx, pH / 2); cx.stroke();
  }

  // Specular sheen wash (sun catching the glass)
  const spec = cx.createLinearGradient(-pW / 2, -pH / 2, pW / 2, pH / 2);
  spec.addColorStop(0, "rgba(255,255,255,0.22)");
  spec.addColorStop(0.35, "rgba(255,255,255,0.06)");
  spec.addColorStop(0.65, "rgba(255,255,255,0)");
  cx.fillStyle = spec;
  cx.fillRect(-pW / 2, -pH / 2, pW, pH);
  cx.restore();

  // Corner warning / status indicators
  cornerLight(cx, -pW / 2 + S, -pH / 2 + S, S, COL.hazard);
  cornerLight(cx, pW / 2 - S, -pH / 2 + S, S, COL.hazard);
  cornerLight(cx, -pW / 2 + S, pH / 2 - S, S, COL.cyan);
  cornerLight(cx, pW / 2 - S, pH / 2 - S, S, COL.cyan);

  cx.restore();
}

export function drawHabitatDome(cx: CanvasRenderingContext2D, x: number, y: number, r: number, S: number, LW: number, colorRGB = COL.green) {
  cx.save();
  cx.translate(x, y);

  // Outer structural base ring
  cx.fillStyle = COL.hullMid;
  cx.beginPath(); cx.arc(0, 0, r + 2.5 * S, 0, TAU); cx.fill();
  cx.strokeStyle = "rgba(0,0,0,0.85)";
  cx.lineWidth = 1.2 * LW;
  cx.beginPath(); cx.arc(0, 0, r + 2.5 * S, 0, TAU); cx.stroke();

  // Dome biosphere content - glowing radial gradient representing lush internal environment
  const dome = cx.createRadialGradient(-r * 0.2, -r * 0.2, 0, 0, 0, r);
  dome.addColorStop(0.0, `rgba(${colorRGB}, 0.95)`);
  dome.addColorStop(0.65, `rgba(${colorRGB}, 0.35)`);
  dome.addColorStop(1.0, `rgba(10,25,35,0.92)`);
  cx.fillStyle = dome;
  cx.beginPath(); cx.arc(0, 0, r, 0, TAU); cx.fill();

  // Intricate spherical structural ribs (dome framing)
  cx.strokeStyle = "rgba(255,255,255,0.32)";
  cx.lineWidth = 0.8 * LW;
  for (let i = 1; i <= 3; i++) {
    cx.beginPath();
    cx.ellipse(0, 0, r, r * (i / 4), 0, 0, TAU);
    cx.stroke();
    cx.beginPath();
    cx.ellipse(0, 0, r * (i / 4), r, 0, 0, TAU);
    cx.stroke();
  }

  // Double outer glass outline
  cx.strokeStyle = "rgba(255,255,255,0.45)";
  cx.lineWidth = 0.7 * LW;
  cx.beginPath(); cx.arc(0, 0, r, 0, TAU); cx.stroke();

  // Crisp glass specular reflection dot
  cx.fillStyle = "rgba(255,255,255,0.55)";
  cx.beginPath();
  cx.arc(-r * 0.35, -r * 0.35, r * 0.2, 0, TAU);
  cx.fill();

  cx.restore();
}

export function drawGreebles(cx: CanvasRenderingContext2D, rng: () => number, R: number, S: number, LW: number) {
  const count = 12 + ri(rng, 0, 8);
  for (let i = 0; i < count; i++) {
    const a = rng() * TAU;
    const dist = rf(rng, R * 0.38, R * 0.82);
    const w = rf(rng, 5, 14) * S;
    const h = rf(rng, 4, 11) * S;
    cx.save();
    cx.translate(Math.cos(a) * dist, Math.sin(a) * dist);
    cx.rotate(a + Math.PI / 2);

    // Two-tone plated greeble block
    const grad = cx.createLinearGradient(-w / 2, 0, w / 2, 0);
    grad.addColorStop(0, COL.hullLite);
    grad.addColorStop(0.5, COL.hullMid);
    grad.addColorStop(1, COL.hullDark);
    cx.fillStyle = grad;
    cx.fillRect(-w / 2, -h / 2, w, h);

    cx.strokeStyle = "rgba(0,0,0,0.72)";
    cx.lineWidth = 0.7 * LW;
    cx.strokeRect(-w / 2, -h / 2, w, h);

    // Faint metallic reflection on greeble edge
    cx.strokeStyle = COL.steelRim;
    cx.lineWidth = 0.4 * LW;
    cx.beginPath();
    cx.moveTo(-w / 2 + 0.4, -h / 2 + 0.4);
    cx.lineTo(w / 2 - 0.4, -h / 2 + 0.4);
    cx.stroke();

    // Occasional tiny status pip on greeble
    if (rng() > 0.6) {
      const col = rng() > 0.5 ? COL.cyan : COL.hazard;
      cx.fillStyle = `rgba(${col}, 0.9)`;
      cx.beginPath(); cx.arc(-w / 4, 0, 0.9 * S, 0, TAU); cx.fill();
    }
    cx.restore();
  }
}

export function drawHangar(cx: CanvasRenderingContext2D, x: number, y: number, angle: number, w: number, h: number, S: number, LW: number) {
  cx.save();
  cx.translate(x, y);
  cx.rotate(angle);

  // 1. Dark deep bay interior
  cx.fillStyle = "#06090e";
  cx.fillRect(-w / 2, -h / 2, w, h);

  // 2. Rich atmospheric barrier shield glow leaking outwards (neon cyan)
  const g = cx.createLinearGradient(0, -h / 2, 0, h / 2);
  g.addColorStop(0.0, "rgba(0,0,0,0.92)");
  g.addColorStop(0.5, `rgba(${COL.cyan}, 0.28)`);
  g.addColorStop(1.0, "rgba(0,0,0,0.92)");
  cx.fillStyle = g;
  cx.fillRect(-w / 2, -h / 2, w, h);

  // 3. Detailed landing guide markings (yellow approach strips along runway edge)
  cx.fillStyle = "rgba(255,200,50,0.8)";
  for (let side = -1; side <= 1; side += 2) {
    const lx = side * (w / 2 - 1.8 * S);
    for (let j = 0; j < 5; j++) {
      const ly = -h / 2 + (j + 0.5) * (h / 5);
      cx.fillRect(lx - 0.5 * S, ly - 1.2 * S, 1.0 * S, 2.4 * S);
    }
  }

  // 4. Heavy metallic framing gate
  cx.strokeStyle = "rgba(0,0,0,0.85)";
  cx.lineWidth = 1.2 * LW;
  cx.strokeRect(-w / 2, -h / 2, w, h);

  cx.strokeStyle = COL.steelRim;
  cx.lineWidth = 0.6 * LW;
  cx.strokeRect(-w / 2 + 0.6, -h / 2 + 0.6, w - 1.2, h - 1.2);

  // Approach flash beacons outside hangar
  cornerLight(cx, -w / 2 - S, -h / 2, S, COL.cyan);
  cornerLight(cx, w / 2 + S, -h / 2, S, COL.cyan);

  cx.restore();
}

export function cornerLight(cx: CanvasRenderingContext2D, x: number, y: number, S: number, rgb = "255,80,80") {
  const halo = cx.createRadialGradient(x, y, 0, x, y, 4.0 * S);
  halo.addColorStop(0, `rgba(${rgb},0.8)`);
  halo.addColorStop(1, `rgba(${rgb},0)`);
  cx.fillStyle = halo;
  cx.beginPath(); cx.arc(x, y, 4.0 * S, 0, TAU); cx.fill();
  cx.fillStyle = `rgba(${rgb},0.98)`;
  cx.beginPath(); cx.arc(x, y, 1.2 * S, 0, TAU); cx.fill();
}
