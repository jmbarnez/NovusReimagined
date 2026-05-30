import { getState } from "../../state-access.js";
import { TAU, HUD_MINIMAP_SIZE } from "../../constants.js";
import { dst } from "../../utils/math.js";
import { curSys, liveEnemies, liveAsteroids } from "../../utils/game.js";
import { SHIPS } from "../../data/ships.js";
import { getPassiveScanRangePx } from "../../targeting.js";
import { getTutorialGuideTarget } from "../pixi-tutorial-markers.js";
import { shouldShowWarpGate } from "../../data/tutorial.js";
import { getSunWorldPos, clampMinimapBlip } from "../../utils/sun-position.js";
import { radarPingOpacity, radarSweepAngle } from "../../utils/radar-sweep.js";

export function drawMinimap(mctx: CanvasRenderingContext2D, now: number) {
  const state = getState();
  const player = state.player;
  const mmW = HUD_MINIMAP_SIZE;
  const mmH = HUD_MINIMAP_SIZE;
  const mmLeft = 0;
  const mmTop = 0;
  const mmX = mmLeft + mmW / 2;
  const mmY = mmTop + mmH / 2;

  // Passive sensor range — local contacts only (not full sector).
  const ship = SHIPS[player.shipId];
  const range = getPassiveScanRangePx(ship);
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
  const scannerBlipColor = (
    classification: string,
    confidence: number,
    alpha: number,
  ) => {
    const neutral = [118, 134, 146] as const;
    const target = classification === "relic"
      ? ([255, 204, 68] as const)
      : classification === "derelict"
        ? ([255, 142, 92] as const)
        : classification === "resource"
          ? ([102, 216, 255] as const)
          : neutral;
    const mix = classification === "unknown" ? 0 : Math.max(0, Math.min(1, (confidence - 0.25) / 0.75));
    const r = Math.round(neutral[0] + (target[0] - neutral[0]) * mix);
    const g = Math.round(neutral[1] + (target[1] - neutral[1]) * mix);
    const b = Math.round(neutral[2] + (target[2] - neutral[2]) * mix);
    return `rgba(${r},${g},${b},${alpha})`;
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

  // Circular background, border and clipping path
  const mmRadius = mmW / 2 - 1;
  mctx.beginPath();
  mctx.arc(mmX, mmY, mmRadius, 0, TAU);
  mctx.fillStyle = colorMixTranslucent(hudBgDeep, 0.35);
  mctx.fill();
  mctx.strokeStyle = hudBorder;
  mctx.lineWidth = 1.5;
  mctx.stroke();
  mctx.clip();

  // Concentric radar range rings (35% / 70% of passive envelope)
  const maxRadarR = mmW / 2 - 2;
  mctx.strokeStyle = colorMixTranslucent(hudBorderSoft, 0.35);
  mctx.lineWidth = 1;
  mctx.beginPath(); mctx.arc(mmX, mmY, maxRadarR * 0.35, 0, TAU); mctx.stroke();
  mctx.beginPath(); mctx.arc(mmX, mmY, maxRadarR * 0.70, 0, TAU); mctx.stroke();
  mctx.strokeStyle = colorMixTranslucent(hudBorder, 0.28);
  mctx.setLineDash([3, 4]);
  mctx.beginPath(); mctx.arc(mmX, mmY, maxRadarR, 0, TAU); mctx.stroke();
  mctx.setLineDash([]);

  const sweepAngle = radarSweepAngle(now);
  const sweepGrad = mctx.createRadialGradient(mmX, mmY, 0, mmX, mmY, maxRadarR);
  sweepGrad.addColorStop(0, colorMixTranslucent(hudBorder, 0.14));
  sweepGrad.addColorStop(0.85, colorMixTranslucent(hudBorder, 0.05));
  sweepGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

  mctx.fillStyle = sweepGrad;
  mctx.beginPath();
  mctx.moveTo(mmX, mmY);
  mctx.arc(mmX, mmY, maxRadarR, sweepAngle - 0.38, sweepAngle);
  mctx.closePath();
  mctx.fill();

  mctx.strokeStyle = colorMixTranslucent(hudBorder, 0.45);
  mctx.lineWidth = 1.2;
  mctx.beginPath();
  mctx.moveTo(mmX, mmY);
  mctx.lineTo(mmX + Math.cos(sweepAngle) * maxRadarR, mmY + Math.sin(sweepAngle) * maxRadarR);
  mctx.stroke();

  const pingOpacity = (px: number, py: number): number =>
    radarPingOpacity(px, py, mmX, mmY, sweepAngle);

  const drawPassiveBlip = (
    px: number,
    py: number,
    draw: (opacity: number) => void,
  ) => {
    if (Math.hypot(px - mmX, py - mmY) > maxRadarR + 1) return;
    const opacity = pingOpacity(px, py);
    if (opacity < 0.14) return;
    draw(opacity);
  };

  for (const a of liveAsteroids()) {
    if (dst(player.x, player.y, a.x, a.y) > range) continue;
    const px = mmX + (a.x - player.x) * scale, py = mmY + (a.y - player.y) * scale;
    drawPassiveBlip(px, py, (opacity) => {
      mctx.fillStyle = `rgba(119, 85, 34, ${opacity})`;
      mctx.beginPath(); mctx.arc(px, py, 2, 0, TAU); mctx.fill();
    });
  }
  for (const e of liveEnemies()) {
    if (dst(player.x, player.y, e.x, e.y) > range) continue;
    const px = mmX + (e.x - player.x) * scale, py = mmY + (e.y - player.y) * scale;
    drawPassiveBlip(px, py, (opacity) => {
      mctx.fillStyle = `rgba(204, 34, 34, ${opacity})`;
      drawTriangle(px, py, e.angle ?? 0, 4);
    });
  }
  const sys = curSys();
  if (sys) {
    for (const g of sys.gates) {
      if (!shouldShowWarpGate(g, sys.idx, getState().player)) continue;
      if (dst(player.x, player.y, g.x, g.y) > range) continue;
      const px = mmX + (g.x - player.x) * scale, py = mmY + (g.y - player.y) * scale;
      drawPassiveBlip(px, py, (opacity) => {
        mctx.fillStyle = `rgba(68, 136, 255, ${opacity})`;
        drawDiamond(px, py, 5);
      });
    }
    for (const s of sys.stations) {
      const dist = dst(player.x, player.y, s.x, s.y);
      const alwaysShow = player.tutorial?.active && sys.idx === 0;
      if (!alwaysShow && dist > range) continue;
      let px = mmX + (s.x - player.x) * scale;
      let py = mmY + (s.y - player.y) * scale;
      if (alwaysShow && dist > range) {
        const clamped = clampMinimapBlip(px, py, mmX, mmY, maxRadarR - 3);
        px = clamped.x;
        py = clamped.y;
      }
      const drawStation = (opacity: number) => {
        mctx.fillStyle = `rgba(68, 255, 136, ${opacity})`;
        drawSquare(px, py, alwaysShow && dist > range ? 4 : 5);
      };
      if (alwaysShow && dist > range) {
        drawStation(0.75);
      } else {
        drawPassiveBlip(px, py, drawStation);
      }
      if (s.turrets) {
        for (const t of s.turrets) {
          if (t.x === undefined || t.y === undefined) continue;
          if (dst(player.x, player.y, t.x, t.y) > range) continue;
          const tx = mmX + (t.x - player.x) * scale;
          const ty = mmY + (t.y - player.y) * scale;
          drawPassiveBlip(tx, ty, (tOpacity) => {
            mctx.fillStyle = `rgba(102, 204, 255, ${tOpacity})`;
            drawCross(tx, ty, 3);
          });
        }
      }
    }

    const sun = getSunWorldPos(sys);
    const sunDist = dst(player.x, player.y, sun.x, sun.y);
    const alwaysSun = player.tutorial?.active && sys.idx === 0;
    if (alwaysSun || sunDist <= range) {
      let sx = mmX + (sun.x - player.x) * scale;
      let sy = mmY + (sun.y - player.y) * scale;
      if (alwaysSun && sunDist > range) {
        const clamped = clampMinimapBlip(sx, sy, mmX, mmY, maxRadarR - 4);
        sx = clamped.x;
        sy = clamped.y;
      }
      const sunAlpha = alwaysSun && sunDist > range ? 0.7 : 0.55;
      const drawSun = (opacity: number) => {
        mctx.fillStyle = `rgba(255, 210, 90, ${opacity * sunAlpha})`;
        mctx.beginPath();
        mctx.arc(sx, sy, alwaysSun && sunDist > range ? 3.5 : 4.5, 0, TAU);
        mctx.fill();
      };
      if (alwaysSun && sunDist > range) drawSun(1);
      else drawPassiveBlip(sx, sy, drawSun);
    }

    const contacts = player.detectedSignatures.filter((entry) => entry.systemId === player.sysIdx);
    for (const contact of contacts) {
      const distNorm = Math.max(0.18, Math.min(1, contact.confidence));
      const r = maxRadarR * distNorm;
      const ang = contact.bearingDeg * Math.PI / 180;
      const px = mmX + Math.cos(ang) * r;
      const py = mmY + Math.sin(ang) * r;
      drawPassiveBlip(px, py, (sweepAlpha) => {
        const alpha = Math.min(0.95, (0.22 + contact.confidence * 0.68) * sweepAlpha);
        const fill = scannerBlipColor(contact.classification, contact.confidence, alpha);
        const dotRadius = contact.state === "resolved" ? 4.2 : 2.4 + contact.confidence * 2.2;
        mctx.fillStyle = fill;
        mctx.beginPath();
        mctx.arc(px, py, dotRadius, 0, TAU);
        mctx.fill();
      });
    }
  }

  // Player heading triangle (center) — points in ship's facing direction.
  mctx.fillStyle = "#ffffff"; drawTriangle(mmX, mmY, player.angle, 5);

  if (player.tutorial?.active) {
    const guide = getTutorialGuideTarget();
    if (guide) {
      let gx = mmX + (guide.x - player.x) * scale;
      let gy = mmY + (guide.y - player.y) * scale;
      const pad = 5;
      const minX = pad, maxX = mmW - pad, minY = pad, maxY = mmH - pad;
      if (gx < minX || gx > maxX || gy < minY || gy > maxY) {
        const ang = Math.atan2(gy - mmY, gx - mmX);
        const cosA = Math.cos(ang), sinA = Math.sin(ang);
        let t = Infinity;
        if (cosA > 0.001) t = Math.min(t, (maxX - mmX) / cosA);
        if (cosA < -0.001) t = Math.min(t, (minX - mmX) / cosA);
        if (sinA > 0.001) t = Math.min(t, (maxY - mmY) / sinA);
        if (sinA < -0.001) t = Math.min(t, (minY - mmY) / sinA);
        if (t !== Infinity) {
          gx = mmX + cosA * t;
          gy = mmY + sinA * t;
        }
      }
      const pulse = 0.65 + 0.35 * Math.abs(Math.sin(now * 0.005));
      mctx.strokeStyle = `rgba(255, 221, 68, ${pulse * 0.9})`;
      mctx.lineWidth = 1.5;
      mctx.beginPath();
      mctx.arc(gx, gy, 5 + pulse, 0, TAU);
      mctx.stroke();
      mctx.fillStyle = `rgba(255, 221, 68, ${pulse})`;
      drawDiamond(gx, gy, 4);
    }
  }

  const vmag = Math.hypot(player.vx, player.vy), vmax = 600;
  if (vmag > 2) {
    const vLen = Math.min(vmag / vmax, 1) * (mmH / 2) * .8;
    const va = Math.atan2(player.vy, player.vx);
    mctx.strokeStyle = "rgba(100,200,255,0.6)"; mctx.lineWidth = 1.5;
    mctx.beginPath(); mctx.moveTo(mmX, mmY); mctx.lineTo(mmX + Math.cos(va) * vLen, mmY + Math.sin(va) * vLen); mctx.stroke();
  }
  mctx.restore();
}
