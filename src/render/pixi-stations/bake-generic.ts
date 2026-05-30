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

// ─── Archetype 2: Modular Sci-Fi Research Outpost (Generic Station) ────────

export function drawGenericBody(cx: CanvasRenderingContext2D, half: number, st: Station) {
  const R = st.radius;
  const S = R / 38;
  const LW = 1 + (S - 1) * 0.4;
  const rng = mkRng(st.id);

  cx.save();
  cx.translate(half, half);

  // 1. Giant Asymmetrical High-Performance Solar Collector Wing (Left/Top)
  {
    const pW = 28 * S, pH = 50 * S;
    const py = -(R * 0.55 + pH / 2 + 5 * S);
    // Draw massive wing array
    drawSolarSail(cx, -12 * S, py, pW, pH, -0.08, S, LW);
    drawSolarSail(cx, 12 * S, py, pW, pH, 0.08, S, LW);

    // Support structural strut
    cx.fillStyle = COL.hullMid;
    cx.fillRect(-3 * S, py + pH / 2 - 2 * S, 6 * S, (R * 0.55) - (py + pH / 2 - 2 * S));
    cx.strokeStyle = "rgba(0,0,0,0.75)";
    cx.lineWidth = 0.8 * LW;
    cx.strokeRect(-3 * S, py + pH / 2 - 2 * S, 6 * S, (R * 0.55) - (py + pH / 2 - 2 * S));

    // Green dynamic energy conduits running back to main reactor
    drawEnergyConduit(cx, 0, py + 10 * S, 0, -R * 0.48, COL.green, LW);
  }

  // 2. Asymmetrical Spindly Mechanical Arms holding glowing Research Pods
  {
    const armLen = R * 1.35;
    // 3 arms spaced at 120 degrees offset
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU + Math.PI * 0.6;
      const c = Math.cos(a), s = Math.sin(a);
      const ix = c * R * 0.45, iy = s * R * 0.45;
      const ox = c * armLen, oy = s * armLen;

      // Draw mechanical skeletal latticed arm
      drawLatticeSpoke(cx, ix, iy, ox, oy, 7 * S, LW);

      // Glowing power transfer conduits in cyber emerald green
      drawEnergyConduit(cx, ix, iy, ox, oy, COL.green, LW);

      // Glowing Scientific Biosphere Pods at arm tips
      drawHabitatDome(cx, ox, oy, 8 * S, S, LW, COL.green);

      // Outer micro-navigation approach becons (green/cyan)
      cornerLight(cx, ox + c * 9 * S, oy + s * 9 * S, S, COL.green);
    }
  }

  // 3. Sleek Outer Collar Ring with neon status slits
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

    // Top rim reflection highlight
    cx.strokeStyle = "rgba(220,240,255,0.36)";
    cx.lineWidth = 1.0 * LW;
    cx.beginPath(); cx.arc(0, 0, ringR + ringW / 2 - 1.2 * S, Math.PI * 1.05, Math.PI * 1.95);
    cx.stroke();

    // Glowing technical diagnostic window channels (emerald green energy lines)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const slitA = a - 0.045;
      const slitB = a + 0.045;
      cx.strokeStyle = `rgba(${COL.green}, 0.85)`;
      cx.lineWidth = 2.0 * S;
      cx.lineCap = "round";
      cx.beginPath(); cx.arc(0, 0, ringR, slitA, slitB); cx.stroke();
      cx.lineCap = "butt";

      if (i % 2 === 0) {
        cornerLight(cx, Math.cos(a) * (ringR + ringW / 2 + 1.5 * S), Math.sin(a) * (ringR + ringW / 2 + 1.5 * S), S, COL.cyan);
      }
    }
  }

  // 4. Central Hub with detailed Hangar bay and status reactor core
  {
    const hubR = R * 0.52;
    cx.save();
    cx.shadowColor = "rgba(0,0,0,0.65)";
    cx.shadowBlur = 10;
    cx.fillStyle = COL.hullDark;
    cx.beginPath(); cx.arc(0, 0, hubR, 0, TAU); cx.fill();
    cx.restore();

    // Tier 1 base
    drawHullDisc(cx, hubR);

    // Tier 2 Command deck
    cx.save();
    cx.translate(0, -1.2 * S);
    drawHullDisc(cx, hubR * 0.72);
    cx.restore();

    // Greeble paneling details
    drawGreebles(cx, rng, hubR * 0.72, S, LW);

    // Technical hangar launch gate
    drawHangar(cx, hubR * 0.35, 0, 0, 15 * S, 18 * S, S, LW);

    // Reactor Core Status Glow (emerald central sphere)
    const core = cx.createRadialGradient(0, -2 * S, 0, 0, -2 * S, hubR * 0.22);
    core.addColorStop(0.0, `rgba(${COL.greenSoft}, 0.95)`);
    core.addColorStop(0.5, `rgba(${COL.green}, 0.45)`);
    core.addColorStop(1.0, "rgba(0,0,0,0)");
    cx.fillStyle = core;
    cx.beginPath(); cx.arc(0, -2 * S, hubR * 0.22, 0, TAU); cx.fill();
  }

  cx.restore();
}
