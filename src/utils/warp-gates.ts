import type { Gate, System } from "../types/world.js";
import type { AutoTarget } from "../types/world.js";
import type { Player } from "../state.js";
import { getState } from "../state-access.js";
import { curSys } from "./game.js";

const WARP_GATE_APERTURE_FRACTION = 0.78;

export function isGateLockId(id: string): boolean {
  return id.startsWith("gate-") || id.startsWith("local|");
}

export function gateStableId(gate: Gate): string {
  if (gate.id) return gate.id;
  return `local|${gate.x}|${gate.y}|${gate.target.x}|${gate.target.y}`;
}

export function gateDestinationName(gate: Gate, galaxy: System[]): string {
  return gate.target.label;
}

export function gateWorldLabel(gate: Gate, galaxy: System[]): string {
  return `RETURN TO ${gate.target.label.toUpperCase()}`;
}

export function gateMapLabel(gate: Gate): string {
  return "RETURN GATE";
}

export function gateActivationRadius(gate: Gate): number {
  return gate.radius * WARP_GATE_APERTURE_FRACTION;
}

function closestPointTOnSegment(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 0.0001) return 0;
  return Math.max(0, Math.min(1, -((ax * dx + ay * dy) / lenSq)));
}

export function didCrossGateAperture(gate: Gate, player: Player): boolean {
  const gatePrevX = Number.isFinite(gate.px) ? gate.px : gate.x;
  const gatePrevY = Number.isFinite(gate.py) ? gate.py : gate.y;
  const prevX = player.px - gatePrevX;
  const prevY = player.py - gatePrevY;
  const curX = player.x - gate.x;
  const curY = player.y - gate.y;
  const moveX = curX - prevX;
  const moveY = curY - prevY;

  const r = gateActivationRadius(gate);
  const prevInside = prevX * prevX + prevY * prevY <= r * r;
  const curInside = curX * curX + curY * curY <= r * r;
  if (prevInside && curInside) return false;
  if (curInside) return true;

  const t = closestPointTOnSegment(prevX, prevY, curX, curY);
  const nearX = prevX + moveX * t;
  const nearY = prevY + moveY * t;
  return nearX * nearX + nearY * nearY <= r * r;
}

export function gateByLockId(id: string): Gate | null {
  const sys = curSys(getState().player);
  if (!sys) return null;
  return sys.gates.find((gate) => gateStableId(gate) === id) ?? null;
}

export function gateLockTarget(gate: Gate, galaxy: System[]): AutoTarget {
  return {
    id: gateStableId(gate),
    x: gate.x,
    y: gate.y,
    hp: 1,
    name: gateDestinationName(gate, galaxy),
    alive: true,
    sigRadius: gate.radius * 3,
    radius: gate.radius,
  };
}
