/**
 * Shared render-side caches and conversion utilities.
 *
 * This module consolidates client-side scratch data that was previously
 * duplicated across render subsystems.  Simulation state must not mutate
 * anything here.
 */

const _hexCache = new Map<string, number>();

/** Convert a CSS hex string (e.g. "#ff4400") to a 24-bit integer.  Cached. */
export function hexStringToNumber(hex: string): number {
  const hit = _hexCache.get(hex);
  if (hit !== undefined) return hit;
  const val = parseInt(hex.replace("#", ""), 16) || 0xffffff;
  _hexCache.set(hex, val);
  return val;
}
