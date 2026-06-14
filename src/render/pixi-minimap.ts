/**
 * PixiJS Minimap Renderer
 * 
 * Replaces Canvas 2D minimap with GPU-accelerated PixiJS version.
 * Minimap renders to its own dedicated canvas element in the DOM.
 */
import { Application, Container, Graphics, Text, TextStyle } from "pixi.js";
import { getState } from "../state-access.js";
import { Client } from "../state.js";
import { TAU, HUD_MINIMAP_SIZE } from "../constants.js";
import { dst } from "../utils/math.js";
import { curSys, liveEnemies, liveAsteroids } from "../utils/game.js";
import { SHIPS } from "../data/ships.js";
import { getPassiveScanRangePx } from "../targeting.js";
import { getTutorialGuideTarget } from "./pixi-tutorial-markers.js";
import { shouldShowWarpGate } from "../data/tutorial.js";
import { getSunWorldPos, clampMinimapBlip } from "../utils/sun-position.js";
import { radarPingOpacity, radarSignatureDecayExponent, radarSweepAngle } from "../utils/radar-sweep.js";
import { getUIFont } from "./ui-font.js";
import { getThemeColors } from "../data/settings.js";

let mmApp: Application | null = null;
let mmContainer: Container | null = null;
let mmCanvas: HTMLCanvasElement | null = null;
let mmGfx: Graphics | null = null;
let mmSweepGfx: Graphics | null = null;
let cachedThemeKey = "";
let cachedHudBorder = 0x37556e;
let cachedHudBorderSoft = 0x283746;
let cachedHudBgDeep = 0x02050a;
let cachedThemeDanger = 0xee4444;
let cachedThemeShield = 0x44ccff;
let cachedThemePositive = 0x66ff88;
let cachedThemeAccent = 0xffcc44;
let cachedThemeHull = 0xee9944;
let cachedThemeTextBright = 0xcfe0f5;
let lastMinimapRenderMs = 0;
let mmInitInFlight = false;

function getMinimapFrameMs(): number {
  const fpsLimit = Client.settings?.fpsLimit ?? 0;
  if (!Number.isFinite(fpsLimit) || fpsLimit <= 0) return 0;
  return 1000 / fpsLimit;
}

function colorToHex(color: string): number {
  const trimmed = color.trim();
  if (trimmed.startsWith("rgb")) {
    const match = trimmed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
    if (match) return (parseInt(match[1], 10) << 16) | (parseInt(match[2], 10) << 8) | parseInt(match[3], 10);
  }
  if (trimmed.startsWith("#")) {
    return parseInt(trimmed.replace("#", "0x"), 16);
  }
  return 0x37556e;
}

function syncThemeColors(): void {
  const comp = getComputedStyle(document.documentElement);
  const hudBorderStr = comp.getPropertyValue("--hud-border").trim() || "rgba(55, 85, 110, 0.65)";
  const hudBorderSoftStr = comp.getPropertyValue("--hud-border-soft").trim() || "rgba(40, 55, 70, 0.5)";
  const hudBgDeepStr = comp.getPropertyValue("--hud-bg-deep").trim() || "rgba(2, 5, 10, 0.92)";
  const key = `${hudBorderStr}|${hudBorderSoftStr}|${hudBgDeepStr}`;
  if (key === cachedThemeKey) return;
  cachedThemeKey = key;
  cachedHudBorder = colorToHex(hudBorderStr);
  cachedHudBorderSoft = colorToHex(hudBorderSoftStr);
  cachedHudBgDeep = colorToHex(hudBgDeepStr);

  const theme = getThemeColors(Client.settings?.theme || "default");
  cachedThemeDanger = colorToHex(theme.danger);
  cachedThemeShield = colorToHex(theme.shield);
  cachedThemePositive = colorToHex(theme.positive);
  cachedThemeAccent = colorToHex(theme.accent);
  cachedThemeHull = colorToHex(theme.hull);
  cachedThemeTextBright = colorToHex(theme.textBright);
}

