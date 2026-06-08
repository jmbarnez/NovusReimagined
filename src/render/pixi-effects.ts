/**
 * PixiJS Effects, Wrecks, and Pickups Renderer.
 * 
 * Migrates dynamic particles, debris, pickups, and decals to PixiJS:
 * - Wreck Debris: Dynamic polygons with 3D shadows and hit flashes.
 * - Salvage Pickups: Holographic resource icons, vertical energy pillars, ground glows, and floating name cards.
 * - Impact Decals: Fading high-composite poly impact markings.
 */
import { Container, Graphics } from "pixi.js";
import { PixiGeometryBufferPool } from "./pixi-geometry-buffer-pool.js";
import { setPolyBuffers, syncWrecks } from "./fx/wrecks.js";
import { refreshPickupFonts, syncPickups, destroyPickups } from "./fx/pickups.js";
import { setPolyBuffers as setDecalPolyBuffers, syncDecals } from "./fx/decals.js";

export { refreshPickupFonts, syncPickups, destroyPickups } from "./fx/pickups.js";

let _wreckGfx: Graphics | null = null;
let _pickupGfx: Graphics | null = null;
let _decalGfx: Graphics | null = null;
let _polyBuffers: PixiGeometryBufferPool;

export function initPixiEffects(parent: Container): void {
  destroyPixiEffects();

  // Unified graphics
  _wreckGfx = new Graphics();
  parent.addChild(_wreckGfx);

  _pickupGfx = new Graphics();
  parent.addChild(_pickupGfx);

  _decalGfx = new Graphics();
  parent.addChild(_decalGfx);

  // Initialize and share poly buffers
  _polyBuffers = new PixiGeometryBufferPool();
  setPolyBuffers(_polyBuffers);
  setDecalPolyBuffers(_polyBuffers);
}

export function syncPixiEffects(now: number, alpha: number, dt: number): void {
  if (!_wreckGfx || !_pickupGfx || !_decalGfx) return;

  syncWrecks(_wreckGfx, now);
  syncPickups(_pickupGfx, now);
  syncDecals(_decalGfx);
}

export function destroyPixiEffects(): void {
  if (_wreckGfx) { _wreckGfx.destroy(); _wreckGfx = null; }
  if (_pickupGfx) { _pickupGfx.destroy(); _pickupGfx = null; }
  if (_decalGfx) { _decalGfx.destroy(); _decalGfx = null; }

  destroyPickups();
}

export function refreshEffectFonts(): void {
  refreshPickupFonts();
}
