/**
 * PixiJS HUD Core Renderer
 * 
 * Migrates Canvas 2D HUD elements to PixiJS for GPU-accelerated rendering:
 * - Central fighter HUD (horizon pitch line, flight box)
 * - Curved status arcs (speed, shield)
 * - Speed/shield labels
 * - Warning alarm banner
 * - Velocity prograde/retrograde drift vectors
 * - Target lead prediction text
 */
import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { Client } from "../state.js";
import { getState } from "../state-access.js";
import { screenContainer } from "../pixi.js";
import { getThemeColors } from "../data/settings.js";
import { getStats } from "../player/player-stats.js";
import { targetByLockId } from "../targeting.js";
import { dst } from "../utils/math.js";
import { getUIFont } from "./ui-font.js";

let hudContainer: Container | null = null;

// Graphics objects for HUD elements
let horizonLine: Graphics | null = null;
let speedArcBg: Graphics | null = null;
let speedArcFill: Graphics | null = null;
let shieldArcBg: Graphics | null = null;
let shieldArcFill: Graphics | null = null;
let driftVectors: Graphics | null = null;
let warningBanner: Text | null = null;
let targetLabel: Text | null = null;

// Text labels
let speedLabel: Text | null = null;
let shieldLabel: Text | null = null;

// Shared text styles
let speedStyle: TextStyle | null = null;
let shieldStyle: TextStyle | null = null;
let warningStyle: TextStyle | null = null;
let targetStyle: TextStyle | null = null;

// Cached values to avoid unnecessary updates
let lastSpeed = -1;
let lastShieldFrac = -1;
let lastIsCritical = false;
let lastZoom = 1;
let lastAngle = 0;

export function initPixiHUD(): void {
  if (!screenContainer) return;

  hudContainer = new Container();
  hudContainer.label = "hud-core";
  screenContainer.addChild(hudContainer);

  // Initialize graphics objects
  horizonLine = new Graphics();
  hudContainer.addChild(horizonLine);

  speedArcBg = new Graphics();
  hudContainer.addChild(speedArcBg);

  speedArcFill = new Graphics();
  hudContainer.addChild(speedArcFill);

  shieldArcBg = new Graphics();
  hudContainer.addChild(shieldArcBg);

  shieldArcFill = new Graphics();
  hudContainer.addChild(shieldArcFill);

  driftVectors = new Graphics();
  hudContainer.addChild(driftVectors);

  // Initialize text styles
  const font = getUIFont();
  speedStyle = new TextStyle({
    fontFamily: font,
    fontSize: 8,
    fill: "#ffffff",
  });
  shieldStyle = new TextStyle({
    fontFamily: font,
    fontSize: 8,
    fill: "#ffffff",
  });
  warningStyle = new TextStyle({
    fontFamily: font,
    fontSize: 9,
    fontWeight: "bold",
    fill: "#ff4444",
  });
  targetStyle = new TextStyle({
    fontFamily: font,
    fontSize: 9,
    fill: "#ffffff",
  });

  // Initialize text labels
  speedLabel = new Text({ text: "", style: speedStyle });
  speedLabel.anchor.set(1, 0.5);
  hudContainer.addChild(speedLabel);

  shieldLabel = new Text({ text: "", style: shieldStyle });
  shieldLabel.anchor.set(0, 0.5);
  hudContainer.addChild(shieldLabel);

  warningBanner = new Text({ text: "", style: warningStyle });
  warningBanner.anchor.set(0.5, 0.5);
  warningBanner.visible = false;
  hudContainer.addChild(warningBanner);

  targetLabel = new Text({ text: "", style: targetStyle });
  targetLabel.anchor.set(0, 0.5);
  targetLabel.visible = false;
  hudContainer.addChild(targetLabel);
}

export function refreshHudFonts(): void {
  const font = getUIFont();
  const scale = Client.settings?.fontScale ?? 1.0;
  if (speedStyle) { speedStyle.fontFamily = font; speedStyle.fontSize = 8 * scale; }
  if (shieldStyle) { shieldStyle.fontFamily = font; shieldStyle.fontSize = 8 * scale; }
  if (warningStyle) { warningStyle.fontFamily = font; warningStyle.fontSize = 9 * scale; }
  if (targetStyle) { targetStyle.fontFamily = font; targetStyle.fontSize = 9 * scale; }
}

