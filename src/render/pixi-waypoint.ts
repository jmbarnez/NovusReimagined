import { Graphics } from "pixi.js";
import { Client } from "../state.js";
import { getState } from "../state-access.js";
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

export function syncPixiWaypoint(now: number): void {
  const wp = Client.waypoint;
  const player = getState().player;
  if (!wp || !player || Client.settings.movementControlMode !== "waypoint") {
    waypointGfx?.clear();
    return;
  }
  const g = ensureWaypoint();
  if (!g) return;

  const pulse = 0.5 + 0.5 * Math.sin(now * 0.004);
  const sz = 8 + pulse * 2;

  g.clear();

  // Diamond marker
  g.moveTo(wp.x, wp.y - sz)
    .lineTo(wp.x + sz, wp.y)
    .lineTo(wp.x, wp.y + sz)
    .lineTo(wp.x - sz, wp.y)
    .closePath()
    .stroke({ color: 0x55aaff, width: 1.5, alpha: 0.5 + pulse * 0.3 });
  g.poly([
    wp.x, wp.y - sz,
    wp.x + sz, wp.y,
    wp.x, wp.y + sz,
    wp.x - sz, wp.y,
  ], true).fill({ color: 0x55aaff, alpha: 0.15 });

  // Line from player to waypoint
  g.moveTo(player.x, player.y)
    .lineTo(wp.x, wp.y)
    .stroke({ color: 0x55aaff, width: 1.5, alpha: 0.25 });
}

