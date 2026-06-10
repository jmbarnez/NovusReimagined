import { Container, Graphics } from "pixi.js";
import { AppMode } from "../../state.js";
import type { RenderSubsystem } from "../lifecycle.js";
import { PixiGeometryBufferPool } from "../pixi-geometry-buffer-pool.js";
import { setPolyBuffers, syncWrecks } from "./wrecks.js";
import { refreshPickupFonts, syncPickups, destroyPickups } from "./pickups.js";
import { setPolyBuffers as setDecalPolyBuffers, syncDecals } from "./decals.js";
import type { System } from "../../types/world.js";
import { effectLayer } from "../../pixi.js";

let _wreckGfx: Graphics | null = null;
let _pickupGfx: Graphics | null = null;
let _decalGfx: Graphics | null = null;
let _polyBuffers: PixiGeometryBufferPool;

export function initPixiEffects(parent?: Container): void {
  destroyPixiEffects();

  const layer = parent ?? effectLayer;
  if (!layer) return;

  _wreckGfx = new Graphics();
  layer.addChild(_wreckGfx);

  _pickupGfx = new Graphics();
  layer.addChild(_pickupGfx);

  _decalGfx = new Graphics();
  layer.addChild(_decalGfx);

  _polyBuffers = new PixiGeometryBufferPool();
  setPolyBuffers(_polyBuffers);
  setDecalPolyBuffers(_polyBuffers);
}

export function syncPixiEffects(now: number, alpha: number, dt: number, sys: System): void {
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

export { refreshPickupFonts, syncPickups, destroyPickups };

export const effectsRenderer: RenderSubsystem = {
  name: "effects",
  init: initPixiEffects,
  sync: (ctx) => {
    syncPixiEffects(ctx.now, ctx.alpha, ctx.dt, ctx.sys);
  },
  destroy: destroyPixiEffects,
  modes: [AppMode.SPACE],
  order: 150,
};
