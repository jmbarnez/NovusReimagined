import { Graphics } from "pixi.js";
import { effectLayer, worldContainer } from "../pixi.js";

let waypointGfx: Graphics | null = null;

function ensureWaypoint(): Graphics | null {
  const layer = effectLayer ?? worldContainer;
  if (!layer) return null;
  if (!waypointGfx) {
    waypointGfx = new Graphics();
    waypointGfx.label = "waypoint";
    layer.addChild(waypointGfx);
  } else if (!waypointGfx.parent) {
    layer.addChild(waypointGfx);
  }
  return waypointGfx;
}

export function syncPixiWaypoint(_now: number): void {
  waypointGfx?.clear();
}

