import type { System } from "../types/world.js";

/** Matches `SUN_DIST` in render/pixi-celestial.ts — distant star anchor in world space. */
export const SUN_WORLD_DIST = 3500;

export function getSunWorldPos(sys: Pick<System, "sunDir" | "sunDist"> | null | undefined): { x: number; y: number } {
  const dir = sys?.sunDir ?? 0;
  const dist = typeof sys?.sunDist === "number" ? sys.sunDist : SUN_WORLD_DIST;
  return {
    x: Math.cos(dir) * dist,
    y: Math.sin(dir) * dist,
  };
}

/** Clamp a blip to the minimap circle when it falls outside passive range. */
export function clampMinimapBlip(
  px: number,
  py: number,
  centerX: number,
  centerY: number,
  maxR: number,
): { x: number; y: number } {
  const dx = px - centerX;
  const dy = py - centerY;
  const d = Math.hypot(dx, dy);
  if (d <= maxR || d < 1e-6) return { x: px, y: py };
  const scale = maxR / d;
  return { x: centerX + dx * scale, y: centerY + dy * scale };
}