export function syncPixiHUD(Wc: number, Hc: number, now: number): void {
  if (!hudContainer) return;

  const state = getState();
  const player = state.player;
  if (!player) {
    hudContainer.visible = false;
    return;
  }
  hudContainer.visible = true;

  const st = getStats(player);
  const theme = getThemeColors(Client.settings?.theme || "default");
  const cx = Wc / 2;
  const cy = Hc / 2;
  const z = Client.zoom;

  const maxShield = st.maxShield || 0;
  const shieldFrac = maxShield > 0 ? (player.shield || 0) / maxShield : 0;
  const isLowShield = maxShield > 0 && shieldFrac < 0.3;
  const isLowHull = (player.hp || 0) / (st.maxHp || 1) < 0.4;
  const isLowStruct = (player.structure || 0) / (player.maxStructure || 1) < 0.6;
  const isCritical = isLowHull || isLowStruct;

  // Visual dynamic reactive neon glitch jitter
  let gx = 0, gy = 0;
  if (isCritical && Math.random() < 0.22) {
    gx = (Math.random() - 0.5) * 2.5;
    gy = (Math.random() - 0.5) * 2.5;
  }

  // Update horizon pitch line
  if (horizonLine) {
    horizonLine.clear();
    horizonLine.position.set(cx + gx, cy + gy);
    horizonLine.rotation = player.angle;
    
    // Left wing bracket
    horizonLine.moveTo(-25 * z, 0);
    horizonLine.lineTo(-15 * z, 0);
    horizonLine.lineTo(-18 * z, 4 * z);
    // Right wing bracket
    horizonLine.moveTo(15 * z, 0);
    horizonLine.lineTo(25 * z, 0);
    horizonLine.lineTo(18 * z, 4 * z);
    // Central flight box
    horizonLine.rect(-3 * z, -3 * z, 6 * z, 6 * z);
    horizonLine.stroke({
      width: Math.max(1, 1.2 * z),
      color: isCritical ? 0xee4444 : parseInt(theme.textMain.replace("#", "0x"), 16),
      alpha: isCritical ? 0.45 : 0.35,
    });
  }

  // Update speed arc
  const speed = Math.hypot(player.vx, player.vy);
  const maxSpeed = st.maxSpeed || 1;
  const spdPct = Math.max(0, Math.min(1, speed / maxSpeed));
  const r = 38 * z;
  const span = 0.28 * Math.PI;
  const arcLineWidth = Math.max(1.5, Math.min(3, 2.0 * z));

  if (speedArcBg) {
    speedArcBg.clear();
    speedArcBg.position.set(cx + gx, cy + gy);
    speedArcBg.arc(0, 0, r, Math.PI - span, Math.PI + span);
    speedArcBg.stroke({
      color: parseInt(theme.textFaint.replace("#", "0x"), 16),
      width: arcLineWidth,
      alpha: 0.12,
    });
  }

  if (speedArcFill) {
    speedArcFill.clear();
    speedArcFill.position.set(cx + gx, cy + gy);
    speedArcFill.arc(0, 0, r, Math.PI + span, Math.PI + span - spdPct * (span * 2), true);
    speedArcFill.stroke({
      color: isCritical ? 0xee4444 : parseInt(theme.accent.replace("#", "0x"), 16),
      width: arcLineWidth,
      alpha: 0.85,
    });
  }

  // Update shield arc
  if (maxShield > 0) {
    if (shieldArcBg) {
      shieldArcBg.clear();
      shieldArcBg.position.set(cx + gx, cy + gy);
      shieldArcBg.arc(0, 0, r, -span, span);
      shieldArcBg.stroke({
        color: parseInt(theme.textFaint.replace("#", "0x"), 16),
        width: arcLineWidth,
        alpha: 0.12,
      });
    }

    if (shieldArcFill) {
      shieldArcFill.clear();
      shieldArcFill.position.set(cx + gx, cy + gy);
      shieldArcFill.arc(0, 0, r, span, span - shieldFrac * (span * 2), true);
      shieldArcFill.stroke({
        color: (isLowShield || isCritical) ? 0xee4444 : parseInt(theme.shield.replace("#", "0x"), 16),
        width: arcLineWidth,
        alpha: 0.85,
      });
    }
  } else {
    if (shieldArcBg) shieldArcBg.clear();
    if (shieldArcFill) shieldArcFill.clear();
  }

  // Update labels
  const labelColor = isCritical ? 0xee4444 : parseInt(theme.textMain.replace("#", "0x"), 16);
  const fontSize = Math.max(7, Math.min(10, 8 * z));

  if (speedLabel) {
    speedLabel.text = `${Math.round(speed)} m/s`;
    speedLabel.position.set(Math.round(cx - (r + 7) + gx), Math.round(cy + gy));
    speedLabel.style.fontSize = fontSize;
    speedLabel.style.fill = labelColor;
  }

  if (maxShield > 0 && shieldLabel) {
    shieldLabel.text = `${Math.round(shieldFrac * 100)}% SHD`;
    shieldLabel.position.set(Math.round(cx + (r + 7) + gx), Math.round(cy + gy));
    shieldLabel.style.fontSize = fontSize;
    shieldLabel.style.fill = (isLowShield || isCritical) ? 0xee4444 : labelColor;
  }

  // Update warning banner
  if (isLowStruct && warningBanner) {
    const alarmBlink = Math.floor(now / 150) % 2 === 0;
    warningBanner.visible = alarmBlink;
    warningBanner.text = "CRITICAL: STRUCTURE COMPROMISED";
    warningBanner.position.set(Math.round(cx), Math.round(cy - (r + 20)));
  } else if (warningBanner) {
    warningBanner.visible = false;
  }

  // Update drift vectors
  const speedMag = Math.hypot(player.vx, player.vy);
  if (speedMag > 5 && driftVectors) {
    driftVectors.clear();
    driftVectors.position.set(cx + gx, cy + gy);
    const vAngle = Math.atan2(player.vy, player.vx);
    const offsetDist = r + (12 + Math.min(speedMag * 0.04, 10)) * z;
    const cosA = Math.cos(vAngle);
    const sinA = Math.sin(vAngle);
    const mR = Math.max(1.8, Math.min(4, 2.5 * z));

    const rot = (lcx: number, lcy: number, dx: number, dy: number) => ({
      x: lcx + dx * cosA - dy * sinA,
      y: lcy + dx * sinA + dy * cosA,
    });

    // Prograde marker (coordinates local to the ship centre)
    const px = cosA * offsetDist;
    const py = sinA * offsetDist;

    driftVectors.circle(px, py, mR);
    // Fins — rotated by vAngle so they align with velocity
    const pL1 = rot(px, py, -mR, 0);
    const pL2 = rot(px, py, -mR * 2, 0);
    driftVectors.moveTo(pL1.x, pL1.y);
    driftVectors.lineTo(pL2.x, pL2.y);
    const pR1 = rot(px, py, mR, 0);
    const pR2 = rot(px, py, mR * 2, 0);
    driftVectors.moveTo(pR1.x, pR1.y);
    driftVectors.lineTo(pR2.x, pR2.y);
    const pU1 = rot(px, py, 0, -mR);
    const pU2 = rot(px, py, 0, -mR * 2);
    driftVectors.moveTo(pU1.x, pU1.y);
    driftVectors.lineTo(pU2.x, pU2.y);
    driftVectors.stroke({
      color: isCritical ? 0xee4444 : parseInt(theme.shield.replace("#", "0x"), 16),
      width: Math.max(1, 1.2 * z),
      alpha: isCritical ? 0.6 : 0.7,
    });

    // Retrograde marker
    const rx = -cosA * offsetDist;
    const ry = -sinA * offsetDist;
    driftVectors.circle(rx, ry, mR);
    // Cross lines — rotated by vAngle
    const rA1 = rot(rx, ry, -mR * 0.7, -mR * 0.7);
    const rA2 = rot(rx, ry, mR * 0.7, mR * 0.7);
    driftVectors.moveTo(rA1.x, rA1.y);
    driftVectors.lineTo(rA2.x, rA2.y);
    const rB1 = rot(rx, ry, -mR * 0.7, mR * 0.7);
    const rB2 = rot(rx, ry, mR * 0.7, -mR * 0.7);
    driftVectors.moveTo(rB1.x, rB1.y);
    driftVectors.lineTo(rB2.x, rB2.y);
    driftVectors.stroke({
      color: isCritical ? 0xee4444 : parseInt(theme.textDim.replace("#", "0x"), 16),
      width: Math.max(1, 1.2 * z),
      alpha: isCritical ? 0.4 : 0.45,
    });
  } else if (driftVectors) {
    driftVectors.clear();
    driftVectors.position.set(0, 0);
  }

  // Update target label
  const primaryId = player.targetLock?.id;
  if (primaryId && targetLabel) {
    const target = targetByLockId(primaryId, getState().player);
    if (target && target.hp > 0) {
      const targetSx = cx + (target.x - Client.camx) * Client.zoom;
      const targetSy = cy + (target.y - Client.camy) * Client.zoom;
      const targetRad = target.radius || 18;
      const bracketOffset = (targetRad + 9) * Client.zoom;
      const targetDist = Math.round(dst(player.x, player.y, target.x, target.y));
      
      targetLabel.text = `[${targetDist}m]`;
      targetLabel.position.set(Math.round(targetSx + bracketOffset + 5), Math.round(targetSy));
      targetLabel.style.fill = labelColor;
      targetLabel.visible = true;
    } else {
      targetLabel.visible = false;
    }
  } else if (targetLabel) {
    targetLabel.visible = false;
  }
}

export function destroyPixiHUD(): void {
  if (!hudContainer) return;
  
  if (horizonLine) { horizonLine.destroy(); horizonLine = null; }
  if (speedArcBg) { speedArcBg.destroy(); speedArcBg = null; }
  if (speedArcFill) { speedArcFill.destroy(); speedArcFill = null; }
  if (shieldArcBg) { shieldArcBg.destroy(); shieldArcBg = null; }
  if (shieldArcFill) { shieldArcFill.destroy(); shieldArcFill = null; }
  if (driftVectors) { driftVectors.destroy(); driftVectors = null; }
  if (warningBanner) { warningBanner.destroy(); warningBanner = null; }
  if (targetLabel) { targetLabel.destroy(); targetLabel = null; }
  if (speedLabel) { speedLabel.destroy(); speedLabel = null; }
  if (shieldLabel) { shieldLabel.destroy(); shieldLabel = null; }
  
  screenContainer?.removeChild(hudContainer);
  hudContainer.destroy();
  hudContainer = null;
}

