/**
 * PixiJS station renderer.
 *
 * Each station's body (torus ring, solar panels, truss spokes, central hub,
 * docking arms, window lights, greebles) is rasterised to a Canvas 2D
 * texture once per station id and rendered as a single Sprite. The sprite
 * is rotated by st.spin each frame, replacing the per-frame Canvas 2D body
 * drawing in render/world/structures.ts.
 *
 * Per-station directional lighting overlay (8 baked sun-angle textures)
 * tracks the system star, matching the ship/enemy lighting style.
 *
 * Safe-zone ring, dock ring, and label remain in Canvas 2D for now (those
 * need per-frame state — distance to player, blink animations, etc.).
 */
import { ImageSource, Sprite, Texture } from "pixi.js";
import { Client } from "../state.js";
import type { System } from "../types/world.js";
import { stationLayer, pixiDpr } from "../pixi.js";
import { mkRng, ri, rf } from "../utils/math.js";

const TAU = Math.PI * 2;
/**
 * Supersampling multiplier. Matches ships/enemies (TEX_SCALE=3) so all baked
 * sprites share the same per-pixel sharpness; a lower value here was the main
 * source of the perceived "blurry vs crispy" mismatch between stations and
 * other entities.
 */
const TEX_SCALE = 3;
const LIGHT_DIRS = 8;
const LIGHT_RGB = "255,248,230";

