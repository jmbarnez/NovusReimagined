/**
 * PixiJS Maps Renderer
 *
 * Migrates Canvas 2D galaxy map and system map to PixiJS.
 * Includes grid, star, sectors, objects, and overlays.
 */
import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { Client } from "../state.js";
import { getState } from "../state-access.js";
import { app } from "../pixi.js";
import {
  computeSystemMapTransform,
  worldToMapScreen,
  systemsVisibleOnMap,
  isSectorDiscovered,
  drawMapSurveyOverlay,
  drawPassiveRadarOverlay,
  passiveContactOpacity,
} from "../ui/map-survey.js";
import { TAU } from "../constants.js";
import { getThemeColors } from "../data/settings.js";
import { curSys } from "../utils/game.js";
import { getUIFont } from "./ui-font.js";
import { shouldShowWarpGate, getCurrentTutorialStep } from "../data/tutorial.js";
import { drawTutorialTracksOnMap } from "./pixi-tutorial-track.js";
import { getSunWorldPos } from "../utils/sun-position.js";
import { C } from "../config/index.js";
import { TUTORIAL_LOCAL_REGIONS } from "../data/tutorial-layout.js";
import { dst } from "../utils/math.js";
import { getPassiveScanRangePx } from "../targeting.js";
import { SHIPS } from "../data/ships.js";

let mapContainer: Container | null = null;

// Graphics objects for different layers
let bgGfx: Graphics | null = null;
let gridGfx: Graphics | null = null;
let starGfx: Graphics | null = null;
let sectorGfx: Graphics | null = null;
let objectGfx: Graphics | null = null;
let waypointGfx: Graphics | null = null;
let playerGfx: Graphics | null = null;
let vignetteGfx: Graphics | null = null;
let labelContainer: Container | null = null;
let mapMask: Graphics | null = null;
let positioningContainer: Container | null = null;
let overlayGfx: Graphics | null = null;

/** Convert rgba(r,g,b,a) or #rrggbb string to PixiJS hex number. */
function rgbaToHex(color: string): number {
  color = color.trim();
  if (color.startsWith("rgba(")) {
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
    if (match) {
      const r = parseInt(match[1], 10);
      const g = parseInt(match[2], 10);
      const b = parseInt(match[3], 10);
      return (r << 16) | (g << 8) | b;
    }
  }
  if (color.startsWith("#")) {
    return parseInt(color.replace("#", "0x"), 16);
  }
  return 0x37556e; // fallback
}

// Text styles - created fresh each time to avoid null issues
function createNameStyle(): TextStyle {
  return new TextStyle({ fontFamily: getUIFont(), fontSize: 9, fill: "#ffffff", align: "center" });
}
function createSmallStyle(): TextStyle {
  return new TextStyle({ fontFamily: getUIFont(), fontSize: 8, fill: "#6688aa", align: "center" });
}
function createBoldStyle(): TextStyle {
  return new TextStyle({ fontFamily: getUIFont(), fontSize: 10, fontWeight: "bold", fill: "#ffffff", align: "center" });
}

// Cached state
let lastMapTransform: ReturnType<typeof computeSystemMapTransform> | null = null;

export { mapContainer, app, positioningContainer };

function syncMapWindowBounds(Wc: number, Hc: number): { baseX: number; baseY: number; width: number; height: number } {
  const winBody = document.getElementById("hud-win-body-map");
  if (!winBody || !app) {
    positioningContainer?.position.set(0, 0);
    if (mapMask) {
      mapMask.clear();
      mapMask.rect(0, 0, Wc, Hc);
      mapMask.fill({ color: 0xffffff });
    }
    return { baseX: 0, baseY: 0, width: Wc, height: Hc };
  }

  const rect = winBody.getBoundingClientRect();
  const pixiCanvas = app.canvas as HTMLCanvasElement;
  const pixiRect = pixiCanvas.getBoundingClientRect();
  const baseX = rect.left - pixiRect.left;
  const baseY = rect.top - pixiRect.top;

  positioningContainer?.position.set(baseX, baseY);
  if (mapMask) {
    mapMask.clear();
    mapMask.rect(0, 0, rect.width, rect.height);
    mapMask.fill({ color: 0xffffff });
  }

  return { baseX, baseY, width: rect.width, height: rect.height };
}

