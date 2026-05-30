import { spawnImpactFlash, spawnParticles } from "../utils/fx.js";
import { DMG_COLORS, showDamageNumber } from "./damage-display.js";

export type HitImpactLayer = "shield" | "hull" | "structure" | "hit" | "miss" | "crit" | "mining" | "asteroid";

/** Shared hit-glow fields for player and NPC ships. */
export interface HitGlowTarget {
  x: number;
  y: number;
  sigRadius?: number;
  shieldHitGlow?: number;
  shieldHitAngle?: number;
  hullHitGlow?: number;
  hullHitAngle?: number;
  structureHitGlow?: number;
  structureHitAngle?: number;
}

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

/** Set shield/hull ripple state from an impact point on the target's hull. */
export function applyHitGlow(
  target: HitGlowTarget,
  layer: HitImpactLayer,
  impactX: number,
  impactY: number,
): void {
  if (layer === "miss" || layer === "mining" || layer === "asteroid" || layer === "hit") return;
  const angle = Math.atan2(impactY - target.y, impactX - target.x);
  if (layer === "shield") {
    target.shieldHitGlow = 1;
    target.shieldHitAngle = angle;
  } else if (layer === "hull") {
    target.hullHitGlow = 1;
    target.hullHitAngle = angle;
  } else if (layer === "structure") {
    target.structureHitGlow = 1;
    target.structureHitAngle = angle;
    target.hullHitGlow = 1;
    target.hullHitAngle = angle;
  }
}

export function decayHitGlows(target: HitGlowTarget, dt: number): void {
  if ((target.shieldHitGlow ?? 0) > 0) {
    target.shieldHitGlow = Math.max(0, (target.shieldHitGlow ?? 0) - dt * 2.5);
  }
  if ((target.hullHitGlow ?? 0) > 0) {
    target.hullHitGlow = Math.max(0, (target.hullHitGlow ?? 0) - dt * 2.5);
  }
  if ((target.structureHitGlow ?? 0) > 0) {
    target.structureHitGlow = Math.max(0, (target.structureHitGlow ?? 0) - dt * 3.0);
  }
}
