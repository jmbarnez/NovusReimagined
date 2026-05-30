import { mkRng } from "../../utils/math.js";
import {
  COL,
  TAU,
  type Station,
  drawEnergyConduit,
  drawHullDisc,
  cornerLight,
} from "./shared.js";

// ─── Archetype 3: Vulkan Megastructure Forge (Industrial Hub) ──────────────

export function drawIndustrialHub(cx: CanvasRenderingContext2D, half: number, st: Station) {
  const R = st.radius;
  const S = R / 38;
  const LW = 1 + (S - 1) * 0.4;
  const rng = mkRng(st.id);

  cx.save();
  cx.translate(half, half);

  // 1. Heavy Industrial Base Plate
  drawHullDisc(cx, R * 0.85);

  // Structural panel lines crossing the industrial disc
  cx.strokeStyle = "rgba(0,0,0,0.5)";
  cx.lineWidth = 1.5 * LW;
  cx.beginPath();
  cx.moveTo(-R * 0.8, 0); cx.lineTo(R * 0.8, 0);
  cx.moveTo(0, -R * 0.8); cx.lineTo(0, R * 0.8);
  cx.stroke();

  // 2. Giant Heat Sink Fins (Copper plated radiation grids)
  {
    const ringR = R * 1.02;
    const ringW = 10 * S;

    // Bronze-copper temperature tint radial profile
    const rg = cx.createRadialGradient(0, 0, ringR - ringW / 2, 0, 0, ringR + ringW / 2);
    rg.addColorStop(0.00, COL.hullDark);
    rg.addColorStop(0.35, COL.copperDark);
    rg.addColorStop(0.70, COL.copperMid);
    rg.addColorStop(1.00, COL.hullDark);
    cx.fillStyle = rg;
    cx.beginPath(); cx.arc(0, 0, ringR + ringW / 2, 0, TAU); cx.fill();

    // Cut octagonal mechanical profiles (heavy industry outline)
    cx.strokeStyle = "rgba(0,0,0,0.85)";
    cx.lineWidth = 1.0 * LW;
    cx.beginPath();
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * TAU;
      const rx = Math.cos(a) * (ringR + ringW / 2);
      const ry = Math.sin(a) * (ringR + ringW / 2);
      i === 0 ? cx.moveTo(rx, ry) : cx.lineTo(rx, ry);
    }
    cx.stroke();

    cx.beginPath();
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * TAU;
      const rx = Math.cos(a) * (ringR - ringW / 2);
      const ry = Math.sin(a) * (ringR - ringW / 2);
      i === 0 ? cx.moveTo(rx, ry) : cx.lineTo(rx, ry);
    }
    cx.fillStyle = COL.hullMid; cx.fill();
    cx.stroke();
  }

  // 3. Four Heavy Smelting Chimney Towers (molten lava thermite pipes)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 8;
    const c = Math.cos(a), s = Math.sin(a);
    const tx = c * R * 0.58, ty = s * R * 0.58;
    const tW = 8 * S, tH = 22 * S;

    cx.save();
    cx.translate(tx, ty);
    cx.rotate(a + Math.PI / 2);

    // Structural tower core
    const tg = cx.createLinearGradient(-tW / 2, 0, tW / 2, 0);
    tg.addColorStop(0, COL.copperDark);
    tg.addColorStop(0.45, COL.copperLite);
    tg.addColorStop(0.55, COL.copperGold);
    tg.addColorStop(1, COL.copperDark);
    cx.fillStyle = tg;
    cx.fillRect(-tW / 2, -tH, tW, tH);

    cx.strokeStyle = "rgba(0,0,0,0.85)";
    cx.lineWidth = 0.8 * LW;
    cx.strokeRect(-tW / 2, -tH, tW, tH);

    // Hazard warning stripes near cooling grids
    cx.fillStyle = "#ffcc00";
    cx.fillRect(-tW / 2 + 0.5, -tH * 0.45, tW - 1.0, tH * 0.15);
    cx.fillStyle = "#111111";
    cx.lineWidth = 1.0 * S;
    for (let sx = -tW / 2 + 1 * S; sx < tW / 2; sx += 3 * S) {
      cx.beginPath();
      cx.moveTo(sx, -tH * 0.45);
      cx.lineTo(sx + 1.5 * S, -tH * 0.3);
      cx.stroke();
    }

    // High-heat magma forge glow spilling from tower cap
    const glowR = 5.0 * S;
    const glow = cx.createRadialGradient(0, -tH, 0, 0, -tH, glowR * 2.2);
    glow.addColorStop(0.0, "rgba(255,180,40,0.95)");
    glow.addColorStop(0.45, "rgba(255,80,10,0.55)");
    glow.addColorStop(0.85, "rgba(180,20,0,0.18)");
    glow.addColorStop(1.0, "rgba(0,0,0,0)");
    cx.fillStyle = glow;
    cx.beginPath(); cx.arc(0, -tH, glowR * 2.2, 0, TAU); cx.fill();

    cx.fillStyle = "rgba(255,235,160,0.98)";
    cx.beginPath(); cx.arc(0, -tH, glowR * 0.6, 0, TAU); cx.fill();

    cx.restore();

    // Hot plasma pipeline channels flowing from core to the smelter towers
    drawEnergyConduit(cx, 0, 0, tx, ty, COL.amber, LW);
  }

  // 4. Central Smelter Furnace Core Reactor
  drawHullDisc(cx, R * 0.45);

  // Core status temperature vents (highly saturated orange-red heat slits)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    const vx = Math.cos(a) * R * 0.28, vy = Math.sin(a) * R * 0.28;
    cx.save();
    cx.translate(vx, vy);
    cx.rotate(a);

    // Glowing forge grate
    cx.fillStyle = `rgba(${COL.amber}, 0.85)`;
    cx.fillRect(-6 * S, -2.5 * S, 12 * S, 5 * S);

    cx.strokeStyle = "rgba(0,0,0,0.85)";
    cx.lineWidth = 0.8 * LW;
    cx.strokeRect(-6 * S, -2.5 * S, 12 * S, 5 * S);

    // Grate division ribs
    cx.strokeStyle = "#150a00";
    cx.lineWidth = 1.0 * S;
    cx.beginPath();
    cx.moveTo(-2 * S, -2.5 * S); cx.lineTo(-2 * S, 2.5 * S);
    cx.moveTo(2 * S, -2.5 * S); cx.lineTo(2 * S, 2.5 * S);
    cx.stroke();

    cx.restore();
  }

  // Intense central magma pool
  cx.fillStyle = "#1e0b00";
  cx.beginPath(); cx.arc(0, 0, 9 * S, 0, TAU); cx.fill();

  const cg = cx.createRadialGradient(-2 * S, -2 * S, 0, 0, 0, 8 * S);
  cg.addColorStop(0.0, "rgba(255,230,120,0.98)");
  cg.addColorStop(0.45, "rgba(255,120,10,0.85)");
  cg.addColorStop(1.0, "rgba(180,0,0,0)");
  cx.fillStyle = cg;
  cx.beginPath(); cx.arc(0, 0, 8 * S, 0, TAU); cx.fill();

  // Heavy steel ring guard over magma pool
  cx.strokeStyle = "rgba(0,0,0,0.9)";
  cx.lineWidth = 1.5 * LW;
  cx.beginPath(); cx.arc(0, 0, 8 * S, 0, TAU); cx.stroke();

  // Plated storage containers (cargo greebles with hazard stripes)
  for (let i = 0; i < 7; i++) {
    const a = rng() * TAU;
    const dist = R * (0.88 + rng() * 0.12);
    const gx = Math.cos(a) * dist, gy = Math.sin(a) * dist;
    const gw = (4 + rng() * 5) * S, gh = (3 + rng() * 4) * S;
    cx.save();
    cx.translate(gx, gy);
    cx.rotate(a);

    // Rusted iron container
    cx.fillStyle = COL.copperMid;
    cx.fillRect(-gw / 2, -gh / 2, gw, gh);

    cx.strokeStyle = "rgba(0,0,0,0.85)";
    cx.lineWidth = 0.6 * LW;
    cx.strokeRect(-gw / 2, -gh / 2, gw, gh);

    // Tiny hazard strip overlay
    cx.fillStyle = "#ffaa00";
    cx.fillRect(-gw / 2, -gh / 2, gw, 1.2 * S);
    cx.fillStyle = "#000000";
    cx.fillRect(-gw / 2 + 1.2 * S, -gh / 2, 1.0 * S, 1.2 * S);
    cx.restore();
  }

  // Industrial emergency strobe warning lights (flashing hazard red)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    cornerLight(cx, Math.cos(a) * R * 1.06, Math.sin(a) * R * 1.06, S, COL.hazard);
  }

  cx.restore();
}
