import type { Gate, System } from "../types/world.js";
import type { AutoTarget } from "../types/world.js";
import { getState } from "../state-access.js";
import { curSys } from "./game.js";

export function isLocalWarpGate(gate: Gate): boolean {
  return gate.target?.kind === "local";
}

export function isGateLockId(id: string): boolean {
  return id.startsWith("gate-") || id.startsWith("local|") || id.startsWith("system|");
}

export function gateStableId(gate: Gate): string {
  if (gate.id) return gate.id;
  if (gate.target?.kind === "local") {
    return `local|${gate.x}|${gate.y}|${gate.target.x}|${gate.target.y}`;
  }
  return `system|${gate.x}|${gate.y}|${gate.targetSysIdx ?? -1}`;
}

export function gateDestinationName(gate: Gate, galaxy: System[]): string {
  if (gate.target?.kind === "local") return gate.target.label;
  return galaxy[gate.targetSysIdx ?? -1]?.name ?? "Sector";
}

export function gateWorldLabel(gate: Gate, galaxy: System[]): string {
  if (gate.target?.kind === "local") return `RETURN TO ${gate.target.label.toUpperCase()}`;
  return galaxy[gate.targetSysIdx ?? -1]?.name ?? "Unknown Sector";
}

export function gateMapLabel(gate: Gate): string {
  return gate.target?.kind === "local" ? "RETURN GATE" : "JUMP GATE";
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
