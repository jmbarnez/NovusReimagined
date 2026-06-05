import { SHIPS } from "../data/ships.js";
import type { Player } from "../state.js";
import { C } from "../config/index.js";
import { addTrailSegment } from "./entities.js";

const EXHAUST_LIFE = 0.24;

export function emitShipExhaustSheets(p: Player, x: number, y: number, angle: number, afterburner: boolean): void {
  if (!afterburner) return;

  const ship = SHIPS[p.shipId];
  const nozzles = ship?.render.nozzleOffsets ?? [[-20, 0]];
  const radius = ship?.colRadius ?? 24;
  const width = Math.max(1.1, Math.min(1.8, radius * 0.06));
  const length = Math.max(6, Math.min(12, radius * 0.38));
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);

  for (const [nx, ny] of nozzles) {
    const nozzleX = x + ca * nx - sa * ny;
    const nozzleY = y + sa * nx + ca * ny;
    addTrailSegment({
      x: nozzleX - ca * length * 0.56,
      y: nozzleY - sa * length * 0.56,
      color: C.PHYSICS.SHIP.thrustTrailABColor,
      width,
      length,
      life: EXHAUST_LIFE,
      angle,
    });
  }
}
