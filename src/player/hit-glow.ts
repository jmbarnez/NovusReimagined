/**
 * Player hit-glow decay.  Kept in the player domain so it can use PlayerAccess.
 */
import { PlayerAccess } from "../state-access.js";
import type { Player } from "../state/types/index.js";

/** Decay shield / hull / structure hit glows for a single player tick. */
export function decayPlayerHitGlows(dt: number, p: Player): void {
  if (p.shieldHitGlow > 0) {
    PlayerAccess.setShieldHitGlow(p.shieldHitGlow - dt * 2.5, p);
    if (p.shieldHitGlow <= 0) {
      PlayerAccess.setShieldHitGlow(0, p);
      PlayerAccess.setShieldHitAngle(0, p);
    }
  }
  if (p.hullHitGlow > 0) {
    PlayerAccess.setHullHitGlow(p.hullHitGlow - dt * 3.0, p);
    if (p.hullHitGlow <= 0) {
      PlayerAccess.setHullHitGlow(0, p);
      PlayerAccess.setHullHitAngle(0, p);
    }
  }
  if ((p.structureHitGlow ?? 0) > 0) {
    PlayerAccess.setStructureHitGlow((p.structureHitGlow ?? 0) - dt * 3.0, p);
    if (p.structureHitGlow! <= 0) {
      PlayerAccess.setStructureHitGlow(0, p);
      PlayerAccess.setStructureHitAngle(0, p);
    }
  }
}