export function initPixiMaps(): void {
  if (!app) return;

  // Positioning container: handles screen placement and masking
  positioningContainer = new Container();
  positioningContainer.label = "map-positioning";
  positioningContainer.visible = false;
  app.stage.addChild(positioningContainer);

  // Map container: holds the actual map content with zoom/pan
  mapContainer = new Container();
  mapContainer.label = "map-content";
  positioningContainer.addChild(mapContainer);

  // Mask for clipping to window bounds (in positioningContainer space)
  mapMask = new Graphics();
  positioningContainer.addChild(mapMask);
  positioningContainer.mask = mapMask;

  // Background — in positioningContainer so zoom/pan don't affect it
  bgGfx = new Graphics();
  positioningContainer.addChildAt(bgGfx, 0);

  // Grid
  gridGfx = new Graphics();
  mapContainer.addChild(gridGfx);

  // Sectors/boundaries
  sectorGfx = new Graphics();
  mapContainer.addChild(sectorGfx);

  // Star
  starGfx = new Graphics();
  mapContainer.addChild(starGfx);

  // Objects (asteroids, enemies, gates, stations)
  objectGfx = new Graphics();
  mapContainer.addChild(objectGfx);

  // Waypoint
  waypointGfx = new Graphics();
  mapContainer.addChild(waypointGfx);

  // Player
  playerGfx = new Graphics();
  mapContainer.addChild(playerGfx);

  // Vignette
  vignetteGfx = new Graphics();
  mapContainer.addChild(vignetteGfx);

  // Labels container
  labelContainer = new Container();
  mapContainer.addChild(labelContainer);

  // Dynamic overlays (radar sweep, survey cone, tutorial tracks)
  overlayGfx = new Graphics();
  mapContainer.addChild(overlayGfx);

}