interface Station {
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

interface StationBundle {
  body: Sprite;
  light: Sprite;
  lightTex: Texture[];
  texSize: number;
}

const _bundles = new Map<string, StationBundle>();

function texSizeFor(st: Station): number {
  // Bound covers ring + hazard beacons + a small safety margin.
  const reach = st.isHome ? st.radius * 1.85 : st.radius * 1.45;
  return Math.ceil(reach * 2 + 8);
}

/** Caps the per-bake DPR so huge station textures don't blow GPU memory. */
function stationDpr(): number {
  return Math.min(pixiDpr, 1.5);
}

function makeCanvas(size: number, superscale: number = TEX_SCALE): { c: HTMLCanvasElement; cx: CanvasRenderingContext2D; half: number; superscale: number; dpr: number } {
  const dpr = stationDpr();
  const c = document.createElement("canvas");
  c.width = c.height = Math.max(1, Math.ceil(size * superscale * dpr));
  const cx = c.getContext("2d")!;
  cx.scale(superscale * dpr, superscale * dpr);
  return { c, cx, half: size / 2, superscale, dpr };
}

function canvasToTexture(c: HTMLCanvasElement, superscale: number, dpr: number, mipmap = false): Texture {
  return new Texture({ source: new ImageSource({ resource: c, resolution: superscale * dpr, scaleMode: 'linear', autoGenerateMipmaps: mipmap }) });
}

// ─── Body bake ────────────────────────────────────────────────────────────────

// ─── Shared palette ─────────────────────────────────────────────────────────
// Industrial steel hulls with warm sodium-amber interior lighting and a few
// cool cyan navigation accents. Keeping every station to the same palette
// stops the parts looking like unrelated coloured discs stacked together.
const COL = {
  hullDark:   "#1b1f25",
  hullMid:    "#2c3138",
  hullLite:   "#3e444c",
  hullEdge:   "#54606b",
  steelRim:   "rgba(140,160,180,0.55)",
  shadow:     "rgba(0,0,0,0.55)",
  shadowSoft: "rgba(0,0,0,0.30)",
  amber:      "255,176,84",        // sodium habitation lighting
  amberSoft:  "255,200,120",
  cyan:       "120,210,255",       // navigation
  hazard:     "255,75,55",         // hazard beacons
  panelGold:  "#7b5a2a",           // solar panel cell base
  panelGoldL: "#b8884a",
};

function drawHullDisc(cx: CanvasRenderingContext2D, r: number) {
  // Round shaded "drum" — body + top-down light + bottom shadow + rim.
  const g = cx.createLinearGradient(0, -r, 0, r);
  g.addColorStop(0.0, COL.hullLite);
  g.addColorStop(0.45, COL.hullMid);
  g.addColorStop(1.0, COL.hullDark);
  cx.fillStyle = g;
  cx.beginPath(); cx.arc(0, 0, r, 0, TAU); cx.fill();
  // Ambient occlusion at bottom rim
  cx.save();
  cx.beginPath(); cx.arc(0, 0, r, 0, TAU); cx.clip();
  const ao = cx.createLinearGradient(0, r * 0.2, 0, r);
  ao.addColorStop(0, "rgba(0,0,0,0)");
  ao.addColorStop(1, "rgba(0,0,0,0.45)");
  cx.fillStyle = ao;
  cx.fillRect(-r, -r, r * 2, r * 2);
  cx.restore();
  // Outline
  cx.strokeStyle = "rgba(0,0,0,0.85)";
  cx.lineWidth = 1.2;
  cx.beginPath(); cx.arc(0, 0, r, 0, TAU); cx.stroke();
  // Top rim highlight
  cx.strokeStyle = COL.steelRim;
  cx.lineWidth = 0.9;
  cx.beginPath(); cx.arc(0, 0, r - 0.6, Math.PI * 1.15, Math.PI * 1.85);
  cx.stroke();
}

function drawSolarArray(cx: CanvasRenderingContext2D, px: number, py: number, pW: number, pH: number, S: number, LW: number) {
  // Warm gold solar array with subtle cool cell highlights. Drop shadow first
  // so the panel reads as floating off the hub rather than glued to it.
  cx.save();
  // Drop shadow (offset down/right)
  cx.fillStyle = "rgba(0,0,0,0.35)";
  cx.beginPath();
  cx.roundRect(px - pW / 2 + 2 * S, py - pH / 2 + 2 * S, pW, pH, 2 * S);
  cx.fill();
  // Frame
  const frame = cx.createLinearGradient(0, py - pH / 2, 0, py + pH / 2);
  frame.addColorStop(0, COL.hullLite);
  frame.addColorStop(1, COL.hullDark);
  cx.fillStyle = frame;
  cx.beginPath();
  cx.roundRect(px - pW / 2, py - pH / 2, pW, pH, 2 * S);
  cx.fill();
  cx.strokeStyle = "rgba(0,0,0,0.7)";
  cx.lineWidth = 1.0 * LW;
  cx.beginPath();
  cx.roundRect(px - pW / 2, py - pH / 2, pW, pH, 2 * S);
  cx.stroke();
  // Panel surface (inset)
  const inset = 2.2 * S;
  cx.save();
  cx.beginPath();
  cx.roundRect(px - pW / 2 + inset, py - pH / 2 + inset, pW - inset * 2, pH - inset * 2, 1.2 * S);
  cx.clip();
  const pg = cx.createLinearGradient(0, py - pH / 2, 0, py + pH / 2);
  pg.addColorStop(0, COL.panelGoldL);
  pg.addColorStop(0.55, COL.panelGold);
  pg.addColorStop(1, "#3a2810");
  cx.fillStyle = pg;
  cx.fillRect(px - pW / 2, py - pH / 2, pW, pH);
  // Cell grid (cool blue lines for solar-cell wafer feel)
  cx.strokeStyle = "rgba(120,180,220,0.20)";
  cx.lineWidth = 0.5 * LW;
  for (let g = -pH / 2 + 5 * S; g < pH / 2; g += 5 * S) {
    cx.beginPath(); cx.moveTo(px - pW / 2, py + g); cx.lineTo(px + pW / 2, py + g); cx.stroke();
  }
  for (let gx = -pW / 2 + 5 * S; gx < pW / 2; gx += 5 * S) {
    cx.beginPath(); cx.moveTo(px + gx, py - pH / 2); cx.lineTo(px + gx, py + pH / 2); cx.stroke();
  }
  // Specular wash on upper half (sun catching the cells)
  const spec = cx.createLinearGradient(0, py - pH / 2, 0, py);
  spec.addColorStop(0, "rgba(255,230,180,0.18)");
  spec.addColorStop(1, "rgba(255,230,180,0)");
  cx.fillStyle = spec;
  cx.fillRect(px - pW / 2, py - pH / 2, pW, pH * 0.6);
  cx.restore();
  // Outer mounting bolts at corners
  cornerLight(cx, px - pW / 2, py - pH / 2, S, COL.hazard);
  cornerLight(cx, px + pW / 2, py - pH / 2, S, COL.hazard);
  cornerLight(cx, px - pW / 2, py + pH / 2, S, COL.cyan);
  cornerLight(cx, px + pW / 2, py + pH / 2, S, COL.cyan);
  cx.restore();
}

function drawHomeBody(cx: CanvasRenderingContext2D, half: number, st: Station) {
  const R = st.radius;
  const S = R / 55;
  const LW = 1 + (S - 1) * 0.4;
  const rng = mkRng(st.id);

  cx.save();
  cx.translate(half, half);

  // ── Solar arrays (top & bottom) drawn first so the ring/hub occlude their
  //    inner edges and bind them visually into the structure.
  {
    const pW = 36 * S, pH = 64 * S;
    for (let side = -1; side <= 1; side += 2) {
      const py = side * (R * 0.7 + pH / 2 + 4 * S);
      drawSolarArray(cx, 0, py, pW, pH, S, LW);
    }
    // Continuous structural spine — same colour as hull so the panels read as
    // attached to the body, not floating discs.
    cx.fillStyle = COL.hullMid;
    cx.fillRect(-3 * S, -(R * 0.7 + 8 * S), 6 * S, 2 * (R * 0.7 + 8 * S));
    cx.strokeStyle = "rgba(0,0,0,0.6)";
    cx.lineWidth = 0.8 * LW;
    cx.strokeRect(-3 * S, -(R * 0.7 + 8 * S), 6 * S, 2 * (R * 0.7 + 8 * S));
    // Highlight on left face of the spine (consistent lighting direction)
    cx.fillStyle = "rgba(220,230,240,0.10)";
    cx.fillRect(-3 * S, -(R * 0.7 + 8 * S), 1.2 * S, 2 * (R * 0.7 + 8 * S));
  }

  // ── Outer torus ring — habitation segments, not a smooth donut.
  {
    const ringR = R * 1.55;
    const ringW = 24 * S;
    // Soft outer drop shadow so the ring sits over space, not into it.
    cx.save();
    cx.shadowColor = "rgba(0,0,0,0.55)";
    cx.shadowBlur = 6;
    cx.beginPath(); cx.arc(0, 0, ringR, 0, TAU);
    cx.lineWidth = ringW;
    cx.strokeStyle = COL.hullMid;
    cx.stroke();
    cx.restore();
    // Bevel: dark inner, light outer (cylinder cross-section)
    const rg = cx.createRadialGradient(0, 0, ringR - ringW / 2, 0, 0, ringR + ringW / 2);
    rg.addColorStop(0.00, COL.hullDark);
    rg.addColorStop(0.20, COL.hullMid);
    rg.addColorStop(0.50, COL.hullLite);
    rg.addColorStop(0.80, COL.hullMid);
    rg.addColorStop(1.00, COL.hullDark);
    cx.beginPath(); cx.arc(0, 0, ringR, 0, TAU);
    cx.lineWidth = ringW;
    cx.strokeStyle = rg;
    cx.stroke();
    // Top-half rim highlight (top-down lighting)
    cx.strokeStyle = "rgba(180,200,220,0.40)";
    cx.lineWidth = 1.4 * LW;
    cx.beginPath(); cx.arc(0, 0, ringR + ringW / 2 - 1.2 * S, Math.PI * 1.05, Math.PI * 1.95);
    cx.stroke();
    // Bottom-half AO
    cx.strokeStyle = "rgba(0,0,0,0.55)";
    cx.lineWidth = 1.6 * LW;
    cx.beginPath(); cx.arc(0, 0, ringR + ringW / 2 - 1.2 * S, Math.PI * 0.05, Math.PI * 0.95);
    cx.stroke();
    // Inner dark seam
    cx.strokeStyle = "rgba(0,0,0,0.55)";
    cx.lineWidth = 1.4 * LW;
    cx.beginPath(); cx.arc(0, 0, ringR - ringW / 2 + 1.4 * S, 0, TAU);
    cx.stroke();
  }

  // ── Habitation segments along the ring: large viewports lit warm amber.
  {
    const segR = R * 1.55;
    const segCount = 8;
    for (let i = 0; i < segCount; i++) {
      const aMid = (i / segCount) * TAU;
      const span = (TAU / segCount) * 0.65;
      const a0 = aMid - span / 2;
      const a1 = aMid + span / 2;
      // Bulkhead lines bookending each habitation segment
      for (const a of [a0, a1]) {
        cx.strokeStyle = "rgba(0,0,0,0.7)";
        cx.lineWidth = 1.6 * LW;
        cx.beginPath();
        cx.moveTo(Math.cos(a) * (segR - 12 * S), Math.sin(a) * (segR - 12 * S));
        cx.lineTo(Math.cos(a) * (segR + 12 * S), Math.sin(a) * (segR + 12 * S));
        cx.stroke();
        cx.strokeStyle = "rgba(220,230,240,0.18)";
        cx.lineWidth = 0.5 * LW;
        cx.beginPath();
        cx.moveTo(Math.cos(a) * (segR - 11 * S), Math.sin(a) * (segR - 11 * S));
        cx.lineTo(Math.cos(a) * (segR + 11 * S), Math.sin(a) * (segR + 11 * S));
        cx.stroke();
      }
      // Window strip — lit warm amber, slightly inset toward the inner edge
      const winR = segR - 1.5 * S;
      const wA0 = aMid - span * 0.36;
      const wA1 = aMid + span * 0.36;
      cx.strokeStyle = `rgba(${COL.amber},0.85)`;
      cx.lineWidth = 3.2 * S;
      cx.lineCap = "round";
      cx.beginPath();
      cx.arc(0, 0, winR, wA0, wA1);
      cx.stroke();
      cx.lineCap = "butt";
      // Soft glow halo over the window strip
      cx.strokeStyle = `rgba(${COL.amberSoft},0.18)`;
      cx.lineWidth = 6 * S;
      cx.beginPath();
      cx.arc(0, 0, winR, wA0, wA1);
      cx.stroke();
      // Hazard beacon on the OUTER edge between segments
      const lx = Math.cos(a1) * (segR + 11 * S);
      const ly = Math.sin(a1) * (segR + 11 * S);
      cornerLight(cx, lx, ly, S, COL.hazard);
    }
  }

  // ── Truss spokes connecting hub to ring (wider at hub, narrower at ring).
  {
    const hubR = R * 0.6;
    const ringInner = R * 1.55 - 12 * S;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 4;  // 45° offset so spokes don't align with cardinal segments
      const c = Math.cos(a), s = Math.sin(a);
      const perpC = -s, perpS = c;
      // Tapered armoured spoke as a polygon for proper width control.
      const wHub = 8 * S, wRing = 5 * S;
      const ix = c * hubR, iy = s * hubR;
      const ox = c * ringInner, oy = s * ringInner;
      // Shadow beneath
      cx.fillStyle = "rgba(0,0,0,0.5)";
      cx.beginPath();
      cx.moveTo(ix + perpC * wHub + s * S, iy + perpS * wHub - c * S * 0);
      cx.lineTo(ox + perpC * wRing + s * S, oy + perpS * wRing);
      cx.lineTo(ox - perpC * wRing + s * S, oy - perpS * wRing);
      cx.lineTo(ix - perpC * wHub + s * S, iy - perpS * wHub);
      cx.closePath();
      cx.fill();
      // Body
      const spokeGrad = cx.createLinearGradient(perpC * wHub, perpS * wHub, -perpC * wHub, -perpS * wHub);
      spokeGrad.addColorStop(0, COL.hullLite);
      spokeGrad.addColorStop(0.5, COL.hullMid);
      spokeGrad.addColorStop(1, COL.hullDark);
      cx.fillStyle = spokeGrad;
      cx.beginPath();
      cx.moveTo(ix + perpC * wHub, iy + perpS * wHub);
      cx.lineTo(ox + perpC * wRing, oy + perpS * wRing);
      cx.lineTo(ox - perpC * wRing, oy - perpS * wRing);
      cx.lineTo(ix - perpC * wHub, iy - perpS * wHub);
      cx.closePath();
      cx.fill();
      cx.strokeStyle = "rgba(0,0,0,0.7)";
      cx.lineWidth = 1.0 * LW;
      cx.stroke();
      // Centre conduit line
      cx.strokeStyle = "rgba(180,200,220,0.30)";
      cx.lineWidth = 0.6 * LW;
      cx.beginPath(); cx.moveTo(ix, iy); cx.lineTo(ox, oy); cx.stroke();
      // Docking port at outer end
      const portR = 7 * S;
      cx.fillStyle = COL.hullDark;
      cx.beginPath(); cx.arc(ox, oy, portR, 0, TAU); cx.fill();
      cx.strokeStyle = "rgba(0,0,0,0.75)";
      cx.lineWidth = 1.1 * LW;
      cx.beginPath(); cx.arc(ox, oy, portR, 0, TAU); cx.stroke();
      // Lit interior of port
      const portG = cx.createRadialGradient(ox, oy, 0, ox, oy, portR * 0.7);
      portG.addColorStop(0, `rgba(${COL.amber},0.75)`);
      portG.addColorStop(1, `rgba(${COL.amber},0)`);
      cx.fillStyle = portG;
      cx.beginPath(); cx.arc(ox, oy, portR * 0.7, 0, TAU); cx.fill();
      // Rim
      cx.strokeStyle = COL.steelRim;
      cx.lineWidth = 0.6 * LW;
      cx.beginPath(); cx.arc(ox, oy, portR - 0.4, 0, TAU); cx.stroke();
    }
  }

