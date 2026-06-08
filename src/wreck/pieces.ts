import { getState } from "../state-access.js";
import { WRECK_PIECE_LINEAR_DRAG, WRECK_PIECE_ANGULAR_DRAG } from "../constants.js";
import { removeSensorLock } from "../targeting.js";
import { removeWreckPiece } from "../utils/entities.js";

export function updateWreckPieces(dt: number) {
  for (let i = getState().wreckPieces.length - 1; i >= 0; i--) {
    const p = getState().wreckPieces[i];
    p.age += dt;
    p.despawnTimer -= dt;
    if (p.despawnTimer <= 0) {
      removeSensorLock(p.id);
      removeWreckPiece(i);
      continue;
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.angle += p.angularVel * dt;
    const lin = Math.pow(WRECK_PIECE_LINEAR_DRAG, dt);
    p.vx *= lin;
    p.vy *= lin;
    p.angularVel *= Math.pow(WRECK_PIECE_ANGULAR_DRAG, dt);
    if (Math.abs(p.vx) < 0.5) p.vx = 0;
    if (Math.abs(p.vy) < 0.5) p.vy = 0;
    if (Math.abs(p.angularVel) < 0.05) p.angularVel = 0;

    p.bob += dt * 1.6;
    if (p.hitFlash > 0) p.hitFlash = Math.max(0, p.hitFlash - dt);
  }
}