export function syncPixiSystemMap(Wc: number, Hc: number, now: number): void {
  if (!mapContainer || !positioningContainer) return;

  const state = getState();
  const player = state.player;
  const sys = curSys();
  if (!player || !sys) {
    positioningContainer.visible = false;
    return;
  }
  positioningContainer.visible = true;
  labelContainer?.removeChildren();

  // Compute zoom/pan (shared for window and fallback paths)
  const zoom = Client.mapZoom || 1.0;
  const cx = Wc / 2;
  const cy = Hc / 2;
  const panX = Client.mapPanX + cx * (1 - zoom);
  const panY = Client.mapPanY + cy * (1 - zoom);
  syncMapWindowBounds(Wc, Hc);

  mapContainer.scale.set(zoom);
  mapContainer.position.set(panX, panY);

  const theme = getThemeColors(Client.settings?.theme || "default");
  const mapTransform = computeSystemMapTransform(Wc, Hc);
  Client.systemMapTransform = mapTransform;
  if (!mapTransform) return;

  const { scale } = mapTransform;
  const toMap = (mx: number, my: number) => worldToMapScreen(mx, my, mapTransform);

  lastMapTransform = mapTransform;

  // Background (drawn in positioningContainer space, unaffected by zoom/pan)
  if (bgGfx) {
    bgGfx.clear();
    const hex = rgbaToHex(theme.bgDeep);
    bgGfx.rect(0, 0, Wc, Hc);
    bgGfx.fill({ color: hex, alpha: 1.0 });
  }

  // Grid — draw over visible local bounds so pan/zoom don't leave gaps
  if (gridGfx) {
    gridGfx.clear();
    const gridAlpha = 0.25 + 0.05 * Math.sin(now * 0.001);
    const gridStep = 5000 * scale;
    const centerX = Wc / 2 - mapTransform.centerMx * scale;
    const centerY = Hc / 2 + 30 - mapTransform.centerMy * scale;

    const localLeft = -panX / zoom;
    const localTop = -panY / zoom;
    const localRight = (Wc - panX) / zoom;
    const localBottom = (Hc - panY) / zoom;

    gridGfx.stroke({ color: rgbaToHex(theme.border), width: 1, alpha: gridAlpha });
    let startX = centerX % gridStep;
    if (startX < 0) startX += gridStep;
    let x = startX;
    while (x < localLeft) x += gridStep;
    for (; x < localRight; x += gridStep) {
      gridGfx.moveTo(x, localTop);
      gridGfx.lineTo(x, localBottom);
    }
    let startY = centerY % gridStep;
    if (startY < 0) startY += gridStep;
    let y = startY;
    while (y < localTop) y += gridStep;
    for (; y < localBottom; y += gridStep) {
      gridGfx.moveTo(localLeft, y);
      gridGfx.lineTo(localRight, y);
    }
    gridGfx.stroke();
  }

  // Sectors
  if (sectorGfx) {
    sectorGfx.clear();

    // Tutorial local zone rings
    if (sys.idx === 0 && player.tutorial?.active) {
      for (const reg of TUTORIAL_LOCAL_REGIONS) {
        const p = toMap(reg.x, reg.y);
        const regR = reg.r * scale;
        sectorGfx.arc(p.x, p.y, regR, 0, TAU);
        sectorGfx.stroke({ color: 0x64a0dc, width: 1.2, alpha: 0.28 });

        // Label (add to label container)
        const text = new Text({ text: reg.name.toUpperCase(), style: createSmallStyle() });
        text.anchor.set(0.5, 0.5);
        text.position.set(p.x, p.y);
        text.style.fill = 0x64a0dc;
        text.alpha = 0.32;
        labelContainer?.addChild(text);
      }
    }

    // Concentric sector boundaries
    if (sys.idx >= 1) {
      const sectors = C.WORLD.CONCENTRIC.sectors;
      const C1 = sectors.find((s: { idx: number }) => s.idx === 1)!;
      const C2 = sectors.find((s: { idx: number }) => s.idx === 2)!;
      const C3 = sectors.find((s: { idx: number }) => s.idx === 3)!;
      const C4 = sectors.find((s: { idx: number }) => s.idx === 4)!;

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

      // Outer boundary
      sectorGfx.arc(sCenter.x, sCenter.y, sRadius, 0, TAU);
      sectorGfx.stroke({ color: 0x64a0dc, width: 2, alpha: 0.65 });

      // Voronoi edges
      sectorGfx.moveTo(sV142.x, sV142.y);
      sectorGfx.lineTo(sV123.x, sV123.y);
      sectorGfx.moveTo(sV123.x, sV123.y);
      sectorGfx.lineTo(sV134.x, sV134.y);
      sectorGfx.moveTo(sV134.x, sV134.y);
      sectorGfx.lineTo(sV142.x, sV142.y);
      sectorGfx.stroke({ color: 0x64a0dc, width: 1.5, alpha: 0.55 });

      // Sector labels
      for (const secConfig of sectors) {
        const sCenter = toMap(secConfig.x, secConfig.y);
        const discovered = isSectorDiscovered(secConfig.idx, player);
        const label = discovered ? secConfig.name.toUpperCase() : "?";
        const text = new Text({ text: label, style: createBoldStyle() });
        text.anchor.set(0.5, 0.5);
        text.position.set(sCenter.x, sCenter.y - 12);
        text.alpha = discovered ? 0.65 : 0.28;
        labelContainer?.addChild(text);
      }
    }
  }

  // Star
  if (starGfx) {
    starGfx.clear();
    const sunWorld = getSunWorldPos(sys);
    const sp = toMap(sunWorld.x, sunWorld.y);
    const sysClass = sys.starClass ?? "G";

    // Glow
    starGfx.arc(sp.x, sp.y, 14, 0, TAU);
    starGfx.fill({ color: rgbaToHex(theme.accent), alpha: 0.5 });

    // Core
    starGfx.arc(sp.x, sp.y, 8, 0, TAU);
    starGfx.fill({ color: rgbaToHex(theme.accent), alpha: 1 });

    // Label
    const text = new Text({ text: `${sysClass}-CLASS STAR`, style: createBoldStyle() });
    text.anchor.set(0.5, 0.5);
    text.position.set(sp.x, sp.y + 30);
    text.style.fill = rgbaToHex(theme.accent);
    labelContainer?.addChild(text);
  }

  // Objects (asteroids, enemies, gates, stations)
  if (objectGfx) {
    objectGfx.clear();

    const activeAndConcentricSystems = systemsVisibleOnMap(sys, player);
    const playerMapPos = worldToMapScreen(player.x, player.y, mapTransform);
    const passiveRange = getPassiveScanRangePx(SHIPS[player.shipId]);
    const inPassiveRange = (wx: number, wy: number) => dst(player.x, player.y, wx, wy) <= passiveRange;

    // Asteroids
    for (const sSys of activeAndConcentricSystems) {
      for (const a of sSys.asteroids) {
        if (a.depleted || a.hp <= 0 || !inPassiveRange(a.x, a.y)) continue;
        const p = toMap(a.x, a.y);
        const alpha = passiveContactOpacity(p.x, p.y, playerMapPos.x, playerMapPos.y, now, a.radius * 2);
        if (alpha < 0.14) continue;
        objectGfx.arc(p.x, p.y, Math.max(1.5, a.radius * scale), 0, TAU);
        objectGfx.fill({ color: rgbaToHex(theme.hull), alpha: Math.max(0.4, alpha) });
      }
    }

    // Enemies (triangles)
    for (const sSys of activeAndConcentricSystems) {
      for (const e of sSys.enemies) {
        if (!e.alive || !inPassiveRange(e.x, e.y)) continue;
        const p = toMap(e.x, e.y);
        const alpha = passiveContactOpacity(p.x, p.y, playerMapPos.x, playerMapPos.y, now, e.sigRadius ?? 30);
        if (alpha < 0.14) continue;
        const size = Math.max(4, (e.radius ?? 3) * scale || 4);
        const angle = e.angle ?? 0;

        objectGfx.moveTo(p.x + Math.cos(angle) * size, p.y + Math.sin(angle) * size);
        objectGfx.lineTo(p.x + Math.cos(angle + Math.PI + 0.5) * size * 0.7, p.y + Math.sin(angle + Math.PI + 0.5) * size * 0.7);
        objectGfx.lineTo(p.x + Math.cos(angle + Math.PI - 0.5) * size * 0.7, p.y + Math.sin(angle + Math.PI - 0.5) * size * 0.7);
        objectGfx.closePath();
        objectGfx.fill({ color: rgbaToHex(theme.danger), alpha: Math.max(0.5, alpha) });
      }
    }

    // Gates (diamonds)
    for (const sSys of activeAndConcentricSystems) {
      for (const g of sSys.gates) {
        if (!shouldShowWarpGate(g, sSys.idx, getState().player)) continue;
        if (!inPassiveRange(g.x, g.y)) continue;
        const p = toMap(g.x, g.y);
        const alpha = passiveContactOpacity(p.x, p.y, playerMapPos.x, playerMapPos.y, now, g.radius * 2);
        if (alpha < 0.14) continue;
        const size = Math.max(5, g.radius * scale || 6);

        objectGfx.moveTo(p.x, p.y - size);
        objectGfx.lineTo(p.x + size, p.y);
        objectGfx.lineTo(p.x, p.y + size);
        objectGfx.lineTo(p.x - size, p.y);
        objectGfx.closePath();
        objectGfx.fill({ color: rgbaToHex(theme.shield), alpha: Math.max(0.5, alpha) });

        const text = new Text({ text: "JUMP GATE", style: createNameStyle() });
        text.anchor.set(0.5, 0.5);
        text.position.set(p.x, p.y + size + 8);
        text.style.fill = rgbaToHex(theme.shield);
        text.alpha = alpha * 0.9;
        labelContainer?.addChild(text);
      }
    }

    // Stations (squares)
    for (const sSys of activeAndConcentricSystems) {
      for (const s of sSys.stations) {
        const isCurrentSys = sSys.idx === player.sysIdx;
        const inRange = inPassiveRange(s.x, s.y);
        let alpha = passiveContactOpacity(s.x, s.y, player.x, player.y, now, s.radius * 2);
        if (isCurrentSys) {
          alpha = Math.max(0.82, alpha);
        } else if (!inRange || alpha < 0.14) {
          continue;
        }
        const p = toMap(s.x, s.y);
        const size = Math.max(6, s.radius * scale || 8);

        objectGfx.rect(p.x - size / 2, p.y - size / 2, size, size);
        objectGfx.fill({ color: rgbaToHex(theme.positive), alpha: Math.max(0.5, alpha) });

        const text = new Text({ text: s.name, style: createBoldStyle() });
        text.anchor.set(0.5, 0.5);
        text.position.set(p.x, p.y + size + 10);
        text.style.fill = rgbaToHex(theme.positive);
        text.alpha = alpha * 0.9;
        labelContainer?.addChild(text);
      }
    }
  }

  // Waypoint
  if (waypointGfx) {
    waypointGfx.clear();
  }
  if (waypointGfx && Client.waypoint) {
    const wp = toMap(Client.waypoint.x, Client.waypoint.y);
    const ppLine = toMap(player.x, player.y);

    waypointGfx.moveTo(ppLine.x, ppLine.y);
    waypointGfx.lineTo(wp.x, wp.y);
    waypointGfx.stroke({ color: rgbaToHex(theme.shield), width: 1.5, alpha: 0.55 });

    waypointGfx.moveTo(wp.x, wp.y - 7);
    waypointGfx.lineTo(wp.x + 7, wp.y);
    waypointGfx.lineTo(wp.x, wp.y + 7);
    waypointGfx.lineTo(wp.x - 7, wp.y);
    waypointGfx.closePath();
    waypointGfx.stroke({ color: rgbaToHex(theme.shield), width: 1.5, alpha: 0.85 });
  }

  // Player
  if (playerGfx) {
    playerGfx.clear();
    const pp = toMap(player.x, player.y);
    playerGfx.arc(pp.x, pp.y, 4, 0, TAU);
    playerGfx.fill({ color: rgbaToHex(theme.textBright), alpha: 1 });
  }
}

