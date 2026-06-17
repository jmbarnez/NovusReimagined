import { spawnImpactFlash, spawnParticles } from "../utils/fx.js";
import { DMG_COLORS, showDamageNumber } from "./damage-display.js";
import { triggerShieldHit, triggerStructureHit } from "../render/entity-visuals.js";

export type HitImpactLayer = "shield" | "hull" | "structure" | "hit" | "miss" | "crit" | "mining" | "asteroid";

export function impactColorForLayer(layer: HitImpactLayer): string {
  return DMG_COLORS[layer] || DMG_COLORS.hit;
}

export interface SpawnHitImpactOptions {
  labelX: number;
  labelY: number;
  impactX: number;
  impactY: number;
  amount: number | string;
  layer: HitImpactLayer;
  /** When false, skip contact particles (e.g. missile already spawned an explosion). */
  contactFlash?: boolean;
}

/** Unified floating damage card + contact particle flash. */
export function spawnHitImpactVisuals(opts: SpawnHitImpactOptions): void {
  const { labelX, labelY, impactX, impactY, amount, layer, contactFlash = true } = opts;
  showDamageNumber(labelX, labelY, amount, layer);
  if (!contactFlash) return;
  const color = impactColorForLayer(layer);
  if (layer === "miss") {
    spawnParticles(impactX, impactY, color, 1, 50);
  } else if (layer === "asteroid" || layer === "mining") {
    spawnParticles(impactX, impactY, color, 1, 50);
  } else {
    spawnImpactFlash(impactX, impactY, color);
  }
}

/** Set shield/hull ripple state from an impact point on the target's hull.
 *  Writes to the render-side visual cache; does not mutate simulation state. */
export function applyHitGlow(
  targetId: string,
  layer: HitImpactLayer,
  impactX: number,
  impactY: number,
  targetX: number,
  targetY: number,
): void {
  if (layer === "miss" || layer === "mining" || layer === "asteroid" || layer === "hit") return;
  const angle = Math.atan2(impactY - targetY, impactX - targetX);
  if (layer === "shield") {
    triggerShieldHit(targetId, angle);
  } else if (layer === "hull" || layer === "structure") {
    triggerStructureHit(targetId);
  }
}
