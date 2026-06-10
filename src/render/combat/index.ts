import { Container, Graphics } from "pixi.js";
import { AppMode } from "../../state.js";
import type { RenderSubsystem } from "../lifecycle.js";
import { syncBullets } from "./bullets.js";
import { syncBeams } from "./beams.js";
import { setUtilityGraphics, syncUtilityBeams } from "./utility.js";
import type { System } from "../../types/world.js";
import { entityLayer } from "../../pixi.js";

let _bulletGfx: Graphics | null = null;
let _beamGfx: Graphics | null = null;
let _utilityGfx: Graphics | null = null;

export function initPixiCombat(parent?: Container): void {
  destroyPixiCombat();

  const layer = parent ?? entityLayer;
  if (!layer) return;

  _bulletGfx = new Graphics();
  layer.addChild(_bulletGfx);

  _beamGfx = new Graphics();
  layer.addChild(_beamGfx);

  _utilityGfx = new Graphics();
  layer.addChild(_utilityGfx);

  setUtilityGraphics(_utilityGfx);
}

export function syncPixiCombat(now: number, alpha: number, sys: System): void {
  if (!_bulletGfx || !_beamGfx || !_utilityGfx) return;

  syncBullets(_bulletGfx, alpha);
  syncBeams(_beamGfx, alpha, sys);
  syncUtilityBeams(now, alpha);
}

export function destroyPixiCombat(): void {
  if (_bulletGfx) { _bulletGfx.destroy(); _bulletGfx = null; }
  if (_beamGfx) { _beamGfx.destroy(); _beamGfx = null; }
  if (_utilityGfx) { _utilityGfx.destroy(); _utilityGfx = null; }
}

export { syncBullets, syncBeams, setUtilityGraphics, syncUtilityBeams };

export const combatRenderer: RenderSubsystem = {
  name: "combat",
  init: initPixiCombat,
  sync: (ctx) => {
    syncPixiCombat(ctx.now, ctx.alpha, ctx.sys);
  },
  destroy: destroyPixiCombat,
  modes: [AppMode.SPACE],
  order: 140,
};
