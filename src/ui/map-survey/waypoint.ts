import { Client } from "../../state.js";
import { getState } from "../../state-access.js";
import { bearingToPointDeg } from "../../scanning/index.js";
import type { SystemMapTransform } from "./types.js";
import { mapScreenToWorld, computeSystemMapTransform } from "./transform.js";

export function aimScannerAtMapPoint(sx: number, sy: number, Wc: number, Hc: number): boolean {
  const t = (Client.systemMapTransform as SystemMapTransform | null | undefined) ?? computeSystemMapTransform(Wc, Hc);
  if (!t) return false;
  const { x: wx, y: wy } = mapScreenToWorld(sx, sy, t);
  Client.mapScannerAngleDeg = bearingToPointDeg(getState().player.x, getState().player.y, wx, wy);
  return true;
}

export function setMapWaypointFromScreen(_sx: number, _sy: number, _Wc: number, _Hc: number): boolean {
  return false;
}
