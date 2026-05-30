import { Client } from "../../state.js";
import { getState } from "../../state-access.js";
import {
  computeSystemMapTransform,
  drawMapSurveyOverlay,
  drawPassiveRadarOverlay,
  mapSignatureOpacity,
  passiveContactOpacity,
  systemsVisibleOnMap,
  isSectorDiscovered,
  isLocalRegionDiscovered,
  updateMapSurveyUi,
  worldToMapScreen,
  type LocalRegionDef,
} from "../../ui/map-survey.js";
import { ctx } from "../../canvas.js";
import { TAU } from "../../constants.js";
import { getThemeColors } from "../../data/settings.js";
import { curSys } from "../../utils/game.js";
import { SHIPS } from "../../data/ships.js";
import { getUIFont } from "../ui-font.js";
import { shouldShowWarpGate, getCurrentTutorialStep } from "../../data/tutorial.js";
import { getSunWorldPos } from "../../utils/sun-position.js";
import { drawTutorialTracksOnMap } from "../pixi-tutorial-track.js";
import { C } from "../../config/index.js";
import { TUTORIAL_LOCAL_REGIONS } from "../../data/tutorial-layout.js";
import { dst } from "../../utils/math.js";
import { getPassiveScanRangePx } from "../../targeting.js";

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

