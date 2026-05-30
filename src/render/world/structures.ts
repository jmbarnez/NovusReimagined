import { getState } from "../../state-access.js";

import { ctx } from "../../canvas.js";
import { TAU } from "../../constants.js";
import { isVisible } from "../../utils/game.js";
import { dst } from "../../utils/math.js";
import { worldText } from "../world-text.js";
import { getUIFont } from "../ui-font.js";
import type { System, Enemy } from "../../types/world.js";

// Station bodies are rendered by PixiJS (render/pixi-stations.ts). This module
// keeps only the per-frame Canvas 2D station overlays (safe-zone ring,
// dock-range ring, label) plus gates and station turret rendering.

export function drawGates(now: number, alpha: number, sys: System) {
  if (!sys?.gates) return;
  for (const g of sys.gates) {
    if (!isVisible(g.x, g.y, g.radius * 2.5)) continue;
    const target = getState().GALAXY?.[g.targetSysIdx];
    ctx.save(); ctx.translate(g.x, g.y);
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.0022);
    const glow = ctx.createRadialGradient(0, 0, g.radius * .4, 0, 0, g.radius * 2.2);
    glow.addColorStop(0, `rgba(40,100,210,${0.08 + pulse * .06})`); glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, g.radius * 2.2, 0, TAU); ctx.fill();
    for (let i = 0; i < 16; i++) {
      const a = g.spin + (i / 16) * TAU, ar = a + (1 / 16) * TAU * 0.72;
      ctx.beginPath(); ctx.arc(0, 0, g.radius, a, ar);
      ctx.strokeStyle = i % 4 === 0 ? `rgba(120,190,255,${0.8 + pulse * .2})` : `rgba(60,120,200,0.45)`;
      ctx.lineWidth = i % 4 === 0 ? 3 : 1.5; ctx.stroke();
    }
    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, g.radius * .5);
    core.addColorStop(0, `rgba(200,225,255,${0.25 + pulse * .35})`); core.addColorStop(1, `rgba(40,90,200,0.08)`);
    ctx.beginPath(); ctx.arc(0, 0, g.radius * .5, 0, TAU); ctx.fillStyle = core; ctx.fill();
    ctx.restore();
    worldText(g.x, g.y, `⟩⟩ ${target.name}`, {
      font: `bold 11px ${getUIFont()}`,
      fill: "#88c8ff",
      offsetY: 18,
      shadow: true,
    });
  }
}

export function drawStations(now: number, sys: System) {
  if (!sys?.stations) return;
  for (const st of sys.stations) {
    if (!isVisible(st.x, st.y, Math.max(800, st.radius * 3))) continue;
    const player = getState().player;
    const dockR = st.radius * 2;
    const inRange = dst(player.x, player.y, st.x, st.y) < dockR;
    const locked = sys._liveEnemies?.some((e: Enemy) => e.hasLockOnPlayer) ?? false;

    // Safe-zone ring
    const safeR = st.safeRadius ?? (st.isHome ? 900 : 675);
    const pd = dst(player.x, player.y, st.x, st.y);
    if (pd < safeR * 2) {
      const t = Math.max(0, 1 - pd / (safeR * 2));
      const zoneAlpha = t * 0.18;
      const spulse = 0.92 + 0.08 * Math.sin(now * 0.0018);
      const col = st.isHome ? "0,200,255" : sys.security >= 0.6 ? "0,200,255" : sys.security >= 0.3 ? "200,200,255" : "255,100,100";
      ctx.save();
      ctx.globalAlpha = zoneAlpha * spulse;
      ctx.strokeStyle = `rgba(${col},${zoneAlpha * spulse})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([10, 10]);
      ctx.beginPath(); ctx.arc(st.x, st.y, safeR, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    const R = st.radius;
    const anchorY = st.y + (st.isHome ? R * 1.85 : R * 1.6);

    if (st.isProcessingHub) {
      // Collection radius ring for hub (orange)
      const collectR = st.collectRadius ?? 220;
      const inCollect = dst(player.x, player.y, st.x, st.y) < collectR + 60;
      ctx.save();
      ctx.strokeStyle = inCollect ? "rgba(255,160,40,0.55)" : "rgba(200,100,20,0.18)";
      ctx.lineWidth = inCollect ? 1.5 : 1;
      ctx.setLineDash([8, 10]);
      ctx.beginPath(); ctx.arc(st.x, st.y, collectR, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      worldText(st.x, anchorY, "[F] Processing Hub", {
        font: `bold 10px ${getUIFont()}`,
        fill: "#ffaa44",
        offsetY: 28,
        shadow: true,
      });
    } else {
      // Dock range ring
      const dockReady = inRange && !locked;
      ctx.strokeStyle = dockReady ? "rgba(0,255,100,0.4)" : "rgba(0,180,80,0.10)";
      ctx.lineWidth = dockReady ? 1.5 : 1;
      if (!dockReady) ctx.setLineDash([5, 8]);
      ctx.beginPath(); ctx.arc(st.x, st.y, dockR, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);

      // Label + dock prompt
      if (inRange) {
        worldText(st.x, anchorY, locked ? "◉ LOCKED" : "[F] Dock", {
          font: `bold 10px ${getUIFont()}`,
          fill: locked ? "#ff5555" : "#5fe0ff",
          offsetY: 28,
          shadow: true,
        });
      }
    }
  }
}

export function drawStationTurrets(now: number, sys: System) {
  if (!sys?.stations) return;
  for (const st of sys.stations) {
    if (!st.turrets || !st.turrets.length) continue;
    if (!isVisible(st.x, st.y, 300)) continue;

    // Subtle orbital ring connecting turrets
    const orbitR = st.turrets[0]?.orbitRadius ?? (st.safeRadius ?? 600);
    ctx.save();
    ctx.strokeStyle = "rgba(130,130,140,0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(st.x, st.y, orbitR, 0, TAU); ctx.stroke();
    ctx.restore();

    for (const t of st.turrets) {
      const tx = t.x ?? 0, ty = t.y ?? 0;
      if (!isVisible(tx, ty, 40)) continue;
      const face = t.faceAngle ?? t.angle;
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(face);

      // Glow
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 18);
      glow.addColorStop(0, "rgba(40,100,140,0.25)");
      glow.addColorStop(1, "rgba(40,100,140,0)");
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(0, 0, 18, 0, TAU); ctx.fill();

      // Platform
      ctx.fillStyle = "#152838";
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.fill();
      ctx.strokeStyle = "#3a80a0"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.stroke();

      // Barrel
      ctx.fillStyle = "#5ab0d0";
      ctx.fillRect(3, -2.5, 14, 5);
      ctx.fillStyle = "#a0e0ff";
      ctx.fillRect(14, -2, 4, 4);

      // Muzzle flash
      if (t.muzzleFlash !== undefined && t.muzzleFlash > 0) {
        t.muzzleFlash -= 1 / 60;
        const fa = Math.max(0, t.muzzleFlash / 0.08);
        ctx.globalAlpha = fa;
        const mg = ctx.createRadialGradient(18, 0, 0, 18, 0, 16);
        mg.addColorStop(0, "rgba(180,240,255,0.95)");
        mg.addColorStop(1, "rgba(60,160,220,0)");
        ctx.fillStyle = mg;
        ctx.beginPath(); ctx.arc(18, 0, 16, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
      }

      ctx.restore();
    }
  }
}
