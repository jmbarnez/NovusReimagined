import { getState } from "../state-access.js";
import { Client } from "../state.js";
import { ctx, W, H } from "../canvas.js";
import { TAU, LOCK_RAIL_H, HUD_MINIMAP_SIZE, HUD_SIDE_W, HUD_BOTTOM_H, DOCK_RANGE, GATE_RANGE } from "../constants.js";
import { getThemeColors } from "../data/settings.js";
import { viewCenterX, viewCenterY } from "./viewport.js";
import { dst, mulberry32 } from "../utils/math.js";
import { curSys, liveEnemies, liveAsteroids, topHudHeight } from "../utils/game.js";
import { getStats } from "../player/player-stats.js";
import { transversalVs, enemyClassLabel, ensureLockQueue, computeLockTimeSec, targetByLockId } from "../targeting.js";
import { getUIFont } from "./ui-font.js";
import { WEAPON_PROFILES } from "../data/weaponProfiles.js";
import { getInstance } from "../utils/items.js";

let mmCanvas: HTMLCanvasElement | null = null;
let mmCtx: CanvasRenderingContext2D | null = null;

export function drawHUD(Wc: number, Hc: number, now: number) {
  if (!mmCanvas) {
    mmCanvas = document.createElement("canvas");
    mmCanvas.width = HUD_MINIMAP_SIZE;
    mmCanvas.height = HUD_MINIMAP_SIZE;
    mmCanvas.style.width = `${HUD_MINIMAP_SIZE}px`;
    mmCanvas.style.height = `${HUD_MINIMAP_SIZE}px`;
    mmCtx = mmCanvas.getContext("2d");
    const container = document.getElementById("hud-minimap");
    if (container) {
      container.innerHTML = "";
      container.appendChild(mmCanvas);
    }
  }
  if (mmCtx) drawMinimap(mmCtx, now);

  // Draw the Central Semi-Circular Fighter HUD and Target Lead Overlay
  const state = getState();
  const player = state.player;
  if (!player) return;

  const st = getStats();
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
    const target = targetByLockId(primaryId);
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

const _edges = new Float64Array(4);

export function drawTargetArrow(Wc: number, Hc: number, camxR: number, camyR: number, now: number) {
  const sys = curSys();
  const state = getState();
  const player = state.player;
  if (!player || !sys) return;
  const zoom = Client.zoom;
  const cx = viewCenterX(Wc), cy = viewCenterY(Hc);
  const mL = 30, mR = 10, mT = LOCK_RAIL_H + 10, mB = HUD_BOTTOM_H + 10;

  // Returns screen-edge position for a world point, or null if on-screen.
  function edgePos(wx: number, wy: number): [number, number, number] | null {
    const sx = cx + (wx - camxR) * zoom;
    const sy = cy + (wy - camyR) * zoom;
    if (sx > mL && sx < Wc - mR && sy > mT && sy < Hc - mB) return null;
    const angle = Math.atan2(sy - cy, sx - cx);
    const cosA = Math.cos(angle), sinA = Math.sin(angle);
    let ec = 0;
    if (cosA > 0.001) _edges[ec++] = (Wc - mR - cx) / cosA;
    if (cosA < -0.001) _edges[ec++] = (mL - cx) / cosA;
    if (sinA > 0.001) _edges[ec++] = (Hc - mB - cy) / sinA;
    if (sinA < -0.001) _edges[ec++] = (mT - cy) / sinA;
    if (!ec) return null;
    let t = Infinity;
    for (let i = 0; i < ec; i++) if (_edges[i] > 0 && _edges[i] < t) t = _edges[i];
    if (t === Infinity) return null;
    return [cx + cosA * t, cy + sinA * t, angle];
  }

  function drawArrow(
    px: number, py: number, angle: number, fill: string, alpha: number, outlined: boolean,
    distStr?: string, shieldPct?: number, hullPct?: number
  ) {
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle);
    if (outlined) {
      // Outer ring, offset from tip — marks "you have a lock on this"
      ctx.beginPath();
      ctx.moveTo(16, 0); ctx.lineTo(-10, -9); ctx.lineTo(-10, 9); ctx.closePath();
      ctx.strokeStyle = fill;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = Math.min(alpha, 1) * 0.45;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(11, 0); ctx.lineTo(-6, -5.5); ctx.lineTo(-6, 5.5); ctx.closePath();
    ctx.fillStyle = fill;
    ctx.globalAlpha = alpha;
    ctx.fill();

    // Draw status sub-ticks next to arrow if provided
    if (shieldPct !== undefined || hullPct !== undefined) {
      ctx.globalAlpha = alpha * 0.7;
      const barL = 12;
      const barX = -20;
      
      // Shield status line (top)
      if (shieldPct !== undefined && shieldPct > 0) {
        ctx.strokeStyle = "rgba(68, 204, 255, 0.8)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(barX, -4);
        ctx.lineTo(barX + barL * shieldPct, -4);
        ctx.stroke();
      }
      
      // Hull status line (bottom)
      if (hullPct !== undefined) {
        ctx.strokeStyle = "rgba(238, 153, 68, 0.8)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(barX, -2);
        ctx.lineTo(barX + barL * hullPct, -2);
        ctx.stroke();
      }
    }
    ctx.restore();

    // Draw distance/telemetry text labels upright (unrotated) in screen space
    if (distStr) {
      ctx.save();
      ctx.font = `8px ${getUIFont()}`;
      ctx.fillStyle = fill;
      ctx.globalAlpha = alpha * 0.85;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      
      // Position the label slightly offset from the boundary arrow toward the center
      const dx = px - cx;
      const dy = py - cy;
      const dMag = Math.hypot(dx, dy) || 1;
      const tx = px - (dx / dMag) * 22;
      const ty = py - (dy / dMag) * 22;
      
      ctx.fillText(distStr, tx, ty);
      ctx.restore();
    }
  }

  // Collect your resolved locks for quick lookup
  const lockedIds = new Set<string>();
  ensureLockQueue();
  for (const slot of player.lockQueue) {
    if (!slot.resolving) lockedIds.add(slot.id);
  }

  const flash = 0.4 + 0.6 * Math.abs(Math.sin(now * 0.006));

  // Enemy arrows — one per off-screen enemy with any relevance
  for (const e of sys.enemies) {
    if (!e.alive) continue;
    const youLocked  = lockedIds.has(e.id);
    const theyLocked = !!e.hasLockOnPlayer;
    const theyLocking = !!e.targetingPlayer && !theyLocked;
    if (!youLocked && !theyLocked && !theyLocking) continue;
    const pos = edgePos(e.x, e.y);
    if (!pos) continue;
    const fill  = theyLocked ? "#ff3333" : theyLocking ? "#ffdd44" : "#ff6666";
    const alpha = theyLocked ? 1.0 : theyLocking ? flash : 0.75;

    // Calculate dynamic distance telemetry
    const d = Math.round(dst(player.x, player.y, e.x, e.y));
    const distStr = d > 1000 ? `${(d / 1000).toFixed(1)}k` : `${d}m`;

    // Calculate target stats percentages
    const maxShield = e.maxShield || 0;
    const shieldPct = maxShield > 0 ? (e.shield || 0) / maxShield : 0;
    const hullPct = Math.max(0, Math.min(1, (e.hp || 0) / Math.max(1, e.maxHp)));

    drawArrow(pos[0], pos[1], pos[2], fill, alpha, youLocked, distStr, shieldPct, hullPct);
  }

  // Locked asteroids off-screen — blue outlined arrow
  for (const slot of player.lockQueue) {
    if (slot.resolving) continue;
    const a = sys.asteroids.find((a2) => a2.id === slot.id && !a2.depleted && a2.hp > 0);
    if (!a) continue;
    const pos = edgePos(a.x, a.y);
    if (pos) {
      const d = Math.round(dst(player.x, player.y, a.x, a.y));
      const distStr = d > 1000 ? `${(d / 1000).toFixed(1)}k` : `${d}m`;
      const hullPct = Math.max(0, Math.min(1, (a.hp || 0) / Math.max(1, a.maxHp)));
      drawArrow(pos[0], pos[1], pos[2], "#88aaff", 0.75, true, distStr, undefined, hullPct);
    }
  }
}

export function drawMinimap(mctx: CanvasRenderingContext2D, now: number) {
  const state = getState();
  const player = state.player;
  const mmW = HUD_MINIMAP_SIZE;
  const mmH = HUD_MINIMAP_SIZE;
  const mmLeft = 0;
  const mmTop = 0;
  const mmX = mmLeft + mmW / 2;
  const mmY = mmTop + mmH / 2;

  // To cover the whole area, we'll scale based on the smaller dimension so things don't squish,
  // but we can allow it to show a bit more horizontally
  const range = 5700;
  const scale = (mmH / 2) / range;

  // Local shape helpers — distinct silhouettes per POI type so the minimap is
  // scannable without relying on color memory.
  const drawTriangle = (cx: number, cy: number, angle: number, size: number) => {
    const tipX = cx + Math.cos(angle) * size;
    const tipY = cy + Math.sin(angle) * size;
    const baseAng = angle + Math.PI;
    const half = size * 0.7;
    const blX = cx + Math.cos(baseAng + 0.5) * half;
    const blY = cy + Math.sin(baseAng + 0.5) * half;
    const brX = cx + Math.cos(baseAng - 0.5) * half;
    const brY = cy + Math.sin(baseAng - 0.5) * half;
    mctx.beginPath();
    mctx.moveTo(tipX, tipY); mctx.lineTo(blX, blY); mctx.lineTo(brX, brY); mctx.closePath();
    mctx.fill();
  };
  const drawSquare = (cx: number, cy: number, size: number) => {
    const h = size / 2;
    mctx.fillRect(cx - h, cy - h, size, size);
  };
  const drawDiamond = (cx: number, cy: number, size: number) => {
    mctx.beginPath();
    mctx.moveTo(cx, cy - size); mctx.lineTo(cx + size, cy);
    mctx.lineTo(cx, cy + size); mctx.lineTo(cx - size, cy);
    mctx.closePath();
    mctx.fill();
  };
  const drawCross = (cx: number, cy: number, size: number) => {
    const t = Math.max(1, Math.round(size / 3));
    const h = size;
    mctx.fillRect(cx - h, cy - t / 2, h * 2, t);
    mctx.fillRect(cx - t / 2, cy - h, t, h * 2);
  };

  mctx.save();

  // Query active theme from document element
  const comp = getComputedStyle(document.documentElement);
  const hudBorder = comp.getPropertyValue("--hud-border").trim() || "rgba(55, 85, 110, 0.65)";
  const hudBorderSoft = comp.getPropertyValue("--hud-border-soft").trim() || "rgba(40, 55, 70, 0.5)";
  const hudBgDeep = comp.getPropertyValue("--hud-bg-deep").trim() || "rgba(2, 5, 10, 0.92)";

  const colorMixTranslucent = (color: string, alpha: number): string => {
    color = color.trim();
    if (color.startsWith("rgb")) {
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
      if (match) return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`;
    }
    if (color.startsWith("#")) {
      const hex = color.slice(1);
      if (hex.length === 3) {
        const r = parseInt(hex[0] + hex[0], 16);
        const g = parseInt(hex[1] + hex[1], 16);
        const b = parseInt(hex[2] + hex[2], 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      } else if (hex.length === 6) {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      }
    }
    return `rgba(55, 85, 110, ${alpha})`;
  };

  // Squared background, border and clipping path
  mctx.beginPath();
  mctx.rect(0, 0, mmW, mmH);
  mctx.fillStyle = colorMixTranslucent(hudBgDeep, 0.35);
  mctx.fill();
  mctx.strokeStyle = hudBorder;
  mctx.lineWidth = 1.5;
  mctx.stroke();
  mctx.clip();

  // Concentric radar range rings
  const maxRadarR = mmW / 2 - 2;
  mctx.strokeStyle = colorMixTranslucent(hudBorderSoft, 0.35);
  mctx.lineWidth = 1;
  mctx.beginPath(); mctx.arc(mmX, mmY, maxRadarR * 0.35, 0, TAU); mctx.stroke();
  mctx.beginPath(); mctx.arc(mmX, mmY, maxRadarR * 0.70, 0, TAU); mctx.stroke();

  // Rotating radar sweep effect
  const sweepAngle = (now * 0.0012) % TAU;
  const sweepGrad = mctx.createRadialGradient(mmX, mmY, 0, mmX, mmY, maxRadarR);
  sweepGrad.addColorStop(0, colorMixTranslucent(hudBorder, 0.12));
  sweepGrad.addColorStop(0.85, colorMixTranslucent(hudBorder, 0.04));
  sweepGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
  
  // Sweep light cone
  mctx.fillStyle = sweepGrad;
  mctx.beginPath();
  mctx.moveTo(mmX, mmY);
  mctx.arc(mmX, mmY, maxRadarR, sweepAngle - 0.4, sweepAngle);
  mctx.closePath();
  mctx.fill();

  // Sweep leading bright line
  mctx.strokeStyle = colorMixTranslucent(hudBorder, 0.35);
  mctx.lineWidth = 1.2;
  mctx.beginPath();
  mctx.moveTo(mmX, mmY);
  mctx.lineTo(mmX + Math.cos(sweepAngle) * maxRadarR, mmY + Math.sin(sweepAngle) * maxRadarR);
  mctx.stroke();


  // Radar Ping Decay Helper
  const getPingOpacity = (px: number, py: number): number => {
    const dx = px - mmX;
    const dy = py - mmY;
    if (Math.hypot(dx, dy) < 4) return 1.0; // Center player is always fully illuminated
    const targetAngle = Math.atan2(dy, dx);
    const targetNormAngle = (targetAngle + TAU) % TAU;
    let diff = sweepAngle - targetNormAngle;
    if (diff < 0) diff += TAU;
    const fraction = diff / TAU;
    // Exponential decay: highly tactical analog phosphor feel
    return 0.12 + 0.88 * Math.exp(-fraction * 3.8);
  };

  for (const a of liveAsteroids()) {
    const px = mmX + (a.x - player.x) * scale, py = mmY + (a.y - player.y) * scale;
    const opacity = getPingOpacity(px, py);
    mctx.fillStyle = `rgba(119, 85, 34, ${opacity})`;
    mctx.beginPath(); mctx.arc(px, py, 2, 0, TAU); mctx.fill();
  }
  for (const e of liveEnemies()) {
    const px = mmX + (e.x - player.x) * scale, py = mmY + (e.y - player.y) * scale;
    const opacity = getPingOpacity(px, py);
    mctx.fillStyle = `rgba(204, 34, 34, ${opacity})`;
    drawTriangle(px, py, e.angle ?? 0, 4);
  }
  const sys = curSys();
  if (sys) {
    for (const g of sys.gates) {
      const px = mmX + (g.x - player.x) * scale, py = mmY + (g.y - player.y) * scale;
      const opacity = getPingOpacity(px, py);
      mctx.fillStyle = `rgba(68, 136, 255, ${opacity})`;
      drawDiamond(px, py, 5);
    }
    for (const s of sys.stations) {
      const px = mmX + (s.x - player.x) * scale, py = mmY + (s.y - player.y) * scale;
      const opacity = getPingOpacity(px, py);
      mctx.fillStyle = `rgba(68, 255, 136, ${opacity})`;
      drawSquare(px, py, 5);
      if (s.turrets) {
        for (const t of s.turrets) {
          if (t.x === undefined || t.y === undefined) continue;
          const tx = mmX + (t.x - player.x) * scale;
          const ty = mmY + (t.y - player.y) * scale;
          if (tx > mmLeft && tx < mmLeft + mmW && ty > mmTop && ty < mmTop + mmH) {
            const tOpacity = getPingOpacity(tx, ty);
            mctx.fillStyle = `rgba(102, 204, 255, ${tOpacity})`;
            drawCross(tx, ty, 3);
          }
        }
      }
    }
  }

  // Player heading triangle (center) — points in ship's facing direction.
  mctx.fillStyle = "#ffffff"; drawTriangle(mmX, mmY, player.angle, 5);
  
  const vmag = Math.hypot(player.vx, player.vy), vmax = 600;
  if (vmag > 2) {
    const vLen = Math.min(vmag / vmax, 1) * (mmH / 2) * .8;
    const va = Math.atan2(player.vy, player.vx);
    mctx.strokeStyle = "rgba(100,200,255,0.6)"; mctx.lineWidth = 1.5;
    mctx.beginPath(); mctx.moveTo(mmX, mmY); mctx.lineTo(mmX + Math.cos(va) * vLen, mmY + Math.sin(va) * vLen); mctx.stroke();
  }
  mctx.restore();
}

export function drawGalaxyMap(Wc: number, Hc: number) {
  const state = getState();
  const player = state.player;
  ctx.fillStyle = "rgba(0,1,4,0.97)"; ctx.fillRect(0, 0, Wc, Hc);
  ctx.font = `bold 18px ${getUIFont()}`; ctx.fillStyle = "#7a9ec8"; ctx.textAlign = "center";
  ctx.fillText("GALAXY MAP  [M / ESC to close]", Wc / 2, 36);
  ctx.font = `12px ${getUIFont()}`; ctx.fillStyle = "#6688aa";
  ctx.fillText("Press [M] to switch to System View", Wc / 2, 56);
  let mnX = Infinity, mnY = Infinity, mxX = -Infinity, mxY = -Infinity;
  const galaxy = state.GALAXY;
  for (const s of galaxy) { mnX = Math.min(mnX, s.mapX); mnY = Math.min(mnY, s.mapY); mxX = Math.max(mxX, s.mapX); mxY = Math.max(mxY, s.mapY); }
  const scale = Math.min((Wc - 100) / (mxX - mnX || 1), (Hc - 130) / (mxY - mnY || 1), 0.95);
  const toMap = (mx: number, my: number) => ({ x: Wc / 2 + (mx - (mnX + mxX) / 2) * scale, y: Hc / 2 + 30 + (my - (mnY + mxY) / 2) * scale });
  ctx.strokeStyle = "rgba(28,48,72,0.55)"; ctx.lineWidth = 1;
  for (const sys of galaxy) { 
    const a = toMap(sys.mapX, sys.mapY); 
    for (const li of sys.links) { 
      const b = toMap(galaxy[li].mapX, galaxy[li].mapY); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); 
    } 
  }
  for (const sys of galaxy) {
    const p = toMap(sys.mapX, sys.mapY), cur = sys.idx === player.sysIdx;
    const r2 = cur ? 10 : sys.stations.length > 0 ? 7 : 5;
    const sc = sys.security >= .7 ? "#44ff88" : sys.security >= .4 ? "#ffcc44" : "#ff4444";
    ctx.beginPath(); ctx.arc(p.x, p.y, r2, 0, TAU); ctx.fillStyle = cur ? sc : "rgba(35,55,75,0.85)"; ctx.fill();
    ctx.strokeStyle = cur ? "#fff" : sc; ctx.lineWidth = cur ? 2 : 1; ctx.stroke();
    if (sys.stations.length) { ctx.fillStyle = "rgba(100,255,150,0.9)"; ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, TAU); ctx.fill(); }
    ctx.font = cur ? `bold 10px ${getUIFont()}` : `9px ${getUIFont()}`; ctx.fillStyle = cur ? "#fff" : "#6688aa"; ctx.textAlign = "center";
    ctx.fillText(sys.name, p.x, p.y + r2 + 13);
    if (sys._ready) { ctx.font = `8px ${getUIFont()}`; ctx.fillStyle = sc; ctx.fillText(sys.security.toFixed(1), p.x, p.y + r2 + 23); }
  }
}

export function drawSystemMap(Wc: number, Hc: number) {
  const state = getState();
  const player = state.player;
  ctx.fillStyle = "rgba(0,1,4,0.97)"; ctx.fillRect(0, 0, Wc, Hc);
  
  const sys = curSys();
  if (!sys) return;

  ctx.font = `bold 18px ${getUIFont()}`; ctx.fillStyle = "#7a9ec8"; ctx.textAlign = "center";
  ctx.fillText(`${sys.name.toUpperCase()} SYSTEM MAP  [M / ESC to close]`, Wc / 2, 36);
  ctx.font = `12px ${getUIFont()}`; ctx.fillStyle = "#6688aa";
  ctx.fillText("Press [M] to switch to Galaxy View", Wc / 2, 56);

  // Find bounds of the system content
  let mnX = Math.min(player.x, 0), mnY = Math.min(player.y, 0), mxX = Math.max(player.x, 0), mxY = Math.max(player.y, 0);
  for (const a of sys.asteroids) { mnX = Math.min(mnX, a.x); mnY = Math.min(mnY, a.y); mxX = Math.max(mxX, a.x); mxY = Math.max(mxY, a.y); }
  for (const e of sys.enemies) { mnX = Math.min(mnX, e.x); mnY = Math.min(mnY, e.y); mxX = Math.max(mxX, e.x); mxY = Math.max(mxY, e.y); }
  for (const g of sys.gates) { mnX = Math.min(mnX, g.x); mnY = Math.min(mnY, g.y); mxX = Math.max(mxX, g.x); mxY = Math.max(mxY, g.y); }
  for (const s of sys.stations) { mnX = Math.min(mnX, s.x); mnY = Math.min(mnY, s.y); mxX = Math.max(mxX, s.x); mxY = Math.max(mxY, s.y); }

  // Add margin
  const margin = 2000;
  mnX -= margin; mnY -= margin; mxX += margin; mxY += margin;
  
  const scale = Math.min((Wc - 300) / (mxX - mnX || 1), (Hc - 130) / (mxY - mnY || 1), 0.95);
  const toMap = (mx: number, my: number) => ({ x: Wc / 2 + (mx - (mnX + mxX) / 2) * scale, y: Hc / 2 + 30 + (my - (mnY + mxY) / 2) * scale });

  // Draw grid lines
  ctx.strokeStyle = "rgba(28,48,72,0.15)";
  ctx.lineWidth = 1;
  const gridStep = 5000 * scale;
  const centerX = Wc / 2 - ((mnX + mxX) / 2) * scale;
  const centerY = Hc / 2 + 30 - ((mnY + mxY) / 2) * scale;
  ctx.beginPath();
  for (let x = centerX % gridStep; x < Wc; x += gridStep) { ctx.moveTo(x, 0); ctx.lineTo(x, Hc); }
  for (let y = centerY % gridStep; y < Hc; y += gridStep) { ctx.moveTo(0, y); ctx.lineTo(Wc, y); }
  ctx.stroke();

  // Draw Star at (0,0)
  const sp = toMap(0, 0);
  const sysClass = sys.starClass ?? "G";
  ctx.fillStyle = "#ffcc44";
  ctx.beginPath(); ctx.arc(sp.x, sp.y, 14, 0, TAU); ctx.fill();
  ctx.shadowBlur = 20; ctx.shadowColor = "#ffaa00"; ctx.stroke(); ctx.shadowBlur = 0;
  ctx.font = `bold 11px ${getUIFont()}`; ctx.fillStyle = "#ffcc44"; ctx.textAlign = "center";
  ctx.fillText(`${sysClass}-CLASS STAR`, sp.x, sp.y + 30);

  // Draw asteroids
  for (const a of sys.asteroids) {
    if (a.depleted || a.hp <= 0) continue;
    const p = toMap(a.x, a.y);
    ctx.fillStyle = "#775522";
    ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1, a.radius * scale), 0, TAU); ctx.fill();
  }

  // Draw enemies
  for (const e of sys.enemies) {
    if (!e.alive) continue;
    const p = toMap(e.x, e.y);
    ctx.fillStyle = "#cc2222";
    ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(2, (e.radius ?? 3) * scale || 3), 0, TAU); ctx.fill();
  }

  // Draw gates
  for (const g of sys.gates) {
    const p = toMap(g.x, g.y);
    ctx.fillStyle = "#4488ff";
    ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(3, g.radius * scale || 5), 0, TAU); ctx.fill();
    ctx.font = `9px ${getUIFont()}`; ctx.fillStyle = "#4488ff"; ctx.textAlign = "center";
    ctx.fillText(`JUMP GATE`, p.x, p.y + 12);
  }

  // Draw stations
  for (const s of sys.stations) {
    const p = toMap(s.x, s.y);
    ctx.fillStyle = "#44ff88";
    ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(4, s.radius * scale || 6), 0, TAU); ctx.fill();
    ctx.font = `bold 10px ${getUIFont()}`; ctx.fillStyle = "#44ff88"; ctx.textAlign = "center";
    ctx.fillText(s.name, p.x, p.y + Math.max(4, s.radius * scale || 6) + 12);
  }

  // Draw player
  const pp = toMap(player.x, player.y);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath(); ctx.arc(pp.x, pp.y, 4, 0, TAU); ctx.fill();
  
  // Draw Legend
  const lx = 30;
  let ly = Hc - 140;
  ctx.fillStyle = "rgba(5, 10, 20, 0.8)";
  ctx.strokeStyle = "rgba(40, 70, 100, 0.6)";
  ctx.lineWidth = 1;
  ctx.fillRect(lx - 10, ly - 20, 150, 140);
  ctx.strokeRect(lx - 10, ly - 20, 150, 140);
  
  ctx.font = `bold 11px ${getUIFont()}`; ctx.fillStyle = "#88aacc"; ctx.textAlign = "left";
  ctx.fillText("LEGEND", lx, ly); ly += 20;
  
  const drawLegendItem = (color: string, label: string) => {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(lx + 5, ly - 4, 4, 0, TAU); ctx.fill();
    ctx.fillStyle = "#aaddff"; ctx.font = `11px ${getUIFont()}`;
    ctx.fillText(label, lx + 18, ly);
    ly += 20;
  };
  
  drawLegendItem("#ffcc44", "System Star");
  drawLegendItem("#ffffff", "Player Ship");
  drawLegendItem("#44ff88", "Station");
  drawLegendItem("#4488ff", "Jump Gate");
  drawLegendItem("#cc2222", "Hostile");
  drawLegendItem("#775522", "Asteroid");
}

// Pre-computed stable streak data — same every warp, animation driven by progress
const _STREAKS = (() => {
  const rng = mulberry32(0xBEEF1234);
  return Array.from({ length: 130 }, () => ({
    a:  rng() * Math.PI * 2,
    sp: 0.22 + rng() * 0.78,
    lm: 0.45 + rng() * 0.55,
    ir: 5    + rng() * 22,
    w:  0.3  + rng() * 1.6,
    br: 0.45 + rng() * 0.55,
  }));
})();

export function drawWarpScreen(Wc: number, Hc: number, now: number) {
  const state = getState();
  const player = state.player;
  const preWarp = state.warpTargetIdx >= 0;
  const cx = Wc / 2, cy = Hc / 2;
  const halfDiag = Math.hypot(Wc, Hc) * 0.5;

  let progress: number, arrFade: number;
  if (preWarp) {
    progress = Math.max(0, 1 - state.warpCooldown / 2.4);
    arrFade = 0;
  } else {
    progress = 1;
    arrFade = Math.min(1, (state.warpCooldown - 2.0) / 0.5);
  }

  // Deep space overlay — darkens as warp builds
  const overlayA = preWarp
    ? Math.min(0.92, 0.15 + progress * 0.82)
    : Math.max(0, arrFade) * 0.7;
  ctx.fillStyle = `rgba(0,1,10,${overlayA})`;
  ctx.fillRect(0, 0, Wc, Hc);

  if (preWarp && progress > 0.02) {
    // Streaking hyperspace lines
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const s of _STREAKS) {
      const len = s.lm * Math.pow(progress, 1.35) * halfDiag * s.sp;
      if (len < 3) continue;
      const alpha = s.br * Math.min(1, progress * 2) * s.sp;
      if (alpha < 0.03) continue;
      const x1 = cx + Math.cos(s.a) * s.ir;
      const y1 = cy + Math.sin(s.a) * s.ir;
      const x2 = cx + Math.cos(s.a) * (s.ir + len);
      const y2 = cy + Math.sin(s.a) * (s.ir + len);
      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0,    `rgba(80,130,255,0)`);
      grad.addColorStop(0.2,  `rgba(160,200,255,${alpha * 0.55})`);
      grad.addColorStop(1,    `rgba(255,255,255,${alpha})`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = s.w * (0.4 + progress * 0.8);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    ctx.restore();

    // Central glow bloom
    const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, 60 + progress * 140);
    bloom.addColorStop(0,   `rgba(140,190,255,${0.22 * progress * progress})`);
    bloom.addColorStop(0.5, `rgba(70,110,220,${0.12 * progress})`);
    bloom.addColorStop(1,   'transparent');
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, Wc, Hc);

    // Edge tunnel vignette
    const vig = ctx.createRadialGradient(cx, cy, halfDiag * 0.35, cx, cy, halfDiag);
    vig.addColorStop(0, 'transparent');
    vig.addColorStop(1, `rgba(0,0,18,${0.75 * progress})`);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, Wc, Hc);
  }

  // Arrival flash
  if (arrFade > 0.01) {
    ctx.fillStyle = `rgba(170,210,255,${arrFade * 0.8})`;
    ctx.fillRect(0, 0, Wc, Hc);
  }

  // Text overlays
  const destIdx  = preWarp ? state.warpTargetIdx : player.sysIdx;
  const destSys  = state.GALAXY[destIdx];
  const destName = (destSys?.name || '').toUpperCase();
  const textA    = preWarp ? Math.min(1, (progress - 0.12) / 0.18) : arrFade;

  if (textA > 0.01) {
    ctx.save();
    ctx.globalAlpha = textA;
    ctx.textAlign = 'center';

    if (preWarp) {
      ctx.font = `bold 10px ${getUIFont()}`;
      ctx.fillStyle = '#344e72';
      ctx.fillText('JUMP DRIVE ENGAGED', cx, cy - 32);

      ctx.font = `bold 24px ${getUIFont()}`;
      ctx.fillStyle = '#aaceff';
      ctx.shadowBlur = 24;
      ctx.shadowColor = '#3366cc';
      ctx.fillText(`⟩⟩ ${destName}`, cx, cy + 6);
      ctx.shadowBlur = 0;

      if (destSys) {
        const sec = destSys.security?.toFixed(1);
        const secCol = destSys.security >= 0.7 ? '#44ff88'
                     : destSys.security >= 0.4 ? '#ffcc44' : '#ff5544';
        ctx.font = `10px ${getUIFont()}`;
        ctx.fillStyle = secCol;
        ctx.globalAlpha = textA * 0.7;
        ctx.fillText(`SECURITY ${sec}`, cx, cy + 28);
      }
    } else {
      ctx.font = `bold 20px ${getUIFont()}`;
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 18;
      ctx.shadowColor = '#88bbff';
      ctx.fillText(destName, cx, cy);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }
}