  // ── Central hub — three nested tiers for depth (drum + shoulder + dome).
  {
    const hubR = R * 0.62;
    // Big drop shadow under whole hub so it sits over the ring/spokes.
    cx.save();
    cx.shadowColor = "rgba(0,0,0,0.65)";
    cx.shadowBlur = 12;
    cx.fillStyle = COL.hullDark;
    cx.beginPath(); cx.arc(0, 0, hubR, 0, TAU); cx.fill();
    cx.restore();

    drawHullDisc(cx, hubR);

    // Shoulder ring (slightly smaller, raised inward)
    cx.save();
    cx.translate(0, -1 * S);
    drawHullDisc(cx, hubR * 0.78);
    cx.restore();

    // Hangar bays on either side of the hub equator
    for (let i = 0; i < 2; i++) {
      const a = i === 0 ? 0 : Math.PI;
      const hX = Math.cos(a) * hubR * 0.72;
      const hY = Math.sin(a) * hubR * 0.72;
      drawHangar(cx, hX, hY, a, 18 * S, 28 * S, S, LW);
    }

    // Greebles on shoulder
    drawGreebles(cx, rng, hubR * 0.78, S, LW);

    // Inner dome
    cx.save();
    cx.translate(0, -2 * S);
    drawHullDisc(cx, hubR * 0.46);
    cx.restore();

    // Top dome with warm core-light pip
    cx.save();
    cx.translate(0, -3 * S);
    drawHullDisc(cx, hubR * 0.22);
    const core = cx.createRadialGradient(0, 0, 0, 0, 0, hubR * 0.18);
    core.addColorStop(0.0, `rgba(${COL.amberSoft},0.85)`);
    core.addColorStop(0.6, `rgba(${COL.amber},0.30)`);
    core.addColorStop(1.0, "rgba(0,0,0,0)");
    cx.fillStyle = core;
    cx.beginPath(); cx.arc(0, 0, hubR * 0.18, 0, TAU); cx.fill();
    cx.restore();
  }

