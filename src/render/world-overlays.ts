import { ctx } from "../canvas.js";
import { Client } from "../state.js";
import { getState } from "../state-access.js";
import { TAU, GATE_RANGE } from "../constants.js";
import { isVisible } from "../utils/game.js";
import { dst } from "../utils/math.js";
import { getThemeColors } from "../data/settings.js";
import { drawWorldLabelCard } from "./world-label-card.js";
import { getDistantSunScreenPos } from "./pixi-background.js";
import { renderReticleStyle } from "./reticle.js";
import { getDropZoneCenter } from "../hub.js";
import type { System, Enemy } from "../types/world.js";
import { shouldShowWarpGate } from "../data/tutorial.js";

/**
 * Legacy Spatial and Screenspace Canvas 2D overlays.
 * Renders on top of the hardware-accelerated PixiJS space background and entity layers.
 */

// ─── Station & Dock Overlays ──────────────────────────────────────────────────
export function drawStations(now: number, sys: System) {
  if (!sys?.stations) return;
  for (const st of sys.stations) {
    if (!isVisible(st.x, st.y, Math.max(800, st.radius * 3))) continue;
    const player = getState().player;
    const dockR = st.radius * 2;
    const interactR = st.isProcessingHub ? ((st.collectRadius ?? 220) + 80) : dockR;
    const inRange = dst(player.x, player.y, st.x, st.y) < interactR;
    const locked = sys._liveEnemies?.some((e: Enemy) => e.hasLockOnPlayer) ?? false;

    // Safe-zone ring - high tech defensive telemetry grid
    const safeR = st.safeRadius ?? (st.isHome ? 900 : 675);
    const pd = dst(player.x, player.y, st.x, st.y);
    if (pd < safeR * 2) {
      const t = Math.max(0, 1 - pd / (safeR * 2));
      const zoneAlpha = t * 0.18;
      const spulse = 0.90 + 0.10 * Math.sin(now * 0.0018);
      const col = st.isHome ? "0,210,255" : sys.security >= 0.6 ? "0,210,255" : sys.security >= 0.3 ? "200,200,255" : "255,80,60";
      ctx.save();

      // 1. Faint outer primary tech grid line
      ctx.globalAlpha = zoneAlpha * spulse;
      ctx.strokeStyle = `rgba(${col},${zoneAlpha * spulse})`;
      ctx.lineWidth = 1.8;
      ctx.setLineDash([12, 12]);
      ctx.beginPath(); ctx.arc(st.x, st.y, safeR, 0, TAU); ctx.stroke();

      // 2. Faint continuous secondary inner hairline ring
      ctx.lineWidth = 0.8;
      ctx.setLineDash([]);
      ctx.strokeStyle = `rgba(${col},${zoneAlpha * 0.35})`;
      ctx.beginPath(); ctx.arc(st.x, st.y, safeR - 10, 0, TAU); ctx.stroke();

      // 3. Technical compass notches along the safe-zone ring
      ctx.lineWidth = 1.0;
      ctx.strokeStyle = `rgba(${col},${zoneAlpha * 0.5})`;
      const numNotches = 36;
      for (let i = 0; i < numNotches; i++) {
        const a = (i / numNotches) * TAU;
        ctx.beginPath();
        ctx.moveTo(st.x + Math.cos(a) * (safeR - 4), st.y + Math.sin(a) * (safeR - 4));
        ctx.lineTo(st.x + Math.cos(a) * (safeR + 4), st.y + Math.sin(a) * (safeR + 4));
        ctx.stroke();
      }

      // 4. Faint glowing sweep telemetry sensor beam
      const sweepAngle = (now * 0.00045) % TAU;
      const sweepG = ctx.createLinearGradient(
        st.x, st.y,
        st.x + Math.cos(sweepAngle) * safeR, st.y + Math.sin(sweepAngle) * safeR
      );
      sweepG.addColorStop(0, `rgba(${col}, 0)`);
      sweepG.addColorStop(1, `rgba(${col}, ${zoneAlpha * 0.55})`);
      ctx.strokeStyle = sweepG;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(st.x, st.y);
      ctx.lineTo(st.x + Math.cos(sweepAngle) * safeR, st.y + Math.sin(sweepAngle) * safeR);
      ctx.stroke();

      ctx.restore();
    }

    if (st.isProcessingHub) {
      const dropZone = getDropZoneCenter(st);
      const inDropZone = dst(player.x, player.y, dropZone.x, dropZone.y) < dropZone.radius + 60;
      
      // Calculate directional math to drop zone to attach the bay arms dynamically
      const dx = dropZone.x - st.x;
      const dy = dropZone.y - st.y;
      const dist = Math.hypot(dx, dy) || 1;
      const ang = Math.atan2(dy, dx);

      // Upper pylon points
      const x1 = st.x + st.radius * Math.cos(ang - 0.6);
      const y1 = st.y + st.radius * Math.sin(ang - 0.6);
      const x2 = dropZone.x + dropZone.radius * Math.cos(ang + Math.PI - 0.5);
      const y2 = dropZone.y + dropZone.radius * Math.sin(ang + Math.PI - 0.5);

      // Lower pylon points
      const x3 = st.x + st.radius * Math.cos(ang + 0.6);
      const y3 = st.y + st.radius * Math.sin(ang + 0.6);
      const x4 = dropZone.x + dropZone.radius * Math.cos(ang + Math.PI + 0.5);
      const y4 = dropZone.y + dropZone.radius * Math.sin(ang + Math.PI + 0.5);

      ctx.save();

      // 1. Heavy dark metallic background base plating connecting the station hull to the drop cradle
      ctx.fillStyle = "#11161d";
      ctx.strokeStyle = "#243242";
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.arc(dropZone.x, dropZone.y, dropZone.radius, ang + Math.PI - 0.5, ang + Math.PI + 0.5);
      ctx.lineTo(x4, y4);
      ctx.lineTo(x3, y3);
      ctx.arc(st.x, st.y, st.radius, ang + 0.6, ang - 0.6, true);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 2. Industrial diagonal cross girders (steel truss system)
      ctx.strokeStyle = "rgba(48,68,88,0.7)";
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      // Upper-left to lower-right truss
      ctx.moveTo(x1, y1); ctx.lineTo(x4, y4);
      // Lower-left to upper-right truss
      ctx.moveTo(x3, y3); ctx.lineTo(x2, y2);
      ctx.stroke();

      // 3. Yellow-and-black industrial hazard warning threshold line at the bay entrance
      ctx.strokeStyle = "rgba(220,150,20,0.85)";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([7, 6]);
      ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.lineTo(x3, y3);
      ctx.stroke();
      ctx.setLineDash([]);

      // 4. Proximity drop zone glowing core
      if (inDropZone) {
        const pdDrop = dst(player.x, player.y, dropZone.x, dropZone.y);
        if (pdDrop < dropZone.radius) {
          const cG = ctx.createRadialGradient(dropZone.x, dropZone.y, 0, dropZone.x, dropZone.y, dropZone.radius);
          cG.addColorStop(0, "rgba(255,160,40,0.08)");
          cG.addColorStop(1, "rgba(255,160,40,0)");
          ctx.fillStyle = cG;
          ctx.beginPath(); ctx.arc(dropZone.x, dropZone.y, dropZone.radius, 0, TAU); ctx.fill();
        }
      }

      // 5. Thick pylon structural support beams overlay
      ctx.strokeStyle = "rgba(70,90,105,0.85)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.moveTo(x3, y3); ctx.lineTo(x4, y4);
      ctx.stroke();

      // Glowing hazard amber tech stripes on structural pylons
      ctx.strokeStyle = inDropZone ? "rgba(255,160,40,0.85)" : "rgba(255,140,40,0.4)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.moveTo(x3, y3); ctx.lineTo(x4, y4);
      ctx.stroke();

      // 6. Outer crescent-shaped mechanical boundary cradle (closed facing away from station)
      ctx.strokeStyle = inDropZone ? "rgba(255,160,40,0.85)" : "rgba(100,120,135,0.45)";
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(dropZone.x, dropZone.y, dropZone.radius, ang + Math.PI + 0.5, ang + Math.PI - 0.5);
      ctx.stroke();

      // Secondary flashing dashed warning field along the mechanical boundary cradle
      ctx.strokeStyle = inDropZone ? "rgba(255,180,60,0.65)" : "rgba(255,140,40,0.25)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -(now * 0.03) % 14;
      ctx.beginPath();
      ctx.arc(dropZone.x, dropZone.y, dropZone.radius - 4, ang + Math.PI + 0.5, ang + Math.PI - 0.5);
      ctx.stroke();
      ctx.setLineDash([]);

      // 7. Subtle hub interact range ring
      const interactR2 = (st.collectRadius ?? 220) + 40;
      ctx.strokeStyle = "rgba(255,160,40,0.12)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(st.x, st.y, interactR2, 0, TAU); ctx.stroke();

      ctx.restore();

      if (inRange) {
        drawWorldLabelCard(st.x + st.radius + 15, st.y, "[F] Processing Hub", { fill: "#ffaa44" });
      }
    } else {
      // Dock range ring - high tech landing alignment
      const dockReady = inRange && !locked;
      ctx.save();

      if (dockReady) {
        // High-contrast neon pulsing dual rings
        const dockPulse = 0.5 + 0.15 * Math.sin(now * 0.0035);
        ctx.strokeStyle = `rgba(0, 240, 255, ${0.45 + dockPulse})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(st.x, st.y, dockR, 0, TAU); ctx.stroke();

        ctx.strokeStyle = `rgba(40, 255, 150, ${0.25 + dockPulse * 0.5})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.arc(st.x, st.y, dockR - 6, 0, TAU); ctx.stroke();

        // 4 beautiful corner landing alignment brackets
        ctx.lineWidth = 2.4;
        ctx.strokeStyle = "rgba(40, 255, 180, 0.85)";
        for (let i = 0; i < 4; i++) {
          const a = (i * Math.PI / 2);
          ctx.save();
          ctx.translate(st.x, st.y);
          ctx.rotate(a);
          ctx.beginPath();
          ctx.arc(0, 0, dockR, -0.07, 0.07);
          ctx.stroke();

          // Inward-pointing alignment pointers
          ctx.beginPath();
          ctx.moveTo(dockR, -3);
          ctx.lineTo(dockR - 8, 0);
          ctx.lineTo(dockR, 3);
          ctx.stroke();
          ctx.restore();
        }
      } else {
        // Faint scan rings
        ctx.strokeStyle = "rgba(0,180,80,0.12)";
        ctx.lineWidth = 1.0;
        ctx.setLineDash([5, 8]);
        ctx.beginPath(); ctx.arc(st.x, st.y, dockR, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);

        ctx.strokeStyle = "rgba(0,180,80,0.06)";
        ctx.setLineDash([2, 5]);
        ctx.beginPath(); ctx.arc(st.x, st.y, dockR - 6, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();

      // Label + dock prompt on the right
      if (inRange) {
        drawWorldLabelCard(
          st.x + st.radius + 15,
          st.y,
          locked ? "◉ Locked" : "[F] Dock",
          { fill: locked ? "#ff5555" : "#88c8ff" },
        );
      }
    }
  }

  // ─── Warp Gate Proximity Overlays ───────────────────────────────────────────
  if (sys.gates) {
    const player = getState().player;
    for (const g of sys.gates) {
      if (!shouldShowWarpGate(g, sys.idx, getState().player)) continue;
      if (!isVisible(g.x, g.y, g.radius * 2.5)) continue;
      const inRange = dst(player.x, player.y, g.x, g.y) < g.radius + GATE_RANGE;
      if (inRange) {
        const tgt = getState().GALAXY[g.targetSysIdx];
        drawWorldLabelCard(
          g.x + g.radius + 15,
          g.y,
          `[F] Jump To ${tgt?.name || "Sector"}`,
        );
      }
    }
  }

  // ─── Resolved Site Markers ─────────────────────────────────────────────────
  const SITE_INTERACT_RANGE = 280;
  if (sys.hiddenSites) {
    const player = getState().player;
    for (const site of sys.hiddenSites) {
      if (site.state !== "resolved" || !isVisible(site.x, site.y, 120)) continue;
      const color = site.family === "relic" ? "#ffcc44" : site.family === "derelict" ? "#ff9966" : "#66d8ff";
      const pulse = 0.72 + 0.28 * Math.sin(now * 0.003 + site.rewardSeed * 0.001);
      ctx.save();
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.32 + pulse * 0.25;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(site.x, site.y, 16 + pulse * 3, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(site.x - 7, site.y);
      ctx.lineTo(site.x + 7, site.y);
      ctx.moveTo(site.x, site.y - 7);
      ctx.lineTo(site.x, site.y + 7);
      ctx.stroke();
      ctx.restore();

      drawWorldLabelCard(site.x + 18, site.y - 12, site.name, { fill: color });
      if (
        site.hasEncryptedContent
        && !player.completedSiteIds.includes(site.id)
        && dst(player.x, player.y, site.x, site.y) < SITE_INTERACT_RANGE
      ) {
        drawWorldLabelCard(site.x + 18, site.y + 12, "[F] Breach Datacore");
      }
    }
  }
}

// ─── Station Turrets ──────────────────────────────────────────────────────────
export function drawStationTurrets(now: number, sys: System) {
  if (!sys?.stations) return;
  for (const st of sys.stations) {
    if (!st.turrets || !st.turrets.length) continue;
    if (!isVisible(st.x, st.y, 300)) continue;

    // Subtle orbital ring connecting turrets
    const orbitR = st.turrets[0]?.orbitRadius ?? (st.safeRadius ?? 600);
    ctx.save();
    ctx.strokeStyle = "rgba(130,130,140,0.15)";
    ctx.lineWidth = 1.0;
    ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.arc(st.x, st.y, orbitR, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    for (const t of st.turrets) {
      const tx = t.x ?? 0, ty = t.y ?? 0;
      if (!isVisible(tx, ty, 40)) continue;
      const face = t.faceAngle ?? t.angle;
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(face);

      // 1. High-tech charging glow aura
      const glowR = 19;
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, glowR);
      const isCharging = t.shootCd > 0;
      const energyColor = isCharging ? "255,100,0" : "0,210,255";
      glow.addColorStop(0, `rgba(${energyColor}, 0.28)`);
      glow.addColorStop(0.5, `rgba(${energyColor}, 0.1)`);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(0, 0, glowR, 0, TAU); ctx.fill();

      // 2. High-Tech Octagon Platform
      ctx.fillStyle = "#121a24";
      ctx.strokeStyle = "#385b75";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const platR = 9.5;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + Math.PI / 8;
        const px = Math.cos(a) * platR;
        const py = Math.sin(a) * platR;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Platform detailed charging ring
      ctx.strokeStyle = isCharging ? "rgba(255,120,0,0.55)" : "rgba(0,210,255,0.55)";
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, TAU); ctx.stroke();

      // Platform central alignment pin
      ctx.fillStyle = isCharging ? "#ff8800" : "#a2f0ff";
      ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, TAU); ctx.fill();

      // 3. Dual-barrel heavy railgun assembly
      ctx.fillStyle = "#2d3540";
      ctx.strokeStyle = "#657b8c";
      ctx.lineWidth = 0.8;

      // Barrel 1 (Top Rail)
      ctx.fillRect(4, -3.5, 14, 2.2);
      ctx.strokeRect(4, -3.5, 14, 2.2);

      // Barrel 2 (Bottom Rail)
      ctx.fillRect(4, 1.3, 14, 2.2);
      ctx.strokeRect(4, 1.3, 14, 2.2);

      // Supercharged neon railgun conduit
      ctx.strokeStyle = `rgba(${energyColor}, 0.95)`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(3, 0);
      ctx.lineTo(16, 0);
      ctx.stroke();

      // Heavy plasma muzzle nozzles
      ctx.fillStyle = isCharging ? "#ffa044" : "#bbf0ff";
      ctx.fillRect(17, -3.5, 2.5, 2.2);
      ctx.fillRect(17, 1.3, 2.5, 2.2);

      // 4. Power spiked muzzle blast
      if (t.muzzleFlash !== undefined && t.muzzleFlash > 0) {
        t.muzzleFlash -= 1 / 60;
        const fa = Math.max(0, t.muzzleFlash / 0.08);
        ctx.globalAlpha = fa;

        const mg = ctx.createRadialGradient(19, 0, 0, 19, 0, 22);
        mg.addColorStop(0, "rgba(255,245,210,0.98)");
        mg.addColorStop(0.35, "rgba(0,210,255,0.72)");
        mg.addColorStop(1, "rgba(0,120,255,0)");
        ctx.fillStyle = mg;
        ctx.beginPath(); ctx.arc(19, 0, 22, 0, TAU); ctx.fill();

        // Electrical discharge arcs
        ctx.strokeStyle = "rgba(255,255,255,0.95)";
        ctx.lineWidth = 1.5;
        for (let i = -1; i <= 1; i++) {
          const spikeA = i * 0.28;
          ctx.beginPath();
          ctx.moveTo(19, 0);
          ctx.lineTo(19 + Math.cos(spikeA) * 16, Math.sin(spikeA) * 16);
          ctx.stroke();
        }

        ctx.globalAlpha = 1;
      }

      ctx.restore();
    }
  }
}

// ─── Combat Crosshair ─────────────────────────────────────────────────────────
export function drawCrosshair() {
  const { x, y } = Client.mouseWorld;
  const sz = 12 / Client.zoom;
  const theme = getThemeColors(Client.settings?.theme || "default");
  const style = Client.settings?.reticleStyle || "classic";

  ctx.save();
  ctx.globalAlpha = 0.55;
  renderReticleStyle(ctx, style, x, y, sz, theme.textMain, 1.5 / Client.zoom);
  ctx.restore();
}

// ─── Cinematic Lens Flare ─────────────────────────────────────────────────────
export function drawLensFlare(Wc: number, Hc: number) {
  if (!Client.settings?.lensFlare) return;

  const { x: sx, y: sy } = getDistantSunScreenPos();
  if (sx === 0 && sy === 0) return;  // sun not yet positioned

  // Direction from sun to screen center (axis along which ghosts string)
  const cx = Wc / 2, cy = Hc / 2;
  const dx = cx - sx, dy = cy - sy;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return;
  const nx = dx / dist, ny = dy / dist;

  // Proximity-only strength — no base value so the flare vanishes at screen edges
  const proximity = Math.max(0, 1 - dist / (Math.min(Wc, Hc) * 0.7));
  const strength  = proximity * 0.7;
  if (strength < 0.01) return;

  ctx.save();

  // 1. Anamorphic horizontal streak
  {
    const sW = Wc * 0.14, sH = 1 + proximity;
    const g = ctx.createLinearGradient(sx - sW / 2, sy, sx + sW / 2, sy);
    g.addColorStop(0.00, "rgba(0,0,0,0)");
    g.addColorStop(0.30, "rgba(0,0,0,0)");
    g.addColorStop(0.50, `rgba(255,240,200,${0.05 * strength})`);
    g.addColorStop(0.70, "rgba(0,0,0,0)");
    g.addColorStop(1.00, "rgba(0,0,0,0)");
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = g;
    ctx.fillRect(sx - sW / 2, sy - sH / 2, sW, sH);
    ctx.restore();
  }

  // 2. Ghost circles strung along the sun→center axis
  const ghosts = [
    { t: 0.30, r:  8, color: "255,200,120" },
    { t: 0.60, r: 16, color: "180,210,255" },
    { t: 0.90, r:  6, color: "255,160,100" },
    { t: 1.20, r: 10, color: "200,180,255" },
  ];
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const g of ghosts) {
    const gx = sx + dx * g.t;
    const gy = sy + dy * g.t;
    const alpha = 0.03 * strength;
    const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, g.r);
    grad.addColorStop(0.0, `rgba(${g.color},${alpha})`);
    grad.addColorStop(0.5, `rgba(${g.color},${alpha * 0.3})`);
    grad.addColorStop(1.0, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(gx, gy, g.r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // 3. Chromatic chord — thin dispersion artifact crossing the streak
  {
    const chord = ctx.createLinearGradient(sx - 10, sy, sx + 10, sy);
    chord.addColorStop(0.0, `rgba(255,60,60,${0.02 * strength})`);
    chord.addColorStop(0.5, `rgba(60,255,60,${0.015 * strength})`);
    chord.addColorStop(1.0, `rgba(60,60,255,${0.02 * strength})`);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = chord;
    ctx.fillRect(sx - 10, sy - 1, 20, 2);
    ctx.restore();
  }

  ctx.restore();
}
