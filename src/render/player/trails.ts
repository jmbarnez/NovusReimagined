/**
 * Trail mesh sync for engine exhaust and blink afterimages.
 *
 * Replaced the sprite-pool renderer with a single GPU Mesh using a custom
 * shader that adds heat turbulence, Mach-diamond bands, and colour gradients.
 */
import {
  buildTrailMesh,
  syncTrailMesh,
  destroyTrailMesh,
} from "../pixi-trail-mesh.js";

export function buildTrailPool() {
  buildTrailMesh();
}

export function syncPixiTrails(now?: number): void {
  syncTrailMesh(now ?? performance.now());
}

export function destroyTrailPool(): void {
  destroyTrailMesh();
}

export function refreshTrailTexture(): void {
  // No-op: the mesh shader does not use textures.
}