export function drawPixiSystemMapCanvasOverlays(Wc: number, Hc: number, now: number): void {
  const player = getState().player;
  const sys = curSys();
  const mapTransform = lastMapTransform ?? computeSystemMapTransform(Wc, Hc);
  if (!player || !sys || !mapTransform || !overlayGfx) return;

  // syncMapWindowBounds is called inside syncPixiSystemMap to set positioningContainer.
  // The overlay Graphics lives inside mapContainer, which already has zoom/pan applied,
  // so we can draw in map-space coordinates directly.
  overlayGfx.clear();
  const navStep = player.tutorial?.active ? getCurrentTutorialStep(player) : null;
  if (navStep?.nav?.trackId) {
    drawTutorialTracksOnMap(overlayGfx, (wx, wy) => worldToMapScreen(wx, wy, mapTransform), navStep.nav.trackId);
  }
  drawPassiveRadarOverlay(mapTransform, now, overlayGfx);
  drawMapSurveyOverlay(mapTransform, now, overlayGfx);
}

export function destroyPixiMaps(): void {
  if (!mapContainer) return;

  if (bgGfx && positioningContainer) {
    positioningContainer.removeChild(bgGfx);
    bgGfx.destroy();
  }
  if (mapMask && positioningContainer) {
    positioningContainer.removeChild(mapMask);
    mapMask.destroy();
  }
  gridGfx?.destroy();
  starGfx?.destroy();
  sectorGfx?.destroy();
  objectGfx?.destroy();
  waypointGfx?.destroy();
  playerGfx?.destroy();
  vignetteGfx?.destroy();
  labelContainer?.destroy();
  overlayGfx?.destroy();

  if (positioningContainer && app) {
    app.stage.removeChild(positioningContainer);
    positioningContainer.destroy();
  }
  positioningContainer = null;
  mapContainer = null;
  mapMask = null;
  bgGfx = null;
  overlayGfx = null;
}
