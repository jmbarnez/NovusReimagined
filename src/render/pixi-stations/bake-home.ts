import { mkRng } from "../../utils/math.js";
import {
  COL,
  TAU,
  type Station,
  drawEnergyConduit,
  drawGreebles,
  drawHabitatDome,
  drawHangar,
  drawHullDisc,
  drawLatticeSpoke,
  drawSolarSail,
  cornerLight,
} from "./shared.js";

// ─── Archetype 1: Genesis Torus Prime (Home Station) ──────────────────────

export function drawHomeBody(cx: CanvasRenderingContext2D, half: number, st: Station) {
  const R = st.radius;
  const S = R / 55;
  const LW = 1 + (S - 1) * 0.4;
  const rng = mkRng(st.id);

  cx.save();
  cx.translate(half, half);

  // 1. Massive Triple-Jointed Crystalline Solar Wings (drawn first so torus overlaps inner mount)
  {
    const pW = 34 * S, pH = 55 * S;
    for (let side = -1; side <= 1; side += 2) {
      const py = side * (R * 0.72 + pH / 2 + 6 * S);
      // Double solar array per side (side by side mechanical wings)
      drawSolarSail(cx, -16 * S, py, pW, pH, 0, S, LW);
      drawSolarSail(cx, 16 * S, py, pW, pH, 0, S, LW);

      // Detailed mechanical support frame linking panels to spine
      cx.fillStyle = COL.hullMid;
      cx.fillRect(-22 * S, py - 4 * S, 44 * S, 8 * S);
      cx.strokeStyle = "rgba(0,0,0,0.8)";
      cx.lineWidth = 0.8 * LW;
      cx.strokeRect(-22 * S, py - 4 * S, 44 * S, 8 * S);
    }

    // Heavy central reactor support structural spine
    cx.fillStyle = COL.hullMid;
    cx.fillRect(-4.5 * S, -(R * 0.78 + 8 * S), 9 * S, 2 * (R * 0.78 + 8 * S));
    cx.strokeStyle = "rgba(0,0,0,0.72)";
    cx.lineWidth = 1.0 * LW;
    cx.strokeRect(-4.5 * S, -(R * 0.78 + 8 * S), 9 * S, 2 * (R * 0.78 + 8 * S));

    // Specular steel reflection on left side of spine
    cx.fillStyle = "rgba(255,255,255,0.12)";
    cx.fillRect(-4.5 * S, -(R * 0.78 + 8 * S), 1.6 * S, 2 * (R * 0.78 + 8 * S));

    // Pulsing power conduits flowing along the spine in cyber cyan
    drawEnergyConduit(cx, 0, -(R * 0.72), 0, R * 0.72, COL.cyan, LW);
  }

  // 2. Outer Torus Ring - Heavy Metropolis Plated Torus Segment Array
  {
    const ringR = R * 1.55;
    const ringW = 24 * S;

    // Drop shadow
    cx.save();
    cx.shadowColor = "rgba(0,0,0,0.65)";
    cx.shadowBlur = 8;
    cx.beginPath(); cx.arc(0, 0, ringR, 0, TAU);
    cx.lineWidth = ringW;
    cx.strokeStyle = COL.hullDark;
    cx.stroke();
    cx.restore();

    // Volume shading (cylinder radial gradient profile)
    const rg = cx.createRadialGradient(0, 0, ringR - ringW / 2, 0, 0, ringR + ringW / 2);
    rg.addColorStop(0.00, COL.hullDark);
    rg.addColorStop(0.22, COL.hullMid);
    rg.addColorStop(0.50, COL.hullLite);
    rg.addColorStop(0.78, COL.hullMid);
    rg.addColorStop(1.00, COL.hullDark);
    cx.beginPath(); cx.arc(0, 0, ringR, 0, TAU);
    cx.lineWidth = ringW;
    cx.strokeStyle = rg;
    cx.stroke();

    // Upper hemispherical light reflect highlight
    cx.strokeStyle = "rgba(220,240,255,0.45)";
    cx.lineWidth = 1.6 * LW;
    cx.beginPath(); cx.arc(0, 0, ringR + ringW / 2 - 1.5 * S, Math.PI * 1.05, Math.PI * 1.95);
    cx.stroke();

    // Bottom occlusion shadow
    cx.strokeStyle = "rgba(0,0,0,0.65)";
    cx.lineWidth = 1.8 * LW;
    cx.beginPath(); cx.arc(0, 0, ringR + ringW / 2 - 1.5 * S, Math.PI * 0.05, Math.PI * 0.95);
    cx.stroke();

    // Sharp inner groove line
    cx.strokeStyle = "rgba(0,0,0,0.72)";
    cx.lineWidth = 1.4 * LW;
    cx.beginPath(); cx.arc(0, 0, ringR - ringW / 2 + 1.6 * S, 0, TAU);
    cx.stroke();
  }

  // 3. Metropolis Segments & Botanical Glass Domes on Torus
  {
    const segR = R * 1.55;
    const segCount = 8;
    for (let i = 0; i < segCount; i++) {
      const aMid = (i / segCount) * TAU;
      const span = (TAU / segCount) * 0.65;
      const a0 = aMid - span / 2;
      const a1 = aMid + span / 2;

      // Heavy interlocking mechanical bulkheads bookending each segment
      for (const a of [a0, a1]) {
        cx.strokeStyle = "rgba(0,0,0,0.85)";
        cx.lineWidth = 2.0 * LW;
        cx.beginPath();
        cx.moveTo(Math.cos(a) * (segR - 13 * S), Math.sin(a) * (segR - 13 * S));
        cx.lineTo(Math.cos(a) * (segR + 13 * S), Math.sin(a) * (segR + 13 * S));
        cx.stroke();

        cx.strokeStyle = COL.steelRim;
        cx.lineWidth = 0.7 * LW;
        cx.beginPath();
        cx.moveTo(Math.cos(a) * (segR - 12 * S), Math.sin(a) * (segR - 12 * S));
        cx.lineTo(Math.cos(a) * (segR + 12 * S), Math.sin(a) * (segR + 12 * S));
        cx.stroke();
      }

      // Alternate between Botanical Biosphere Domes and Residential Plated Windows
      if (i % 2 === 0) {
        // Glowing Botanical Domes! (Green life support biospheres)
        const lx = Math.cos(aMid) * segR;
        const ly = Math.sin(aMid) * segR;
        drawHabitatDome(cx, lx, ly, 7.5 * S, S, LW, COL.green);
      } else {
        // Highly dense residential windows - warm sodium amber glow
        const winR = segR - 1.2 * S;
        const wA0 = aMid - span * 0.38;
        const wA1 = aMid + span * 0.38;
        cx.strokeStyle = `rgba(${COL.amber}, 0.95)`;
        cx.lineWidth = 3.6 * S;
        cx.lineCap = "round";
        cx.beginPath();
        cx.arc(0, 0, winR, wA0, wA1);
        cx.stroke();
        cx.lineCap = "butt";

        // Specular atmospheric reflection overlay over window clusters
        cx.strokeStyle = "rgba(255,255,255,0.22)";
        cx.lineWidth = 1.0 * S;
        cx.beginPath();
        cx.arc(0, 0, winR + 1.8 * S, wA0, wA1);
        cx.stroke();
      }

      // Outer cyber cyan nav beacons
      const bx = Math.cos(aMid + span / 2) * (segR + 12.5 * S);
      const by = Math.sin(aMid + span / 2) * (segR + 12.5 * S);
      cornerLight(cx, bx, by, S, COL.cyan);
    }
  }

  // 4. Intricate Cross-Latticed spokes connecting hub to Torus
  {
    const hubR = R * 0.65;
    const ringInner = R * 1.55 - 12 * S;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 4;  // 45 deg offset
      const c = Math.cos(a), s = Math.sin(a);
      const ix = c * hubR, iy = s * hubR;
      const ox = c * ringInner, oy = s * ringInner;

      // Draw beautifully complex lattice space trusses
      drawLatticeSpoke(cx, ix, iy, ox, oy, 9 * S, LW);

      // Cyber energy conduits feeding power from Torus to Core Reactor
      drawEnergyConduit(cx, ix, iy, ox, oy, COL.cyan, LW);

      // Heavy modular docking gate/port at torus endpoints
      const portR = 7.5 * S;
      cx.fillStyle = COL.hullDark;
      cx.beginPath(); cx.arc(ox, oy, portR, 0, TAU); cx.fill();
      cx.strokeStyle = "rgba(0,0,0,0.85)";
      cx.lineWidth = 1.3 * LW;
      cx.beginPath(); cx.arc(ox, oy, portR, 0, TAU); cx.stroke();

      // Glowing electromagnetic latch core
      const portG = cx.createRadialGradient(ox, oy, 0, ox, oy, portR * 0.72);
      portG.addColorStop(0.0, `rgba(${COL.amberSoft}, 0.85)`);
      portG.addColorStop(0.55, `rgba(${COL.amber}, 0.35)`);
      portG.addColorStop(1.0, "rgba(0,0,0,0)");
      cx.fillStyle = portG;
      cx.beginPath(); cx.arc(ox, oy, portR * 0.72, 0, TAU); cx.fill();

      // Approach beacons on dock collar
      cornerLight(cx, ox - s * 5 * S, oy + c * 5 * S, S, COL.green);
      cornerLight(cx, ox + s * 5 * S, oy - c * 5 * S, S, COL.green);
    }
  }

  // 5. Heavy Central Hub - Tiered Command Deck & Core Fusion Reactor
  {
    const hubR = R * 0.64;

    // Drop shadow
    cx.save();
    cx.shadowColor = "rgba(0,0,0,0.7)";
    cx.shadowBlur = 14;
    cx.fillStyle = COL.hullDark;
    cx.beginPath(); cx.arc(0, 0, hubR, 0, TAU); cx.fill();
    cx.restore();

    // Tier 1 Base Platform
    drawHullDisc(cx, hubR);

    // Tier 2 Command Bridge Deck
    cx.save();
    cx.translate(0, -1.5 * S);
    drawHullDisc(cx, hubR * 0.78);
    cx.restore();

    // Equatorial high-tech landing hangars
    for (let i = 0; i < 2; i++) {
      const a = i === 0 ? 0 : Math.PI;
      const hX = Math.cos(a) * hubR * 0.74;
      const hY = Math.sin(a) * hubR * 0.74;
      drawHangar(cx, hX, hY, a, 19 * S, 29 * S, S, LW);
    }

    // Heavy plated greebling panels
    drawGreebles(cx, rng, hubR * 0.75, S, LW);

    // Tier 3 Shield Containment Wall
    cx.save();
    cx.translate(0, -2.5 * S);
    drawHullDisc(cx, hubR * 0.48);
    cx.restore();

    // Tier 4 Core Fusion Reactor - Glowing neon dome
    cx.save();
    cx.translate(0, -3.5 * S);
    const coreR = hubR * 0.25;
    drawHullDisc(cx, coreR);

    // Hyper glowing reactor plasma core
    const core = cx.createRadialGradient(-coreR * 0.15, -coreR * 0.15, 0, 0, 0, coreR * 0.85);
    core.addColorStop(0.0, `rgba(${COL.cyanSoft}, 0.98)`);
    core.addColorStop(0.45, `rgba(${COL.cyan}, 0.65)`);
    core.addColorStop(1.0, "rgba(0,40,80,0.2)");
    cx.fillStyle = core;
    cx.beginPath(); cx.arc(0, 0, coreR * 0.85, 0, TAU); cx.fill();

    // Energy field outline
    cx.strokeStyle = `rgba(${COL.cyanSoft}, 0.55)`;
    cx.lineWidth = 1.0;
    cx.beginPath(); cx.arc(0, 0, coreR * 0.85, 0, TAU); cx.stroke();
    cx.restore();
  }

  cx.restore();
}
