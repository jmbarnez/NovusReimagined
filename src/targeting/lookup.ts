import { getState } from "../state-access.js";
import type { Enemy } from "../types/enemy.js";
import type { Player } from "../state.js";
export function isWreckPieceTarget(id: string): boolean {
  return typeof id === "string" && id.startsWith("piece-");
}

export function isAsteroidTarget(id: string): boolean {
  return typeof id === "string" && id.startsWith("ast-");
}

export function transversalVs(e: Enemy, p: Player = getState().player): number {
  const rx = e.x - p.x, ry = e.y - p.y;
  const r2 = rx * rx + ry * ry;
  if (r2 < 4) return 0;
  const rvx = (e.vx || 0) - p.vx, rvy = (e.vy || 0) - p.vy;
  return Math.abs(rx * rvy - ry * rvx) / Math.sqrt(r2);
}