export function initPixiMinimap(): void {
  const container = document.getElementById("hud-minimap");
  if (!container) return;
  if (mmApp && mmContainer && mmCanvas) {
    if (!mmCanvas.isConnected) {
      container.innerHTML = "";
      container.appendChild(mmCanvas);
    }
    return;
  }
  if (mmInitInFlight) return;

  mmInitInFlight = true;
  mmApp = new Application();
  mmApp.init({
    width: HUD_MINIMAP_SIZE,
    height: HUD_MINIMAP_SIZE,
    background: 0x000000,
    backgroundAlpha: 1,
    antialias: Client.settings?.antialias ?? false,
    autoStart: false,
  }).then(() => {
    mmInitInFlight = false;
    const appInstance = mmApp;
    // `appInstance.canvas` is a getter that dereferences `appInstance.renderer`;
    // checking it directly throws when the renderer failed to initialize. Guard
    // on the renderer first, then the canvas getter is safe.
    if (!appInstance || !appInstance.renderer) return;
    mmCanvas = appInstance.canvas as HTMLCanvasElement;
    mmCanvas.style.width = `${HUD_MINIMAP_SIZE}px`;
    mmCanvas.style.height = `${HUD_MINIMAP_SIZE}px`;
    container.innerHTML = "";
    container.appendChild(mmCanvas);

    mmContainer = new Container();
    appInstance.stage.addChild(mmContainer);

    mmGfx = new Graphics();
    mmContainer.addChild(mmGfx);

    mmSweepGfx = new Graphics();
    mmContainer.addChild(mmSweepGfx);

    // Mask removed: all drawing is already clipped to the circle by range checks
    // and the background circle bounds, so stencil testing per blip is unnecessary.
  }).catch((err) => {
    mmInitInFlight = false;
    // Minimap is non-critical HUD chrome — degrade gracefully if its renderer
    // fails to initialize rather than crashing boot with an unhandled rejection.
    console.warn("Pixi minimap failed to initialize:", err);
    mmApp = null;
  });
}

export function destroyPixiMinimap(): void {
  mmInitInFlight = false;
  if (mmCanvas?.parentElement) {
    mmCanvas.parentElement.removeChild(mmCanvas);
  }
  if (mmApp) {
    mmApp.destroy(true, { children: true, texture: false });
  }
  mmApp = null;
  mmContainer = null;
  mmCanvas = null;
  mmGfx = null;
  mmSweepGfx = null;
  cachedThemeKey = "";
  lastMinimapRenderMs = 0;
}

const MINIMAP_MAX_FPS = 16; // cap minimap to ~16 FPS to save frame budget
const MINIMAP_MIN_FRAME_MS = 1000 / MINIMAP_MAX_FPS;