  cx.restore();
}

function drawGenericBody(cx: CanvasRenderingContext2D, half: number, st: Station) {
  const R = st.radius;
  const S = R / 36;
  const LW = 1 + (S - 1) * 0.4;
  const rng = mkRng(st.id);

  cx.save();
  cx.translate(half, half);

  // Solar array (top) — same warm gold style as home, single panel
  {
    const pW = 30 * S, pH = 46 * S;
    const py = -(R * 0.52 + pH / 2 + 4 * S);
    drawSolarArray(cx, 0, py, pW, pH, S, LW);
    // Hull-coloured strut binding the panel to the hub
    cx.fillStyle = COL.hullMid;
    cx.fillRect(-2.5 * S, py + pH / 2 - 2 * S, 5 * S, (R * 0.52) - (py + pH / 2 - 2 * S));
    cx.strokeStyle = "rgba(0,0,0,0.7)";
    cx.lineWidth = 0.7 * LW;
    cx.strokeRect(-2.5 * S, py + pH / 2 - 2 * S, 5 * S, (R * 0.52) - (py + pH / 2 - 2 * S));
  }

  // Docking arms — drawn first (under the hub) so the hub overlaps them.
  {
    const armLen = R * 1.35;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 4;
      const c = Math.cos(a), s = Math.sin(a);
      const perpC = -s, perpS = c;
      const wHub = 5 * S, wTip = 3 * S;
      const ix = c * R * 0.5, iy = s * R * 0.5;
      const ox = c * armLen, oy = s * armLen;
      // Shadow
      cx.fillStyle = "rgba(0,0,0,0.45)";
      cx.beginPath();
      cx.moveTo(ix + perpC * wHub + s * S, iy + perpS * wHub);
      cx.lineTo(ox + perpC * wTip + s * S, oy + perpS * wTip);
      cx.lineTo(ox - perpC * wTip + s * S, oy - perpS * wTip);
      cx.lineTo(ix - perpC * wHub + s * S, iy - perpS * wHub);
      cx.closePath();
      cx.fill();
      // Body (tapered)
      const grad = cx.createLinearGradient(perpC * wHub, perpS * wHub, -perpC * wHub, -perpS * wHub);
      grad.addColorStop(0, COL.hullLite);
      grad.addColorStop(0.5, COL.hullMid);
      grad.addColorStop(1, COL.hullDark);
      cx.fillStyle = grad;
      cx.beginPath();
      cx.moveTo(ix + perpC * wHub, iy + perpS * wHub);
      cx.lineTo(ox + perpC * wTip, oy + perpS * wTip);
      cx.lineTo(ox - perpC * wTip, oy - perpS * wTip);
      cx.lineTo(ix - perpC * wHub, iy - perpS * wHub);
      cx.closePath();
      cx.fill();
      cx.strokeStyle = "rgba(0,0,0,0.65)";
      cx.lineWidth = 0.9 * LW;
      cx.stroke();
      // Docking port
      cx.fillStyle = COL.hullDark;
      cx.beginPath(); cx.arc(ox, oy, 5 * S, 0, TAU); cx.fill();
      cx.strokeStyle = "rgba(0,0,0,0.7)";
      cx.lineWidth = 0.9 * LW;
      cx.beginPath(); cx.arc(ox, oy, 5 * S, 0, TAU); cx.stroke();
      const portG = cx.createRadialGradient(ox, oy, 0, ox, oy, 4 * S);
      portG.addColorStop(0, `rgba(${COL.amber},0.7)`);
      portG.addColorStop(1, `rgba(${COL.amber},0)`);
      cx.fillStyle = portG;
      cx.beginPath(); cx.arc(ox, oy, 4 * S, 0, TAU); cx.fill();
      // Tip approach light
      cornerLight(cx, ox + c * 4 * S, oy + s * 4 * S, S, "120,255,120");
    }
  }

  // Outer collar ring — thinner than home, same bevel style
  {
    const ringR = R * 1.05;
    const ringW = 12 * S;
    const rg = cx.createRadialGradient(0, 0, ringR - ringW / 2, 0, 0, ringR + ringW / 2);
    rg.addColorStop(0.00, COL.hullDark);
    rg.addColorStop(0.30, COL.hullMid);
    rg.addColorStop(0.55, COL.hullLite);
    rg.addColorStop(0.80, COL.hullMid);
    rg.addColorStop(1.00, COL.hullDark);
    cx.beginPath(); cx.arc(0, 0, ringR, 0, TAU);
    cx.lineWidth = ringW;
    cx.strokeStyle = rg;
    cx.stroke();
    // Top rim highlight
    cx.strokeStyle = "rgba(180,200,220,0.32)";
    cx.lineWidth = 1.0 * LW;
    cx.beginPath(); cx.arc(0, 0, ringR + ringW / 2 - 1 * S, Math.PI * 1.05, Math.PI * 1.95);
    cx.stroke();
    // Periodic warm window slits + nav lights along the ring
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const slitA = a - 0.04;
      const slitB = a + 0.04;
      cx.strokeStyle = `rgba(${COL.amber},0.75)`;
      cx.lineWidth = 1.6 * S;
      cx.lineCap = "round";
      cx.beginPath(); cx.arc(0, 0, ringR, slitA, slitB); cx.stroke();
      cx.lineCap = "butt";
      // Nav light every other segment
      if (i % 2 === 0) {
        cornerLight(cx, Math.cos(a) * (ringR + ringW / 2 + 1 * S), Math.sin(a) * (ringR + ringW / 2 + 1 * S), S, COL.cyan);
      }
    }
  }

  // Central hub — drum with hangar bay and amber core pip
  {
    const hubR = R * 0.52;
    // Drop shadow
    cx.save();
    cx.shadowColor = "rgba(0,0,0,0.65)";
    cx.shadowBlur = 10;
    cx.fillStyle = COL.hullDark;
    cx.beginPath(); cx.arc(0, 0, hubR, 0, TAU); cx.fill();
    cx.restore();

    drawHullDisc(cx, hubR);
    cx.save();
    cx.translate(0, -1 * S);
    drawHullDisc(cx, hubR * 0.7);
    cx.restore();

    drawGreebles(cx, rng, hubR, S, LW);
    drawHangar(cx, hubR * 0.32, 0, 0, 14 * S, 16 * S, S, LW);

    // Core pip
    const core = cx.createRadialGradient(0, -2 * S, 0, 0, -2 * S, hubR * 0.18);
    core.addColorStop(0.0, `rgba(${COL.amberSoft},0.85)`);
    core.addColorStop(0.6, `rgba(${COL.amber},0.30)`);
    core.addColorStop(1.0, "rgba(0,0,0,0)");
    cx.fillStyle = core;
    cx.beginPath(); cx.arc(0, -2 * S, hubR * 0.18, 0, TAU); cx.fill();
  }

  cx.restore();
}

