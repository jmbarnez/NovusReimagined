import { type Player } from "../state.js";
import type { InputFrame } from "../sim/input.js";
import { setPlayerInput } from "../player/input-state.js";

export function isHeadlessServer(): boolean {
  return (globalThis as { IS_SERVER?: boolean }).IS_SERVER === true;
}

/** Bind per-player network input directly to the input-state store. */
export function bindPlayerNetInput(p: Player, frame: InputFrame | null | undefined): boolean {
  const id = p.netId ?? p.shipId;
  if (frame) {
    setPlayerInput(id, {
      space: !!frame.keys.space,
      w: !!frame.keys.w,
      a: !!frame.keys.a,
      s: !!frame.keys.s,
      d: !!frame.keys.d,
      boost: !!frame.keys.boost,
      warp: !!frame.keys.warp,
    }, { x: frame.mouseWorld.x, y: frame.mouseWorld.y });
  } else {
    setPlayerInput(id, {
      space: false, w: false, a: false, s: false, d: false, boost: false, warp: false,
    }, { x: p.x + Math.cos(p.angle) * 200, y: p.y + Math.sin(p.angle) * 200 });
  }
  p.waypoint = frame ? (frame.waypoint ? { ...frame.waypoint } : null) : (p.waypoint ?? null);
  p.navCommand = frame ? (frame.navCommand ? { ...frame.navCommand } : null) : (p.navCommand ?? null);
  p.movementControlMode = frame ? frame.movementControlMode : (p.movementControlMode ?? "direct");
  return !!frame;
}