export function syncPixiMinimap(now: number): void {
  if (!mmApp || !mmContainer || !mmCanvas) return;
  const frameMs = getMinimapFrameMs();
  const minMs = frameMs > 0 ? Math.max(frameMs, MINIMAP_MIN_FRAME_MS) : MINIMAP_MIN_FRAME_MS;
  if (now - lastMinimapRenderMs < minMs - 0.5) return;
  lastMinimapRenderMs = now;

  const state = getState();
  const player = state.player;
  if (!player) {
    mmContainer.visible = false;
    mmApp.render();
    return;
  }
  mmContainer.visible = true;
  if (!mmGfx || !mmSweepGfx) return;
  const g = mmGfx;
  const sweepGfx = mmSweepGfx;
  g.clear();
  sweepGfx.clear();

  const mmW = HUD_MINIMAP_SIZE;
  const mmH = HUD_MINIMAP_SIZE;
  const mmX = mmW / 2;
  const mmY = mmH / 2;

  const ship = SHIPS[player.shipId];
  const range = getPassiveScanRangePx(ship);
  const scale = (mmH / 2) / range;

  syncThemeColors();

  // Background circle + border
  const mmRadius = mmW / 2 - 1;
  g.circle(mmX, mmY, mmRadius);
  g.fill({ color: cachedHudBgDeep, alpha: 0.35 });
  g.stroke({ color: cachedHudBorder, width: 1.5, alpha: 0.65 });

  // Radar range rings
  const maxRadarR = mmW / 2 - 2;
  g.circle(mmX, mmY, maxRadarR * 0.35);
  g.stroke({ color: cachedHudBorderSoft, width: 1, alpha: 0.35 });
  g.circle(mmX, mmY, maxRadarR * 0.70);
  g.stroke({ color: cachedHudBorderSoft, width: 1, alpha: 0.35 });
  // Outer dashed ring (approximated with lower alpha since PixiJS has no setLineDash)
  g.circle(mmX, mmY, maxRadarR);
  g.stroke({ color: cachedHudBorder, width: 1, alpha: 0.28 });

  // Radar sweep
  const sweepAngle = radarSweepAngle(now);
  sweepGfx.moveTo(mmX, mmY);
  sweepGfx.arc(mmX, mmY, maxRadarR, sweepAngle - 0.38, sweepAngle);
  sweepGfx.closePath();
  sweepGfx.fill({ color: cachedHudBorder, alpha: 0.14 });

  // Sweep line
  g.moveTo(mmX, mmY);
  g.lineTo(mmX + Math.cos(sweepAngle) * maxRadarR, mmY + Math.sin(sweepAngle) * maxRadarR);
  g.stroke({ color: cachedHudBorder, width: 1.2, alpha: 0.45 });

  const pingOpacity = (px: number, py: number, signatureRadius?: number): number =>
    radarPingOpacity(px, py, mmX, mmY, sweepAngle, radarSignatureDecayExponent(signatureRadius));

  const drawPassiveBlip = (
    px: number,
    py: number,
    signatureRadius: number,
    draw: (opacity: number) => void,
  ) => {
    if (Math.hypot(px - mmX, py - mmY) > maxRadarR + 1) return;
    const opacity = pingOpacity(px, py, signatureRadius);
    if (opacity < 0.14) return;
    draw(opacity);
  };

  // Asteroids
  for (const a of liveAsteroids(player)) {
    if (dst(player.x, player.y, a.x, a.y) > range) continue;
    const px = mmX + (a.x - player.x) * scale;
    const py = mmY + (a.y - player.y) * scale;
    drawPassiveBlip(px, py, a.radius * 2, (opacity) => {
      g.circle(px, py, 2);
      g.fill({ color: cachedThemeHull, alpha: opacity });
    });
  }

  // Enemies
  for (const e of liveEnemies(player)) {
    if (dst(player.x, player.y, e.x, e.y) > range) continue;
    const px = mmX + (e.x - player.x) * scale;
    const py = mmY + (e.y - player.y) * scale;
    drawPassiveBlip(px, py, e.sigRadius ?? 30, (opacity) => {
      const angle = e.angle ?? 0;
      const size = 4;
      const tipX = px + Math.cos(angle) * size;
      const tipY = py + Math.sin(angle) * size;
      const baseAng = angle + Math.PI;
      const half = size * 0.7;
      g.moveTo(tipX, tipY);
      g.lineTo(px + Math.cos(baseAng + 0.5) * half, py + Math.sin(baseAng + 0.5) * half);
      g.lineTo(px + Math.cos(baseAng - 0.5) * half, py + Math.sin(baseAng - 0.5) * half);
      g.closePath();
      g.fill({ color: cachedThemeDanger, alpha: opacity });
    });
  }

  const sys = curSys();
  if (sys) {
    // Gates
    for (const gate of sys.gates) {
      if (!shouldShowWarpGate(gate, sys.idx, getState().player)) continue;
      const dist = dst(player.x, player.y, gate.x, gate.y);
      const alwaysShow = sys.idx === 0 && player.sysIdx === 0;
      if (!alwaysShow && dist > range) continue;
      let px = mmX + (gate.x - player.x) * scale;
      let py = mmY + (gate.y - player.y) * scale;
      if (alwaysShow && dist > range) {
        const clamped = clampMinimapBlip(px, py, mmX, mmY, maxRadarR - 3);
        px = clamped.x;
        py = clamped.y;
      }
      const drawGate = (opacity: number) => {
        g.moveTo(px, py - 5);
        g.lineTo(px + 5, py);
        g.lineTo(px, py + 5);
        g.lineTo(px - 5, py);
        g.closePath();
        g.fill({ color: cachedThemeShield, alpha: opacity });
      };
      if (alwaysShow && dist > range) {
        drawGate(0.72);
      } else {
        drawPassiveBlip(px, py, gate.radius * 2, drawGate);
      }
    }

    // Stations
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
        const sz = alwaysShow && dist > range ? 4 : 5;
        g.rect(px - sz / 2, py - sz / 2, sz, sz);
        g.fill({ color: cachedThemePositive, alpha: opacity });
      };
      if (alwaysShow && dist > range) {
        drawStation(0.75);
      } else {
        drawPassiveBlip(px, py, s.radius * 2, drawStation);
      }

      // Turrets
      if (s.turrets) {
        for (const t of s.turrets) {
          if (t.x === undefined || t.y === undefined) continue;
          if (dst(player.x, player.y, t.x, t.y) > range) continue;
          const tx = mmX + (t.x - player.x) * scale;
          const ty = mmY + (t.y - player.y) * scale;
          drawPassiveBlip(tx, ty, 80, (tOpacity) => {
            const tSize = 3;
            g.rect(tx - tSize, ty - 1, tSize * 2, 2);
            g.rect(tx - 1, ty - tSize, 2, tSize * 2);
            g.fill({ color: cachedThemeShield, alpha: tOpacity });
          });
        }
      }
    }

    // Planets
    for (const planet of sys.planets) {
      const dist = dst(player.x, player.y, planet.x, planet.y);
      const alwaysShow = player.tutorial?.active && sys.idx === 0;
      if (!alwaysShow && dist > range) continue;
      let px = mmX + (planet.x - player.x) * scale;
      let py = mmY + (planet.y - player.y) * scale;
      if (alwaysShow && dist > range) {
        const clamped = clampMinimapBlip(px, py, mmX, mmY, maxRadarR - 4);
        px = clamped.x;
        py = clamped.y;
      }
      const drawPlanet = (opacity: number) => {
        const radius = alwaysShow && dist > range ? 3.4 : Math.max(3.2, Math.min(5.4, planet.radius * scale));
        g.circle(px, py, radius);
        g.fill({ color: cachedThemeShield, alpha: opacity * 0.70 });
        if (planet.hasRing) {
          g.ellipse(px, py, radius * 1.85, radius * 0.72);
          g.stroke({ color: cachedThemeAccent, width: 1, alpha: opacity * 0.55 });
        }
      };
      if (alwaysShow && dist > range) {
        drawPlanet(0.78);
      } else {
        drawPassiveBlip(px, py, planet.radius * 2.5, drawPlanet);
      }
    }

    // Sun
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
        g.circle(sx, sy, alwaysSun && sunDist > range ? 3.5 : 4.5);
        g.fill({ color: cachedThemeAccent, alpha: opacity * sunAlpha });
      };
      if (alwaysSun && sunDist > range) drawSun(1);
      else drawPassiveBlip(sx, sy, 3000, drawSun);
    }

    // Detected signatures
    const contacts = player.detectedSignatures.filter((entry) => entry.systemId === player.sysIdx);
    for (const contact of contacts) {
      const distNorm = Math.max(0.18, Math.min(1, contact.confidence));
      const r = maxRadarR * distNorm;
      const ang = contact.bearingDeg * Math.PI / 180;
      const px = mmX + Math.cos(ang) * r;
      const py = mmY + Math.sin(ang) * r;
      drawPassiveBlip(px, py, Math.max(24, contact.signalStrength * 120), (sweepAlpha) => {
        const alpha = Math.min(0.95, (0.22 + contact.confidence * 0.68) * sweepAlpha);
        const dotRadius = contact.state === "resolved" ? 4.2 : 2.4 + contact.confidence * 2.2;
        const scanColor = (() => {
          const neutral = [118, 134, 146] as const;
          const target = contact.classification === "relic"
            ? ([255, 204, 68] as const)
            : contact.classification === "derelict"
              ? ([255, 142, 92] as const)
              : contact.classification === "resource"
                ? ([102, 216, 255] as const)
                : neutral;
          const mix = contact.classification === "unknown" ? 0 : Math.max(0, Math.min(1, (contact.confidence - 0.25) / 0.75));
          const r = Math.round(neutral[0] + (target[0] - neutral[0]) * mix);
          const g_ = Math.round(neutral[1] + (target[1] - neutral[1]) * mix);
          const b = Math.round(neutral[2] + (target[2] - neutral[2]) * mix);
          return (r << 16) | (g_ << 8) | b;
        })();
        g.circle(px, py, dotRadius);
        g.fill({ color: scanColor, alpha });
      });
    }
  }

  // Player heading triangle (center) — points in ship's facing direction.
  const phSize = 5;
  const phTipX = mmX + Math.cos(player.angle) * phSize;
  const phTipY = mmY + Math.sin(player.angle) * phSize;
  const phBase = player.angle + Math.PI;
  const phHalf = phSize * 0.7;
  g.moveTo(phTipX, phTipY);
  g.lineTo(mmX + Math.cos(phBase + 0.5) * phHalf, mmY + Math.sin(phBase + 0.5) * phHalf);
  g.lineTo(mmX + Math.cos(phBase - 0.5) * phHalf, mmY + Math.sin(phBase - 0.5) * phHalf);
  g.closePath();
  g.fill({ color: cachedThemeTextBright, alpha: 1 });

  // Tutorial guide
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
      const markerR = 5 + pulse;
      if (Math.hypot(gx - mmX, gy - mmY) + markerR <= maxRadarR) {
        g.circle(gx, gy, markerR);
        g.stroke({ color: cachedThemeAccent, width: 1.5, alpha: pulse * 0.9 });
        g.moveTo(gx, gy - 4);
        g.lineTo(gx + 4, gy);
        g.lineTo(gx, gy + 4);
        g.lineTo(gx - 4, gy);
        g.closePath();
        g.fill({ color: cachedThemeAccent, alpha: pulse });
      }
    }
  }

  // Velocity vector
  const vmag = Math.hypot(player.vx, player.vy), vmax = 600;
  if (vmag > 2) {
    const vLen = Math.min(vmag / vmax, 1) * (mmH / 2) * 0.8;
    const va = Math.atan2(player.vy, player.vx);
    g.moveTo(mmX, mmY);
    g.lineTo(mmX + Math.cos(va) * vLen, mmY + Math.sin(va) * vLen);
    g.stroke({ color: cachedThemeShield, width: 1.5, alpha: 0.6 });
  }

  mmApp.render();
}