function drawGreebles(cx: CanvasRenderingContext2D, rng: () => number, R: number, S: number, LW: number) {
  const count = 10 + ri(rng, 0, 10);
  for (let i = 0; i < count; i++) {
    const a = rng() * TAU;
    const dist = rf(rng, R * 0.35, R * 0.85);
    const w = rf(rng, 4, 12) * S;
    const h = rf(rng, 4, 12) * S;
    cx.save();
    cx.translate(Math.cos(a) * dist, Math.sin(a) * dist);
    cx.rotate(a + Math.PI / 2);
    // Two-tone metal box (matches hull palette)
    const grad = cx.createLinearGradient(0, -h / 2, 0, h / 2);
    grad.addColorStop(0, COL.hullLite);
    grad.addColorStop(1, COL.hullDark);
    cx.fillStyle = grad;
    cx.fillRect(-w / 2, -h / 2, w, h);
    cx.strokeStyle = "rgba(0,0,0,0.65)";
    cx.lineWidth = 0.5 * LW;
    cx.strokeRect(-w / 2, -h / 2, w, h);
    cx.restore();
  }
}

function drawHangar(cx: CanvasRenderingContext2D, x: number, y: number, angle: number, w: number, h: number, S: number, LW: number) {
  cx.save();
  cx.translate(x, y);
  cx.rotate(angle);
  // Dark recessed bay frame
  cx.fillStyle = "#0a0c10";
  cx.fillRect(-w / 2, -h / 2, w, h);
  // Warm interior glow leaking out (sodium amber instead of green)
  const g = cx.createLinearGradient(0, -h / 2, 0, h / 2);
  g.addColorStop(0, "rgba(0,0,0,0.85)");
  g.addColorStop(0.5, `rgba(${COL.amber},0.16)`);
  g.addColorStop(1, "rgba(0,0,0,0.85)");
  cx.fillStyle = g;
  cx.fillRect(-w / 2, -h / 2, w, h);
  // Approach-strip lights along each side (kept teal-green for nav contrast)
  cx.fillStyle = "rgba(120,255,180,0.7)";
  for (let i = -1; i <= 1; i += 2) {
    const lx = i * (w / 2 - 1.6 * S);
    for (let j = 0; j < 4; j++) {
      const ly = -h / 2 + (j + 0.5) * (h / 4);
      cx.beginPath(); cx.arc(lx, ly, 0.9 * S, 0, TAU); cx.fill();
    }
  }
  // Frame edge
  cx.strokeStyle = "rgba(0,0,0,0.75)";
  cx.lineWidth = 1 * LW;
  cx.strokeRect(-w / 2, -h / 2, w, h);
  cx.strokeStyle = COL.steelRim;
  cx.lineWidth = 0.5 * LW;
  cx.strokeRect(-w / 2 + 0.4, -h / 2 + 0.4, w - 0.8, h - 0.8);
  cx.restore();
}

