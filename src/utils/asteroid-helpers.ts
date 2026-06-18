import type { Asteroid } from "../types/asteroid.js";

/** Collision radius that matches the asteroid's visual extent. */
export function getAsteroidColRadius(a: Asteroid): number {
  return a.radius * (a.shapeMax ?? 1.1);
}
