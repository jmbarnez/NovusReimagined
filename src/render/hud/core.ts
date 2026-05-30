import { Client } from "../../state.js";
import { getState } from "../../state-access.js";
import { ctx } from "../../canvas.js";
import { TAU, HUD_MINIMAP_SIZE } from "../../constants.js";
import { getThemeColors } from "../../data/settings.js";
import { getStats } from "../../player/player-stats.js";
import { targetByLockId } from "../../targeting.js";
import { dst } from "../../utils/math.js";
import { getUIFont } from "../ui-font.js";
import { drawMinimap } from "./minimap.js";

let mmCanvas: HTMLCanvasElement | null = null;
let mmCtx: CanvasRenderingContext2D | null = null;

function ensureMinimapCanvas(): void {
  const container = document.getElementById("hud-minimap");
  if (mmCanvas && (mmCanvas.width !== HUD_MINIMAP_SIZE || mmCanvas.height !== HUD_MINIMAP_SIZE)) {
    mmCanvas = null;
    mmCtx = null;
  }
  if (!mmCanvas) {
    mmCanvas = document.createElement("canvas");
    mmCanvas.width = HUD_MINIMAP_SIZE;
    mmCanvas.height = HUD_MINIMAP_SIZE;
    mmCanvas.style.width = `${HUD_MINIMAP_SIZE}px`;
    mmCanvas.style.height = `${HUD_MINIMAP_SIZE}px`;
    mmCtx = mmCanvas.getContext("2d");
    if (container) {
      container.innerHTML = "";
      container.appendChild(mmCanvas);
    }
  }
}