function cornerLight(cx: CanvasRenderingContext2D, x: number, y: number, S: number, rgb = "255,80,80") {
  const halo = cx.createRadialGradient(x, y, 0, x, y, 3.5 * S);
  halo.addColorStop(0, `rgba(${rgb},0.7)`);
  halo.addColorStop(1, `rgba(${rgb},0)`);
  cx.fillStyle = halo;
  cx.beginPath(); cx.arc(x, y, 3.5 * S, 0, TAU); cx.fill();
  cx.fillStyle = `rgba(${rgb},0.95)`;
  cx.beginPath(); cx.arc(x, y, 1.1 * S, 0, TAU); cx.fill();
}

function drawIndustrialHub(cx: CanvasRenderingContext2D, half: number, st: Station) {
  const R = st.radius;
  const S = R / 36;
  const LW = 1 + (S - 1) * 0.4;
  const rng = mkRng(st.id);

  cx.save();
  cx.translate(half, half);

  // Base disc — same hull palette
  drawHullDisc(cx, R * 0.82);

  // Outer processing ring — rusty-orange heat tint
  {
    const ringR = R * 1.0;
    const ringW = 10 * S;
    const rg = cx.createRadialGradient(0, 0, ringR - ringW / 2, 0, 0, ringR + ringW / 2);
    rg.addColorStop(0.00, COL.hullDark);
    rg.addColorStop(0.35, "#3a2810");
    rg.addColorStop(0.65, "#5c3a14");
    rg.addColorStop(1.00, COL.hullDark);
    cx.fillStyle = rg;
    cx.beginPath(); cx.arc(0, 0, ringR + ringW / 2, 0, TAU); cx.fill();
    cx.beginPath(); cx.arc(0, 0, ringR - ringW / 2, 0, TAU);
    cx.fillStyle = COL.hullMid; cx.fill();
    cx.strokeStyle = "rgba(0,0,0,0.7)";
    cx.lineWidth = 0.8 * LW;
    cx.beginPath(); cx.arc(0, 0, ringR + ringW / 2, 0, TAU); cx.stroke();
    cx.beginPath(); cx.arc(0, 0, ringR - ringW / 2, 0, TAU); cx.stroke();
  }

  // Four smelter towers spaced evenly around the hub
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 8;
    const c = Math.cos(a), s = Math.sin(a);
    const tx = c * R * 0.55, ty = s * R * 0.55;
    const tW = 7 * S, tH = 18 * S;

    cx.save();
    cx.translate(tx, ty);
    cx.rotate(a + Math.PI / 2);

    // Tower body
    const tg = cx.createLinearGradient(-tW / 2, 0, tW / 2, 0);
    tg.addColorStop(0, COL.hullDark);
    tg.addColorStop(0.5, COL.hullLite);
    tg.addColorStop(1, COL.hullDark);
    cx.fillStyle = tg;
    cx.fillRect(-tW / 2, -tH, tW, tH);
    cx.strokeStyle = "rgba(0,0,0,0.65)";
    cx.lineWidth = 0.8 * LW;
    cx.strokeRect(-tW / 2, -tH, tW, tH);

    // Forge glow at top of tower
    const glowR = 4.5 * S;
    const glow = cx.createRadialGradient(0, -tH, 0, 0, -tH, glowR * 2);
    glow.addColorStop(0, "rgba(255,140,30,0.85)");
    glow.addColorStop(0.5, "rgba(255,80,10,0.35)");
    glow.addColorStop(1, "rgba(200,40,0,0)");
    cx.fillStyle = glow;
    cx.beginPath(); cx.arc(0, -tH, glowR * 2, 0, TAU); cx.fill();
    cx.fillStyle = "rgba(255,200,80,0.9)";
    cx.beginPath(); cx.arc(0, -tH, glowR * 0.5, 0, TAU); cx.fill();

    cx.restore();
  }

  // Central hub core
  drawHullDisc(cx, R * 0.45);

  // Processing vents — four pairs of orange-lit slits
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    const vx = Math.cos(a) * R * 0.3, vy = Math.sin(a) * R * 0.3;
    cx.save();
    cx.translate(vx, vy);
    cx.rotate(a);
    cx.fillStyle = `rgba(${COL.amber},0.6)`;
    cx.fillRect(-5 * S, -2 * S, 10 * S, 4 * S);
    cx.strokeStyle = "rgba(0,0,0,0.5)";
    cx.lineWidth = 0.7 * LW;
    cx.strokeRect(-5 * S, -2 * S, 10 * S, 4 * S);
    cx.restore();
  }

  // Central core pip + status glow
  cx.fillStyle = "#1a1208";
  cx.beginPath(); cx.arc(0, 0, 8 * S, 0, TAU); cx.fill();
  const cg = cx.createRadialGradient(0, 0, 0, 0, 0, 7 * S);
  cg.addColorStop(0, "rgba(255,160,40,0.9)");
  cg.addColorStop(1, "rgba(255,80,0,0)");
  cx.fillStyle = cg;
  cx.beginPath(); cx.arc(0, 0, 7 * S, 0, TAU); cx.fill();

  // Greebles — random boxes at ring edge
  for (let i = 0; i < 6; i++) {
    const a = rng() * TAU;
    const dist = R * (0.88 + rng() * 0.12);
    const gx = Math.cos(a) * dist, gy = Math.sin(a) * dist;
    const gw = (3 + rng() * 4) * S, gh = (2 + rng() * 3) * S;
    cx.save();
    cx.translate(gx, gy);
    cx.rotate(a);
    cx.fillStyle = COL.hullMid;
    cx.fillRect(-gw / 2, -gh / 2, gw, gh);
    cx.strokeStyle = "rgba(0,0,0,0.6)";
    cx.lineWidth = 0.6 * LW;
    cx.strokeRect(-gw / 2, -gh / 2, gw, gh);
    cx.restore();
  }

  // Hazard beacon lights at cardinal points
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    cornerLight(cx, Math.cos(a) * R * 1.05, Math.sin(a) * R * 1.05, S, COL.hazard);
  }

  cx.restore();
}

