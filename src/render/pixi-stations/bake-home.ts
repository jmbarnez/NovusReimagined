import { mkRng } from "../../utils/math.js";
import {
  COL,
  TAU,
  type Station,
  cornerLight,
} from "./shared.js";

// ─── Archetype 1: Sleek Hub Station ──────────────────────

export function drawHomeBody(cx: CanvasRenderingContext2D, half: number, st: Station) {
  const R = st.radius;
  const S = R / 55;
  const LW = 1 + (S - 1) * 0.4;

  cx.save();
  cx.translate(half, half);

  // 1. Clean outer ring - smooth titanium torus
  {
    const ringR = R * 1.45;
    const ringW = 18 * S;

    // Soft ambient shadow
    cx.save();
    cx.shadowColor = "rgba(0,0,0,0.5)";
    cx.shadowBlur = 12;
    cx.beginPath(); cx.arc(0, 0, ringR, 0, TAU);
    cx.lineWidth = ringW;
    cx.strokeStyle = COL.hullDark;
    cx.stroke();
    cx.restore();

    // Clean metallic band
    const rg = cx.createRadialGradient(0, 0, ringR - ringW / 2, 0, 0, ringR + ringW / 2);
    rg.addColorStop(0.00, "#0d1117");
    rg.addColorStop(0.30, "#1c2128");
    rg.addColorStop(0.50, "#2a303a");
    rg.addColorStop(0.70, "#1c2128");
    rg.addColorStop(1.00, "#0d1117");
    cx.beginPath(); cx.arc(0, 0, ringR, 0, TAU);
    cx.lineWidth = ringW;
    cx.strokeStyle = rg;
    cx.stroke();

    // Single clean highlight on top arc
    cx.strokeStyle = "rgba(180,210,240,0.35)";
    cx.lineWidth = 1.2 * LW;
    cx.beginPath(); cx.arc(0, 0, ringR + ringW / 2 - 1 * S, Math.PI * 1.1, Math.PI * 1.9);
    cx.stroke();

    // Thin inner rim accent
    cx.strokeStyle = "rgba(0,0,0,0.6)";
    cx.lineWidth = 1.0 * LW;
    cx.beginPath(); cx.arc(0, 0, ringR - ringW / 2 + 1 * S, 0, TAU);
    cx.stroke();
  }

  // 2. Minimal equatorial windows - warm amber strips only
  {
    const segR = R * 1.45;
    const segCount = 6;
    for (let i = 0; i < segCount; i++) {
      const aMid = (i / segCount) * TAU;
      const span = (TAU / segCount) * 0.55;
      const wA0 = aMid - span / 2;
      const wA1 = aMid + span / 2;
      cx.strokeStyle = `rgba(${COL.amber}, 0.8)`;
      cx.lineWidth = 2.8 * S;
      cx.lineCap = "round";
      cx.beginPath();
      cx.arc(0, 0, segR, wA0, wA1);
      cx.stroke();
      cx.lineCap = "butt";
    }
  }

  // 3. Four clean support struts
  {
    const hubR = R * 0.58;
    const ringInner = R * 1.45 - 9 * S;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 4;
      const c = Math.cos(a), s = Math.sin(a);
      const ix = c * hubR, iy = s * hubR;
      const ox = c * ringInner, oy = s * ringInner;

      // Simple clean strut
      cx.strokeStyle = "#1a2028";
      cx.lineWidth = 3.5 * S;
      cx.beginPath();
      cx.moveTo(ix, iy);
      cx.lineTo(ox, oy);
      cx.stroke();

      // Subtle cyan power line inside strut
      cx.strokeStyle = `rgba(${COL.cyan}, 0.6)`;
      cx.lineWidth = 1.0 * S;
      cx.beginPath();
      cx.moveTo(ix, iy);
      cx.lineTo(ox, oy);
      cx.stroke();

      // Small dock port at ring
      const portR = 5 * S;
      cx.fillStyle = "#0a0e14";
      cx.beginPath(); cx.arc(ox, oy, portR, 0, TAU); cx.fill();
      cx.strokeStyle = "rgba(0,0,0,0.7)";
      cx.lineWidth = 1 * LW;
      cx.beginPath(); cx.arc(ox, oy, portR, 0, TAU); cx.stroke();
    }
  }

  // 4. Sleek central hub - single smooth disc with core glow
  {
    const hubR = R * 0.58;

    // Hub shadow
    cx.save();
    cx.shadowColor = "rgba(0,0,0,0.5)";
    cx.shadowBlur = 10;
    cx.fillStyle = "#0a0e14";
    cx.beginPath(); cx.arc(0, 0, hubR, 0, TAU); cx.fill();
    cx.restore();

    // Main hull disc - smooth shaded cylinder
    const hullGrad = cx.createLinearGradient(0, -hubR, 0, hubR);
    hullGrad.addColorStop(0.0, "#2a3544");
    hullGrad.addColorStop(0.45, "#1c242e");
    hullGrad.addColorStop(1.0, "#0d1218");
    cx.fillStyle = hullGrad;
    cx.beginPath(); cx.arc(0, 0, hubR, 0, TAU); cx.fill();

    // Rim outline
    cx.strokeStyle = "rgba(0,0,0,0.85)";
    cx.lineWidth = 1.3;
    cx.beginPath(); cx.arc(0, 0, hubR, 0, TAU); cx.stroke();

    // Upper rim highlight
    cx.strokeStyle = "rgba(160,190,220,0.4)";
    cx.lineWidth = 1.0;
    cx.beginPath(); cx.arc(0, 0, hubR - 0.7, Math.PI * 1.12, Math.PI * 1.88);
    cx.stroke();

    // Lower hangar slit - clean and minimal
    {
      const hW = 22 * S;
      const hH = 7 * S;
      cx.fillStyle = "#06090e";
      cx.fillRect(-hW / 2, -hH / 2, hW, hH);
      cx.strokeStyle = "rgba(0,0,0,0.8)";
      cx.lineWidth = 1;
      cx.strokeRect(-hW / 2, -hH / 2, hW, hH);
      // Faint cyan glow from hangar interior
      cx.fillStyle = `rgba(${COL.cyan}, 0.15)`;
      cx.fillRect(-hW / 2 + 2 * S, -hH / 2 + S, hW - 4 * S, hH - 2 * S);
    }

    // Core reactor - bright cyan glow, minimal
    const coreR = hubR * 0.22;
    const coreGrad = cx.createRadialGradient(-coreR * 0.1, -coreR * 0.1, 0, 0, 0, coreR * 0.9);
    coreGrad.addColorStop(0.0, `rgba(${COL.cyanSoft}, 0.95)`);
    coreGrad.addColorStop(0.5, `rgba(${COL.cyan}, 0.5)`);
    coreGrad.addColorStop(1.0, "rgba(0,30,60,0)");
    cx.fillStyle = coreGrad;
    cx.beginPath(); cx.arc(0, -1.5 * S, coreR, 0, TAU); cx.fill();

    // Core rim
    cx.strokeStyle = `rgba(${COL.cyanSoft}, 0.45)`;
    cx.lineWidth = 1.0;
    cx.beginPath(); cx.arc(0, -1.5 * S, coreR, 0, TAU); cx.stroke();
  }

  // 5. Two clean nav beacons only
  cornerLight(cx, -R * 0.55, -R * 0.55, S, COL.cyan);
  cornerLight(cx, R * 0.55, R * 0.55, S, COL.cyan);

  cx.restore();
}