export function drawHUD(Wc: number, Hc: number, now: number) {
  ensureMinimapCanvas();
  if (mmCtx) drawMinimap(mmCtx, now);

  // Draw the Central Semi-Circular Fighter HUD and Target Lead Overlay
  const state = getState();
  const player = state.player;
  if (!player) return;

  const st = getStats(player);
  const theme = getThemeColors(Client.settings?.theme || "default");
  const cx = Wc / 2;
  const cy = Hc / 2;

  const maxShield = st.maxShield || 0;
  const shieldFrac = maxShield > 0 ? (player.shield || 0) / maxShield : 0;
  const isLowShield = maxShield > 0 && shieldFrac < 0.3;
  const isLowHull = (player.hp || 0) / (st.maxHp || 1) < 0.4;
  const isLowStruct = (player.structure || 0) / (player.maxStructure || 1) < 0.6;

  // Critical warnings focus on actual physical hull and structure integrity (per user feedback)
  const isCritical = isLowHull || isLowStruct;

  // Visual dynamic reactive neon glitch jitter
  let gx = 0, gy = 0;
  if (isCritical && Math.random() < 0.22) {
    gx = (Math.random() - 0.5) * 2.5;
    gy = (Math.random() - 0.5) * 2.5;
  }

  const z = Client.zoom;

  // 1. HORIZON PITCH LINE (tilts with ship rotation, scales with zoom)
  ctx.save();
  ctx.translate(cx + gx, cy + gy);
  ctx.rotate(player.angle);
  ctx.strokeStyle = isCritical ? "rgba(238, 68, 68, 0.45)" : "rgba(158, 182, 212, 0.35)";
  ctx.lineWidth = Math.max(1, 1.2 * z);
  ctx.beginPath();
  // Left wing bracket (scaled)
  ctx.moveTo(-25 * z, 0);
  ctx.lineTo(-15 * z, 0);
  ctx.lineTo(-18 * z, 4 * z);
  // Right wing bracket (scaled)
  ctx.moveTo(15 * z, 0);
  ctx.lineTo(25 * z, 0);
  ctx.lineTo(18 * z, 4 * z);
  ctx.stroke();

  // Central tiny flight box (scaled)
  ctx.beginPath();
  ctx.rect(-3 * z, -3 * z, 6 * z, 6 * z);
  ctx.stroke();
  ctx.restore();

  // 2. CURVED STATUS ARCS (Left Speed, Right Shield - Snug around the ship, scales with zoom)
  const r = 38 * z;
  const span = 0.28 * Math.PI;

  // Speed Arc (Left)
  const speed = Math.hypot(player.vx, player.vy);
  const maxSpeed = st.maxSpeed || 1;
  const spdPct = Math.max(0, Math.min(1, speed / maxSpeed));

  const arcLineWidth = Math.max(1.5, Math.min(3, 2.0 * z));

  // Speed Track background
  ctx.save();
  ctx.strokeStyle = "rgba(45, 62, 78, 0.18)";
  ctx.lineWidth = arcLineWidth;
  ctx.beginPath();
  ctx.arc(cx + gx, cy + gy, r, Math.PI - span, Math.PI + span);
  ctx.stroke();

  // Speed active fill
  ctx.strokeStyle = isCritical ? "rgba(238, 68, 68, 0.85)" : theme.accent;
  ctx.beginPath();
  ctx.arc(cx + gx, cy + gy, r, Math.PI + span, Math.PI + span - spdPct * (span * 2), true);
  ctx.stroke();

  // Shield Arc (Right)
  if (maxShield > 0) {
    // Shield Track background
    ctx.strokeStyle = "rgba(45, 62, 78, 0.18)";
    ctx.lineWidth = arcLineWidth;
    ctx.beginPath();
    ctx.arc(cx + gx, cy + gy, r, -span, span);
    ctx.stroke();

    // Shield active fill
    ctx.strokeStyle = isLowShield || isCritical ? "rgba(238, 68, 68, 0.85)" : theme.shield;
    ctx.beginPath();
    ctx.arc(cx + gx, cy + gy, r, span, span - shieldFrac * (span * 2), true);
    ctx.stroke();
  }

  // Curved Gauges Labels & Values (Scale font size and dynamic y/x spacing with zoom)
  ctx.font = `${Math.max(7, Math.min(10, 8 * z))}px ${getUIFont()}`;
  ctx.fillStyle = isCritical ? "rgba(238, 68, 68, 0.85)" : theme.textMain;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(`${Math.round(speed)} m/s`, cx - (r + 7) + gx, cy + gy);

  if (maxShield > 0) {
    ctx.textAlign = "left";
    ctx.fillStyle = isLowShield || isCritical ? "rgba(238, 68, 68, 0.85)" : theme.textMain;
    ctx.fillText(`${Math.round(shieldFrac * 100)}% SHD`, cx + (r + 7) + gx, cy + gy);
  }
  ctx.restore();

  // Warning alarm banner (Floats dynamically above the scaled arcs)
  if (isLowStruct) {
    const alarmBlink = Math.floor(now / 150) % 2 === 0;
    if (alarmBlink) {
      ctx.save();
      ctx.font = `bold 9px ${getUIFont()}`;
      ctx.fillStyle = "rgba(255, 68, 68, 0.95)";
      ctx.textAlign = "center";
      const alarmText = "CRITICAL: STRUCTURE COMPROMISED";
      ctx.fillText(alarmText, cx, cy - (r + 20));
      ctx.restore();
    }
  }

  // 3. VELOCITY PROGRADE & RETROGRADE DRIFT VECTORS (Scale outer-anchor boundary with zoom)
  const speedMag = Math.hypot(player.vx, player.vy);
  if (speedMag > 5) {
    const vAngle = Math.atan2(player.vy, player.vx);
    const offsetDist = r + (12 + Math.min(speedMag * 0.04, 10)) * z;

    // Prograde float marker
    const px = cx + Math.cos(vAngle) * offsetDist + gx;
    const py = cy + Math.sin(vAngle) * offsetDist + gy;

    ctx.save();
    ctx.strokeStyle = isCritical ? "rgba(238, 68, 68, 0.6)" : "rgba(100, 200, 255, 0.7)";
    const mR = Math.max(1.8, Math.min(4, 2.5 * z));
    ctx.lineWidth = Math.max(1, 1.2 * z);
    ctx.beginPath();
    ctx.arc(px, py, mR, 0, TAU);
    // Fins pointing outwards
    ctx.moveTo(px - mR, py); ctx.lineTo(px - mR * 2, py);
    ctx.moveTo(px + mR, py); ctx.lineTo(px + mR * 2, py);
    ctx.moveTo(px, py - mR); ctx.lineTo(px, py - mR * 2);
    ctx.stroke();

    // Retrograde float marker
    const rx = cx - Math.cos(vAngle) * offsetDist + gx;
    const ry = cy - Math.sin(vAngle) * offsetDist + gy;
    ctx.strokeStyle = isCritical ? "rgba(238, 68, 68, 0.4)" : "rgba(150, 180, 210, 0.45)";
    ctx.beginPath();
    ctx.arc(rx, ry, mR, 0, TAU);
    // Cross lines (scaled)
    ctx.moveTo(rx - mR * 0.7, ry - mR * 0.7); ctx.lineTo(rx + mR * 0.7, ry + mR * 0.7);
    ctx.moveTo(rx - mR * 0.7, ry + mR * 0.7); ctx.lineTo(rx + mR * 0.7, ry - mR * 0.7);
    ctx.stroke();
    ctx.restore();
  }

  // 4. ACTIVE TARGET LEAD PREDICTION & COCKPIT TRACKING BRACKETS
  const primaryId = player.targetLock?.id;
  if (primaryId) {
    const target = targetByLockId(primaryId, getState().player);
    if (target && target.hp > 0) {
      // Screen space target coordinates
      const targetSx = cx + (target.x - Client.camx) * Client.zoom;
      const targetSy = cy + (target.y - Client.camy) * Client.zoom;

      // Draw target details text next to the existing world-space brackets
      const targetRad = target.radius || 18;
      const bracketOffset = (targetRad + 9) * Client.zoom;
      ctx.save();
      ctx.font = `9px ${getUIFont()}`;
      ctx.fillStyle = isCritical ? "rgba(238, 68, 68, 0.85)" : theme.textMain;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      const targetDist = Math.round(dst(player.x, player.y, target.x, target.y));
      ctx.fillText(`[${targetDist}m]`, targetSx + bracketOffset + 5, targetSy);
      ctx.restore();
    }
  }
}