function bakeStationBody(st: Station): { tex: Texture; texSize: number } {
  const size = texSizeFor(st);
  const { c, cx, half, superscale, dpr } = makeCanvas(size);
  if (st.structureType === "industrial") drawIndustrialHub(cx, half, st);
  else if (st.isHome) drawHomeBody(cx, half, st);
  else drawGenericBody(cx, half, st);
  const mipmap = Client.settings?.mipmapping ?? true;
  return { tex: canvasToTexture(c, superscale, dpr, mipmap), texSize: size };
}

// ─── Directional light maps ───────────────────────────────────────────────────

function bakeStationLightTextures(st: Station, size: number): Texture[] {
  // Pure radial-gradient content — no fine detail — so no supersampling needed.
  // Saves ~9× memory per light tex compared to body supersampling.
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

// ─── Bundle management ───────────────────────────────────────────────────────

function createBundle(st: Station): StationBundle {
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

  return { body, light, lightTex, texSize };
}

function destroyBundle(id: string) {
  const b = _bundles.get(id);
  if (!b) return;
  stationLayer!.removeChild(b.body); b.body.destroy();
  stationLayer!.removeChild(b.light); b.light.destroy();
  for (const t of b.lightTex) t.destroy();
  _bundles.delete(id);
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function clearStationTextureCaches(): void {
  for (const id of Array.from(_bundles.keys())) destroyBundle(id);
}

export function syncPixiStations(_now: number, sys: System): void {
  if (!stationLayer) return;
  const stations: Station[] = sys?.stations ?? [];
  const sunDir = sys?.sunDir ?? 0;
  const lightOn = Client.settings?.directionalLighting !== false;

  const activeIds = new Set<string>();
  for (const st of stations) {
    activeIds.add(st.id);
    if (!_bundles.has(st.id)) _bundles.set(st.id, createBundle(st));
    const b = _bundles.get(st.id)!;
    b.body.x = st.x;
    b.body.y = st.y;
    b.body.rotation = st.spin;

    if (lightOn && b.lightTex.length) {
      // Lighting tracks world sun direction relative to the station's spin
      // so the lit edge rotates with the station body, matching ship/enemy.
      let di = Math.round(((sunDir - st.spin) / TAU) * LIGHT_DIRS) % LIGHT_DIRS;
      if (di < 0) di += LIGHT_DIRS;
      b.light.texture = b.lightTex[di];
      b.light.x = st.x;
      b.light.y = st.y;
      b.light.visible = true;
    } else {
      b.light.visible = false;
    }
  }

  // Destroy bundles for stations no longer in the active system.
  for (const id of Array.from(_bundles.keys())) {
    if (!activeIds.has(id)) destroyBundle(id);
  }
}
