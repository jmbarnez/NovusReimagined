import { Client } from "../../state.js";
import { getState } from "../../state-access.js";
import { getThemeColors } from "../../data/settings.js";
import { curSys } from "../../utils/game.js";
import { getSunWorldPos } from "../../utils/sun-position.js";
import {
  computeSystemMapTransform,
  worldToMapScreen,
} from "../../ui/map-survey.js";
import { pixiMapState } from "./state.js";
import { rgbaToHex } from "./utils.js";
import { beginLabelFrame, endLabelFrame, setMapLabel } from "./labels.js";
import { syncMapWindowBounds } from "./viewport.js";
import { drawSectors } from "./sectors.js";
import { drawObjects } from "./objects.js";

let lastMapTransform: ReturnType<typeof computeSystemMapTransform> | null = null;

export { lastMapTransform };

export function syncPixiSystemMap(Wc: number, Hc: number, now: number): void {
  if (!pixiMapState.mapContainer || !pixiMapState.positioningContainer) return;

  const state = getState();
  const player = state.player;
  const sys = curSys();
  if (!player || !sys) {
    pixiMapState.positioningContainer.visible = false;
    return;
  }
  pixiMapState.positioningContainer.visible = true;
  beginLabelFrame();

  // Compute zoom/pan (shared for window and fallback paths)
  const zoom = Client.mapZoom || 1.0;
  const cx = Wc / 2;
  const cy = Hc / 2;
  const panX = Client.mapPanX + cx * (1 - zoom);
  const panY = Client.mapPanY + cy * (1 - zoom);
  syncMapWindowBounds(Wc, Hc);

  pixiMapState.mapContainer.scale.set(zoom);
  pixiMapState.mapContainer.position.set(panX, panY);

  const theme = getThemeColors(Client.settings?.theme || "default");
  const mapTransform = computeSystemMapTransform(Wc, Hc);
  Client.systemMapTransform = mapTransform;
  if (!mapTransform) return;

  const { scale } = mapTransform;
  const toMap = (mx: number, my: number) => worldToMapScreen(mx, my, mapTransform);

  lastMapTransform = mapTransform;

  // Background (drawn in positioningContainer space, unaffected by zoom/pan)
  if (pixiMapState.bgGfx) {
    pixiMapState.bgGfx.clear();
    const hex = rgbaToHex(theme.bgDeep);
    pixiMapState.bgGfx.rect(0, 0, Wc, Hc);
    pixiMapState.bgGfx.fill({ color: hex, alpha: 1.0 });
  }

  // Grid — draw over visible local bounds so pan/zoom don't leave gaps
  if (pixiMapState.gridGfx) {
    pixiMapState.gridGfx.clear();
    const gridAlpha = 0.25 + 0.05 * Math.sin(now * 0.001);
    const gridStep = 5000 * scale;
    const centerX = Wc / 2 - mapTransform.centerMx * scale;
    const centerY = Hc / 2 + 30 - mapTransform.centerMy * scale;

    const localLeft = -panX / zoom;
    const localTop = -panY / zoom;
    const localRight = (Wc - panX) / zoom;
    const localBottom = (Hc - panY) / zoom;

    pixiMapState.gridGfx.stroke({ color: rgbaToHex(theme.border), width: 1, alpha: gridAlpha });
    let startX = centerX % gridStep;
    if (startX < 0) startX += gridStep;
    let x = startX;
    while (x < localLeft) x += gridStep;
    for (; x < localRight; x += gridStep) {
      pixiMapState.gridGfx.moveTo(x, localTop);
      pixiMapState.gridGfx.lineTo(x, localBottom);
    }
    let startY = centerY % gridStep;
    if (startY < 0) startY += gridStep;
    let y = startY;
    while (y < localTop) y += gridStep;
    for (; y < localBottom; y += gridStep) {
      pixiMapState.gridGfx.moveTo(localLeft, y);
      pixiMapState.gridGfx.lineTo(localRight, y);
    }
    pixiMapState.gridGfx.stroke();
  }

  // Sectors
  const bounds = { baseX: 0, baseY: 0, width: Wc, height: Hc };
  drawSectors(toMap, bounds);

  // Star
  if (pixiMapState.starGfx) {
    pixiMapState.starGfx.clear();
    const sunWorld = getSunWorldPos(sys);
    const sp = toMap(sunWorld.x, sunWorld.y);
    const sysClass = sys.starClass ?? "G";

    // Glow
    pixiMapState.starGfx.circle(sp.x, sp.y, 14);
    pixiMapState.starGfx.fill({ color: rgbaToHex(theme.accent), alpha: 0.5 });

    // Core
    pixiMapState.starGfx.circle(sp.x, sp.y, 8);
    pixiMapState.starGfx.fill({ color: rgbaToHex(theme.accent), alpha: 1 });

    // Label
    setMapLabel("star:class", `${sysClass}-CLASS STAR`, "bold", sp.x, sp.y + 30, 1.0, rgbaToHex(theme.accent));
  }

  // Objects (asteroids, enemies, gates, stations)
  const playerMapPos = worldToMapScreen(player.x, player.y, mapTransform);
  drawObjects(toMap, scale, playerMapPos, now, sys, player);

  // Waypoint
  if (pixiMapState.waypointGfx) {
    pixiMapState.waypointGfx.clear();
  }
  if (pixiMapState.waypointGfx && Client.waypoint) {
    const wp = toMap(Client.waypoint.x, Client.waypoint.y);
    const ppLine = toMap(player.x, player.y);

    pixiMapState.waypointGfx.moveTo(ppLine.x, ppLine.y);
    pixiMapState.waypointGfx.lineTo(wp.x, wp.y);
    pixiMapState.waypointGfx.stroke({ color: rgbaToHex(theme.shield), width: 1.5, alpha: 0.55 });

    pixiMapState.waypointGfx.moveTo(wp.x, wp.y - 7);
    pixiMapState.waypointGfx.lineTo(wp.x + 7, wp.y);
    pixiMapState.waypointGfx.lineTo(wp.x, wp.y + 7);
    pixiMapState.waypointGfx.lineTo(wp.x - 7, wp.y);
    pixiMapState.waypointGfx.closePath();
    pixiMapState.waypointGfx.stroke({ color: rgbaToHex(theme.shield), width: 1.5, alpha: 0.85 });
  }

  // Player
  if (pixiMapState.playerGfx) {
    pixiMapState.playerGfx.clear();
    const pp = toMap(player.x, player.y);
    pixiMapState.playerGfx.circle(pp.x, pp.y, 4);
    pixiMapState.playerGfx.fill({ color: rgbaToHex(theme.textBright), alpha: 1 });
  }
  endLabelFrame();
}