export function drawSystemMap(Wc: number, Hc: number, now: number) {
  const state = getState();
  const player = state.player;
  const sys = curSys();
  if (!sys) return;

  const theme = getThemeColors(Client.settings?.theme || "default");

  const toTranslucent = (color: string, alpha: number): string => {
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

  const drawTriangle = (cx: number, cy: number, angle: number, size: number) => {
    const tipX = cx + Math.cos(angle) * size;
    const tipY = cy + Math.sin(angle) * size;
    const baseAng = angle + Math.PI;
    const half = size * 0.7;
    const blX = cx + Math.cos(baseAng + 0.5) * half;
    const blY = cy + Math.sin(baseAng + 0.5) * half;
    const brX = cx + Math.cos(baseAng - 0.5) * half;
    const brY = cy + Math.sin(baseAng - 0.5) * half;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY); ctx.lineTo(blX, blY); ctx.lineTo(brX, brY); ctx.closePath();
    ctx.fill();
  };

  const drawSquare = (cx: number, cy: number, size: number) => {
    const h = size / 2;
    ctx.fillRect(cx - h, cy - h, size, size);
  };

  const drawDiamond = (cx: number, cy: number, size: number) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy - size); ctx.lineTo(cx + size, cy);
    ctx.lineTo(cx, cy + size); ctx.lineTo(cx - size, cy);
    ctx.closePath();
    ctx.fill();
  };

  // Base background fill using theme colors
  ctx.fillStyle = toTranslucent(theme.bgDeep, 0.97);
  ctx.fillRect(0, 0, Wc, Hc);

  const mapTransform = computeSystemMapTransform(Wc, Hc);
  Client.systemMapTransform = mapTransform;
  if (!mapTransform) return;
  const { scale } = mapTransform;
  const toMap = (mx: number, my: number) => worldToMapScreen(mx, my, mapTransform);
  updateMapSurveyUi();

  // Draw grid lines with a subtle pulse animation
  const gridAlpha = 0.115 + 0.035 * Math.sin(now * 0.001);
  ctx.strokeStyle = toTranslucent(theme.border, gridAlpha);
  ctx.lineWidth = 1;
  const gridStep = 5000 * scale;
  const centerX = Wc / 2 - mapTransform.centerMx * scale;
  const centerY = Hc / 2 + 30 - mapTransform.centerMy * scale;
  ctx.beginPath();
  for (let x = centerX % gridStep; x < Wc; x += gridStep) { ctx.moveTo(x, 0); ctx.lineTo(x, Hc); }
  for (let y = centerY % gridStep; y < Hc; y += gridStep) { ctx.moveTo(0, y); ctx.lineTo(Wc, y); }
  ctx.stroke();

  const navStep = player.tutorial?.active ? getCurrentTutorialStep(player) : null;
  drawTutorialTracksOnMap(ctx, (wx, wy) => toMap(wx, wy), navStep?.nav?.trackId);

  // Draw Star at its world anchor (not sector origin — station may sit elsewhere)
  const sunWorld = getSunWorldPos(sys);
  const sp = toMap(sunWorld.x, sunWorld.y);
  const sysClass = sys.starClass ?? "G";
  ctx.save();
  ctx.fillStyle = theme.accent;
  ctx.shadowBlur = 24;
  ctx.shadowColor = theme.accent;
  ctx.beginPath();
  ctx.arc(sp.x, sp.y, 14, 0, TAU);
  ctx.fill();
  ctx.restore();

  ctx.font = `bold 11px ${getUIFont()}`;
  ctx.fillStyle = theme.accent;
  ctx.textAlign = "center";
  ctx.fillText(`${sysClass}-CLASS STAR`, sp.x, sp.y + 30);

  const activeAndConcentricSystems = systemsVisibleOnMap(sys, player);
  const playerMapPos = worldToMapScreen(player.x, player.y, mapTransform);
  const passiveRange = getPassiveScanRangePx(SHIPS[player.shipId]);
  const inPassiveRange = (wx: number, wy: number) => dst(player.x, player.y, wx, wy) <= passiveRange;
  const passiveAlpha = (wx: number, wy: number) => {
    const p = toMap(wx, wy);
    return passiveContactOpacity(p.x, p.y, playerMapPos.x, playerMapPos.y, now);
  };

  // Tutorial local zone rings (no outer sector boundary)
  if (sys.idx === 0 && player.tutorial?.active) {
    for (const reg of TUTORIAL_LOCAL_REGIONS) {
      const p = toMap(reg.x, reg.y);
      const regR = reg.r * scale;
      ctx.save();
      ctx.strokeStyle = "rgba(100, 160, 220, 0.28)";
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, regR, 0, TAU);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.font = `italic 8.5px ${getUIFont()}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(100, 160, 220, 0.32)";
      ctx.fillText(reg.name.toUpperCase(), p.x, p.y);
      ctx.restore();
    }
  }

  // Draw concentric sector boundary rings
  if (sys.idx >= 1) {
    const C1 = C.WORLD.CONCENTRIC.sectors.find(s => s.idx === 1)!;
    const C2 = C.WORLD.CONCENTRIC.sectors.find(s => s.idx === 2)!;
    const C3 = C.WORLD.CONCENTRIC.sectors.find(s => s.idx === 3)!;
    const C4 = C.WORLD.CONCENTRIC.sectors.find(s => s.idx === 4)!;

    const getCircumcenter = (
      p1: { x: number; y: number },
      p2: { x: number; y: number },
      p3: { x: number; y: number }
    ) => {
      const d = 2 * (p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y));
      if (Math.abs(d) < 0.0001) return { x: 0, y: 0 };

      const sq1 = p1.x * p1.x + p1.y * p1.y;
      const sq2 = p2.x * p2.x + p2.y * p2.y;
      const sq3 = p3.x * p3.x + p3.y * p3.y;

      const ux = (sq1 * (p2.y - p3.y) + sq2 * (p3.y - p1.y) + sq3 * (p1.y - p2.y)) / d;
      const uy = (sq1 * (p3.x - p2.x) + sq2 * (p1.x - p3.x) + sq3 * (p2.x - p1.x)) / d;
      return { x: ux, y: uy };
    };

    const V123 = getCircumcenter(C1, C2, C3);
    const V134 = getCircumcenter(C1, C3, C4);
    const V142 = getCircumcenter(C1, C4, C2);

    const sV123 = toMap(V123.x, V123.y);
    const sV134 = toMap(V134.x, V134.y);
    const sV142 = toMap(V142.x, V142.y);

    const sCenter = toMap(0, 0);
    const sRadius = 20000 * scale;

    // Draw the overall system limit boundary circle to close everything
    ctx.save();
    ctx.strokeStyle = "rgba(100, 160, 220, 0.42)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.arc(sCenter.x, sCenter.y, sRadius, 0, TAU);
    ctx.stroke();

    ctx.fillStyle = "rgba(100, 160, 220, 0.55)";
    ctx.font = `bold 9px ${getUIFont()}`;
    ctx.textAlign = "center";
    ctx.fillText("OUTER SYSTEM LIMIT BOUNDARY", sCenter.x, sCenter.y - sRadius - 10);
    ctx.restore();

    // Clip Voronoi lines inside the system border to close all cells completely
    ctx.save();
    ctx.beginPath();
    ctx.arc(sCenter.x, sCenter.y, sRadius, 0, TAU);
    ctx.clip();

    ctx.strokeStyle = "rgba(100, 160, 220, 0.35)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);

    // 1. Edge separating Core (1) and Inner Belt (2)
    ctx.beginPath();
    ctx.moveTo(sV142.x, sV142.y);
    ctx.lineTo(sV123.x, sV123.y);
    ctx.stroke();

    // 2. Edge separating Core (1) and Outer Belt (3)
    ctx.beginPath();
    ctx.moveTo(sV123.x, sV123.y);
    ctx.lineTo(sV134.x, sV134.y);
    ctx.stroke();

    // 3. Edge separating Core (1) and Deep Space (4)
    ctx.beginPath();
    ctx.moveTo(sV134.x, sV134.y);
    ctx.lineTo(sV142.x, sV142.y);
    ctx.stroke();

    // Outer Rays
    // 1. Edge separating Inner Belt (2) and Outer Belt (3)
    const dx23 = C2.x - C3.x;
    const dy23 = C2.y - C3.y;
    const px23 = -dy23;
    const py23 = dx23;
    const len23 = Math.hypot(px23, py23) || 1;
    const targetX23 = V123.x + (px23 / len23) * 50000;
    const targetY23 = V123.y + (py23 / len23) * 50000;
    const sTarget23 = toMap(targetX23, targetY23);

    ctx.beginPath();
    ctx.moveTo(sV123.x, sV123.y);
    ctx.lineTo(sTarget23.x, sTarget23.y);
    ctx.stroke();

    // 2. Edge separating Outer Belt (3) and Deep Space (4)
    const dx34 = C3.x - C4.x;
    const dy34 = C3.y - C4.y;
    const px34 = -dy34;
    const py34 = dx34;
    const len34 = Math.hypot(px34, py34) || 1;
    const targetX34 = V134.x + (px34 / len34) * 50000;
    const targetY34 = V134.y + (py34 / len34) * 50000;
    const sTarget34 = toMap(targetX34, targetY34);

    ctx.beginPath();
    ctx.moveTo(sV134.x, sV134.y);
    ctx.lineTo(sTarget34.x, sTarget34.y);
    ctx.stroke();

    // 3. Edge separating Deep Space (4) and Inner Belt (2)
    const dx42 = C4.x - C2.x;
    const dy42 = C4.y - C2.y;
    const px42 = -dy42;
    const py42 = dx42;
    const len42 = Math.hypot(px42, py42) || 1;
    const targetX42 = V142.x + (px42 / len42) * 50000;
    const targetY42 = V142.y + (py42 / len42) * 50000;
    const sTarget42 = toMap(targetX42, targetY42);

    ctx.beginPath();
    ctx.moveTo(sV142.x, sV142.y);
    ctx.lineTo(sTarget42.x, sTarget42.y);
    ctx.stroke();

    ctx.restore(); // remove clipping mask

    // Draw sector labels near their centers
    ctx.save();
    ctx.fillStyle = "rgba(100, 160, 220, 0.65)";
    ctx.font = `bold 10px ${getUIFont()}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const secConfig of C.WORLD.CONCENTRIC.sectors) {
      const sCenter = toMap(secConfig.x, secConfig.y);
      const discovered = isSectorDiscovered(secConfig.idx, player);
      ctx.globalAlpha = discovered ? 0.65 : 0.28;
      const label = discovered ? secConfig.name.toUpperCase() : "?";
      ctx.fillText(label, sCenter.x, sCenter.y - 12);
      ctx.font = `8px ${getUIFont()}`;
      ctx.fillStyle = discovered ? "rgba(100, 160, 220, 0.45)" : "rgba(100, 160, 220, 0.22)";
      if (discovered) {
        ctx.fillText(`(SEC ${secConfig.security.toFixed(1)})`, sCenter.x, sCenter.y + 2);
      }
      ctx.font = `bold 10px ${getUIFont()}`;
      ctx.fillStyle = "rgba(100, 160, 220, 0.65)";
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    ctx.save();
    ctx.font = `italic 8.5px ${getUIFont()}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const localRegs = C.WORLD.CONCENTRIC.localRegions as LocalRegionDef[];
    for (const reg of localRegs) {
      if (!isSectorDiscovered(reg.sectorIdx, player)) continue;
      const p = toMap(reg.x, reg.y);
      const discovered = isLocalRegionDiscovered(reg.id, player);
      ctx.fillStyle = discovered ? "rgba(100, 160, 220, 0.32)" : "rgba(100, 160, 220, 0.18)";
      ctx.fillText(discovered ? reg.name.toUpperCase() : "?", p.x, p.y);
    }
    ctx.restore();
  }

  drawPassiveRadarOverlay(mapTransform, now);

  // Draw asteroids (passive radar contacts only)
  ctx.fillStyle = toTranslucent(theme.hull, 0.65);
  for (const sSys of activeAndConcentricSystems) {
    for (const a of sSys.asteroids) {
      if (a.depleted || a.hp <= 0 || !inPassiveRange(a.x, a.y)) continue;
      const alpha = passiveAlpha(a.x, a.y);
      if (alpha < 0.14) continue;
      const p = toMap(a.x, a.y);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1.5, a.radius * scale), 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  // Draw enemies as direction-facing triangles
  ctx.fillStyle = theme.danger;
  for (const sSys of activeAndConcentricSystems) {
    for (const e of sSys.enemies) {
      if (!e.alive || !inPassiveRange(e.x, e.y)) continue;
      const alpha = passiveAlpha(e.x, e.y);
      if (alpha < 0.14) continue;
      const p = toMap(e.x, e.y);
      const size = Math.max(4, (e.radius ?? 3) * scale || 4);
      ctx.save();
      ctx.globalAlpha = alpha;
      drawTriangle(p.x, p.y, e.angle ?? 0, size);
      ctx.restore();
    }
  }

  // Draw gates as glowing diamonds
  ctx.fillStyle = theme.shield;
  ctx.shadowColor = theme.shield;
  for (const sSys of activeAndConcentricSystems) {
    for (const g of sSys.gates) {
      if (!shouldShowWarpGate(g, sSys.idx, getState().player)) continue;
      if (!inPassiveRange(g.x, g.y)) continue;
      const alpha = passiveAlpha(g.x, g.y);
      if (alpha < 0.14) continue;
      const p = toMap(g.x, g.y);
      const size = Math.max(5, g.radius * scale || 6);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowBlur = 6;
      drawDiamond(p.x, p.y, size);
      ctx.restore();
      ctx.font = `9px ${getUIFont()}`;
      ctx.fillStyle = theme.shield;
      ctx.textAlign = "center";
      ctx.globalAlpha = alpha * 0.9;
      ctx.fillText(`JUMP GATE`, p.x, p.y + size + 8);
      ctx.globalAlpha = 1;
    }
  }

  // Draw stations — always visible in the current system (navigation aid)
  ctx.fillStyle = theme.positive;
  ctx.shadowColor = theme.positive;
  for (const sSys of activeAndConcentricSystems) {
    for (const s of sSys.stations) {
      const isCurrentSys = sSys.idx === player.sysIdx;
      const inRange = inPassiveRange(s.x, s.y);
      let alpha = passiveAlpha(s.x, s.y);
      if (isCurrentSys) {
        alpha = Math.max(0.82, alpha);
      } else if (!inRange || alpha < 0.14) {
        continue;
      }
      const p = toMap(s.x, s.y);
      const size = Math.max(6, s.radius * scale || 8);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowBlur = 8;
      drawSquare(p.x, p.y, size);
      ctx.restore();
      ctx.font = `bold 10px ${getUIFont()}`;
      ctx.fillStyle = theme.positive;
      ctx.textAlign = "center";
      ctx.globalAlpha = alpha * 0.9;
      ctx.fillText(s.name, p.x, p.y + size + 10);
      ctx.globalAlpha = 1;
    }
  }

  // Draw resolved and detected hidden sites
  for (const sSys of activeAndConcentricSystems) {
    for (const site of sSys.hiddenSites || []) {
      if (site.state === "hidden" || site.state === "cleared") continue;
      const color = site.family === "relic" ? theme.accent : site.family === "derelict" ? theme.hull : theme.shield;

      if (site.state !== "resolved") {
        const contact = getState().player.detectedSignatures.find((entry) => entry.siteId === site.id && entry.systemId === site.systemId);
        const estX = contact ? contact.lastKnownX : site.x;
        const estY = contact ? contact.lastKnownY : site.y;

        let jitterX = 0;
        let jitterY = 0;
        if (contact) {
          const jitterAmp = contact.bearingErrorDeg * 4;
          jitterX = Math.sin((now / 150) + contact.driftPhase) * jitterAmp;
          jitterY = Math.cos((now / 150) + contact.driftPhase * 1.3) * jitterAmp;
        }

        const p = toMap(estX + jitterX, estY + jitterY);
        const sigAlpha = mapSignatureOpacity(p.x, p.y, playerMapPos.x, playerMapPos.y, now);
        if (sigAlpha < 0.08) continue;
        ctx.save();
        ctx.globalAlpha = sigAlpha;

        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 6);
        ctx.lineTo(p.x + 6, p.y);
        ctx.lineTo(p.x, p.y + 6);
        ctx.lineTo(p.x - 6, p.y);
        ctx.closePath();
        ctx.stroke();

        ctx.font = `9px ${getUIFont()}`;
        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.fillText("SIGNATURE", p.x, p.y + 16);

        if (contact) {
          ctx.font = `8px ${getUIFont()}`;
          ctx.fillText(`${Math.round(contact.progress * 100)}%`, p.x, p.y + 26);

          // Draw uncertainty circle (without jitter for stability)
          const pCenter = toMap(estX, estY);
          const distToEst = dst(player.x, player.y, estX, estY);
          const worldRad = distToEst * Math.sin(contact.bearingErrorDeg * Math.PI / 180);
          const mapRad = Math.max(12, worldRad * scale);

          ctx.save();
          ctx.strokeStyle = color;
          ctx.globalAlpha = 0.28;
          ctx.lineWidth = 1.0;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(pCenter.x, pCenter.y, mapRad, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
        ctx.restore();
      } else {
        const p = toMap(site.x, site.y);
        const sigAlpha = mapSignatureOpacity(p.x, p.y, playerMapPos.x, playerMapPos.y, now);
        if (sigAlpha < 0.08) continue;
        ctx.save();
        ctx.globalAlpha = sigAlpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 6);
        ctx.lineTo(p.x + 6, p.y);
        ctx.lineTo(p.x, p.y + 6);
        ctx.lineTo(p.x - 6, p.y);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.16;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.stroke();

        ctx.font = `9px ${getUIFont()}`;
        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.fillText(site.name, p.x, p.y + 16);
        ctx.restore();
      }
    }
  }

  drawMapSurveyOverlay(mapTransform, now);

  if (Client.waypoint) {
    const wp = worldToMapScreen(Client.waypoint.x, Client.waypoint.y, mapTransform);
    const ppLine = worldToMapScreen(player.x, player.y, mapTransform);
    ctx.save();
    ctx.strokeStyle = theme.shield;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 6]);
    ctx.beginPath();
    ctx.moveTo(ppLine.x, ppLine.y);
    ctx.lineTo(wp.x, wp.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = theme.shield;
    ctx.beginPath();
    ctx.moveTo(wp.x, wp.y - 7);
    ctx.lineTo(wp.x + 7, wp.y);
    ctx.lineTo(wp.x, wp.y + 7);
    ctx.lineTo(wp.x - 7, wp.y);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  // Draw player as a glowing circle
  const pp = toMap(player.x, player.y);
  ctx.save();
  ctx.fillStyle = theme.textBright;
  ctx.shadowColor = theme.textBright;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(pp.x, pp.y, 4, 0, TAU);
  ctx.fill();
  ctx.restore();

  // Subtle vignette overlay (dark edges, clear center)
  const cx = Wc / 2;
  const cy = Hc / 2;
  const outerR = Math.hypot(Wc, Hc) * 0.5;
  const vignette = ctx.createRadialGradient(cx, cy, outerR * 0.4, cx, cy, outerR);
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, toTranslucent(theme.bgDeep, 0.45));
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, Wc, Hc);
}
