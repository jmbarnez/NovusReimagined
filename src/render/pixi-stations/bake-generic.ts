import {
  COL,
  TAU,
  type Station,
  cornerLight,
} from "./shared.js";

// ─── Archetype 2: Sleek Outpost Station ────────

export function drawGenericBody(cx: CanvasRenderingContext2D, half: number, st: Station) {
  const R = st.radius;
  const S = R / 38;
  const LW = 1 + (S - 1) * 0.4;

  cx.save();
  cx.translate(half, half);

  // 1. Clean outer ring
  {
    const ringR = R * 0.78;
    const ringW = 10 * S;

    cx.save();
    cx.shadowColor = "rgba(0,0,0,0.45)";
    cx.shadowBlur = 10;
    cx.beginPath(); cx.arc(0, 0, ringR, 0, TAU);
    cx.lineWidth = ringW;
    cx.strokeStyle = "#0d1117";
    cx.stroke();
    cx.restore();

    const rg = cx.createRadialGradient(0, 0, ringR - ringW / 2, 0, 0, ringR + ringW / 2);
    rg.addColorStop(0.00, "#0d1117");
    rg.addColorStop(0.30, "#1a2028");
    rg.addColorStop(0.50, "#2a303a");
    rg.addColorStop(0.70, "#1a2028");
    rg.addColorStop(1.00, "#0d1117");
    cx.beginPath(); cx.arc(0, 0, ringR, 0, TAU);
    cx.lineWidth = ringW;
    cx.strokeStyle = rg;
    cx.stroke();

    cx.strokeStyle = "rgba(180,210,240,0.3)";
    cx.lineWidth = 1.0 * LW;
    cx.beginPath(); cx.arc(0, 0, ringR + ringW / 2 - 0.8 * S, Math.PI * 1.1, Math.PI * 1.9);
    cx.stroke();
  }

  // 2. Minimal green status slits
  {
    const ringR = R * 0.78;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      const slitA = a - 0.04;
      const slitB = a + 0.04;
      cx.strokeStyle = `rgba(${COL.green}, 0.75)`;
      cx.lineWidth = 1.6 * S;
      cx.lineCap = "round";
      cx.beginPath(); cx.arc(0, 0, ringR, slitA, slitB); cx.stroke();
      cx.lineCap = "butt";
    }
  }

  // 3. Three clean struts
  {
    const hubR = R * 0.55;
    const ringInner = R * 0.78 - 5 * S;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU + Math.PI / 6;
      const c = Math.cos(a), s = Math.sin(a);
      const ix = c * hubR, iy = s * hubR;
      const ox = c * ringInner, oy = s * ringInner;

      cx.strokeStyle = "#1a2028";
      cx.lineWidth = 2.5 * S;
      cx.beginPath(); cx.moveTo(ix, iy); cx.lineTo(ox, oy); cx.stroke();

      cx.strokeStyle = `rgba(${COL.green}, 0.5)`;
      cx.lineWidth = 0.8 * S;
      cx.beginPath(); cx.moveTo(ix, iy); cx.lineTo(ox, oy); cx.stroke();
    }
  }

  // 4. Sleek central hub
  {
    const hubR = R * 0.55;

    cx.save();
    cx.shadowColor = "rgba(0,0,0,0.45)";
    cx.shadowBlur = 8;
    cx.fillStyle = "#0a0e14";
    cx.beginPath(); cx.arc(0, 0, hubR, 0, TAU); cx.fill();
    cx.restore();

    const hullGrad = cx.createLinearGradient(0, -hubR, 0, hubR);
    hullGrad.addColorStop(0.0, "#2a3544");
    hullGrad.addColorStop(0.45, "#1c242e");
    hullGrad.addColorStop(1.0, "#0d1218");
    cx.fillStyle = hullGrad;
    cx.beginPath(); cx.arc(0, 0, hubR, 0, TAU); cx.fill();

    cx.strokeStyle = "rgba(0,0,0,0.85)";
    cx.lineWidth = 1.2;
    cx.beginPath(); cx.arc(0, 0, hubR, 0, TAU); cx.stroke();

    cx.strokeStyle = "rgba(160,190,220,0.35)";
    cx.lineWidth = 1.0;
    cx.beginPath(); cx.arc(0, 0, hubR - 0.7, Math.PI * 1.12, Math.PI * 1.88);
    cx.stroke();

    // Hangar slit
    {
      const hW = 18 * S;
      const hH = 6 * S;
      cx.fillStyle = "#06090e";
      cx.fillRect(-hW / 2, -hH / 2, hW, hH);
      cx.strokeStyle = "rgba(0,0,0,0.8)";
      cx.lineWidth = 1;
      cx.strokeRect(-hW / 2, -hH / 2, hW, hH);
      cx.fillStyle = `rgba(${COL.green}, 0.12)`;
      cx.fillRect(-hW / 2 + 2 * S, -hH / 2 + S, hW - 4 * S, hH - 2 * S);
    }

    // Core glow
    const coreR = hubR * 0.2;
    const coreGrad = cx.createRadialGradient(0, -1.5 * S, 0, 0, -1.5 * S, coreR * 0.9);
    coreGrad.addColorStop(0.0, `rgba(${COL.greenSoft}, 0.9)`);
    coreGrad.addColorStop(0.5, `rgba(${COL.green}, 0.45)`);
    coreGrad.addColorStop(1.0, "rgba(0,30,20,0)");
    cx.fillStyle = coreGrad;
    cx.beginPath(); cx.arc(0, -1.5 * S, coreR, 0, TAU); cx.fill();

    cx.strokeStyle = `rgba(${COL.greenSoft}, 0.4)`;
    cx.lineWidth = 1.0;
    cx.beginPath(); cx.arc(0, -1.5 * S, coreR, 0, TAU); cx.stroke();
  }

  // 5. Two nav beacons
  cornerLight(cx, -R * 0.4, -R * 0.4, S, COL.cyan);
  cornerLight(cx, R * 0.4, R * 0.4, S, COL.cyan);

  cx.restore();
}
