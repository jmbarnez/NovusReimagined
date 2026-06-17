import { Client } from "../../state.js";
import { getState } from "../../state-access.js";
import { curSys } from "../../utils/game.js";
import { computeDiscoveredMapBounds } from "../../world/map-discovery.js";
import type { System } from "../../types/system.js";
import type { SystemMapTransform } from "./types.js";

export function resetMapPan(): void {
  Client.mapPanX = 0;
  Client.mapPanY = 0;
  Client.mapDragging = false;
}

export function applyMapPanDrag(sx: number, sy: number, t: SystemMapTransform): void {
  const dx = sx - Client.mapDragLastSx;
  const dy = sy - Client.mapDragLastSy;
  Client.mapDragLastSx = sx;
  Client.mapDragLastSy = sy;
  Client.mapPanX -= dx / t.scale;
  Client.mapPanY -= dy / t.scale;
}

function computeMapBounds(sys: System) {
  const px = getState().player ? getState().player.x : 0;
  const py = getState().player ? getState().player.y : 0;
  return computeDiscoveredMapBounds(sys, px, py, getState().player);
}

export function computeSystemMapTransform(Wc: number, Hc: number): SystemMapTransform | null {
  const sys = curSys(getState().player);
  if (!sys) return null;
  const { mnX, mnY, mxX, myY } = computeMapBounds(sys);
  const scale = Math.min((Wc - 300) / (mxX - mnX || 1), (Hc - 130) / (myY - mnY || 1), 0.95);
  const centerMx = (getState().player ? getState().player.x : (mnX + mxX) / 2) + Client.mapPanX;
  const centerMy = (getState().player ? getState().player.y : (mnY + myY) / 2) + Client.mapPanY;
  return {
    mnX, mnY, mxX, myY, scale, Wc, Hc,
    centerMx,
    centerMy,
  };
}

export function worldToMapScreen(wx: number, wy: number, t: SystemMapTransform) {
  return {
    x: t.Wc / 2 + (wx - t.centerMx) * t.scale,
    y: t.Hc / 2 + 30 + (wy - t.centerMy) * t.scale,
  };
}

export function mapScreenToWorld(sx: number, sy: number, t: SystemMapTransform) {
  return {
    x: t.centerMx + (sx - t.Wc / 2) / t.scale,
    y: t.centerMy + (sy - (t.Hc / 2 + 30)) / t.scale,
  };
}
