/**
 * Render-side visual state cache.
 *
 * Simulation (physics, combat, AI) must never write here.
 * Render systems read from this cache to decide what to draw.
 * Decay and lifecycle are managed by the render loop.
 */

export interface EntityVisualState {
  /** Engine thrust visual active (derived from physics, not stored on entity). */
  thrustFx?: boolean;
  /** Boost visual active (derived from physics, not stored on entity). */
  boostFx?: boolean;
  /** Shield hit glow intensity [0,1]. */
  shieldHitGlow?: number;
  /** Shield hit angle (radians). */
  shieldHitAngle?: number;
  /** Hull hit glow intensity [0,1]. */
  hullHitGlow?: number;
  /** Hull hit angle (radians). */
  hullHitAngle?: number;
  /** Structure hit glow intensity [0,1]. */
  structureHitGlow?: number;
  /** Structure hit angle (radians). */
  structureHitAngle?: number;
}

const _cache = new Map<string, EntityVisualState>();

/** Get or create visual state for an entity id. */
export function getVisualState(id: string): EntityVisualState {
  let v = _cache.get(id);
  if (!v) {
    v = {};
    _cache.set(id, v);
  }
  return v;
}

/** Remove visual state for a culled entity id. */
export function removeVisualState(id: string): void {
  _cache.delete(id);
}

/** Clear all visual state (e.g. on system warp). */
export function clearVisualState(): void {
  _cache.clear();
}

/** Trigger a shield hit glow on an entity. */
export function triggerShieldHit(id: string, angle: number): void {
  const v = getVisualState(id);
  v.shieldHitGlow = 1;
  v.shieldHitAngle = angle;
}

/** Trigger a hull hit glow on an entity. */
export function triggerHullHit(id: string, angle: number): void {
  const v = getVisualState(id);
  v.hullHitGlow = 1;
  v.hullHitAngle = angle;
}

/** Trigger a structure hit glow on an entity. */
export function triggerStructureHit(id: string): void {
  const v = getVisualState(id);
  v.structureHitGlow = 1;
}

/** Decay all visual timers by dt. Call once per frame from the render loop. */
export function decayVisualState(dt: number): void {
  for (const [, v] of _cache) {
    if (v.shieldHitGlow !== undefined) {
      v.shieldHitGlow = Math.max(0, v.shieldHitGlow - dt * 2.5);
      if (v.shieldHitGlow <= 0) {
        delete v.shieldHitGlow;
        delete v.shieldHitAngle;
      }
    }
    if (v.hullHitGlow !== undefined) {
      v.hullHitGlow = Math.max(0, v.hullHitGlow - dt * 3.0);
      if (v.hullHitGlow <= 0) {
        delete v.hullHitGlow;
        delete v.hullHitAngle;
      }
    }
    if (v.structureHitGlow !== undefined) {
      v.structureHitGlow = Math.max(0, v.structureHitGlow - dt * 3.0);
      if (v.structureHitGlow <= 0) {
        delete v.structureHitGlow;
      }
    }
  }
}
