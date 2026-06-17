import { dst } from "../utils/math.js";
import { transversalVs } from "../targeting.js";
import { C } from "../config/index.js";
import type { Player } from "../state.js";
import type { ModuleDef } from "../data/modules.js";
import type { WeaponProfile } from "../data/weaponProfiles.js";
import type { Enemy } from "../types/enemy.js";

/**
 * Combined turret hit quality in [0,1]: full at/inside optimal with zero
 * transversal, decaying past optimal (falloff) and with angular target motion
 * vs the turret's tracking speed (eased by a larger target signature).
 * Canonical CCP-style 0.5^(track² + range²).
 */
export function computeHitQuality(target: Enemy, turretMod: ModuleDef | null, wProf: WeaponProfile, p: Player): number {
  const dist = Math.max(1, dst(p.x, p.y, target.x, target.y));
  const optimalPx = wProf.optimalPx ?? wProf.range;
  const falloffPx = Math.max(1, wProf.falloffPx ?? C.COMBAT.RANGE_MODEL.minFalloffPx);
  const rangeTerm = Math.max(0, (dist - optimalPx) / falloffPx);
  const trk = turretMod?.trackingSpeed ?? C.PLAYER.TURRET.defaultTrackingSpeed;
  const sig = target.sigRadius || C.COMBAT.RANGE_MODEL.defaultSig;
  const angular = transversalVs(target, p) / dist;
  const trackTerm = (angular / Math.max(C.COMBAT.TRACKING.trackingFloor, trk))
    * (C.COMBAT.RANGE_MODEL.sigRef / sig) * C.COMBAT.TRACKING.k;
  return Math.pow(0.5, trackTerm * trackTerm + rangeTerm * rangeTerm);
}
