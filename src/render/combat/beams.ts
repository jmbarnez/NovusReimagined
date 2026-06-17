/**
 * Standard weapon beam rendering.
 */
import { Graphics } from "pixi.js";
import { getState } from "../../state-access.js";
import type { System } from "../../types/system.js";
import {
  getRenderedPlayerTurretOrigin,
  getRenderedEnemyTurretOrigin,
  getPlayerTurretOrigin,
  getEnemyTurretOrigin,
} from "../../combat/turret-origin.js";

import { hexStringToNumber } from "../cache.js";

/** Re-anchor beam start to the rendered nose mount when it originated from a ship mount. */
function resolveBeamStart(x1: number, y1: number, alpha: number, sys: System, player: ReturnType<typeof getState>["player"]): { x: number; y: number } {
  if (player) {
    const playerMount = getPlayerTurretOrigin(player);
    if (Math.hypot(x1 - playerMount.x, y1 - playerMount.y) < 18) {
      return getRenderedPlayerTurretOrigin(alpha, player);
    }
  }
  for (const e of sys?._liveEnemies ?? []) {
    const enemyMount = getEnemyTurretOrigin(e);
    if (Math.hypot(x1 - enemyMount.x, y1 - enemyMount.y) < 18) {
      return getRenderedEnemyTurretOrigin(e, alpha);
    }
  }
  return { x: x1, y: y1 };
}

export function syncBeams(beamGfx: Graphics, alpha: number, sys: System): void {
  beamGfx.clear();
  const state = getState();

  if (state.beams) {
    for (const b of state.beams) {
      const colNum = hexStringToNumber(b.color);
      const start = resolveBeamStart(b.x1, b.y1, alpha, sys, state.player);

      // Outer soft glow layer
      beamGfx.moveTo(start.x, start.y).lineTo(b.x2, b.y2)
        .stroke({ color: colNum, width: b.width * 5.0, alpha: b.life * 0.35, cap: "round" });

      // Main core layer
      beamGfx.moveTo(start.x, start.y).lineTo(b.x2, b.y2)
        .stroke({ color: colNum, width: b.width, alpha: b.life * 0.95, cap: "round" });

      // High intensity white center
      beamGfx.moveTo(start.x, start.y).lineTo(b.x2, b.y2)
        .stroke({ color: 0xffffff, width: b.width * 0.35, alpha: b.life * 0.85, cap: "round" });

      const startPulse = Math.max(0, Math.min(1, b.life));
      beamGfx.circle(start.x, start.y, b.width * 2.2)
        .fill({ color: colNum, alpha: startPulse * 0.26 })
        .circle(start.x, start.y, Math.max(1, b.width * 0.7))
        .fill({ color: 0xffffff, alpha: startPulse * 0.36 });
      beamGfx.circle(b.x2, b.y2, b.width * 2.0)
        .fill({ color: colNum, alpha: startPulse * 0.18 });
    }
  }
}
