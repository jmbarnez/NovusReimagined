import { Container, Graphics } from "pixi.js";
import { syncBullets } from "./bullets.js";
import { syncBeams } from "./beams.js";
import { initUtilityBeams, setUtilityGraphics, syncUtilityBeams } from "./utility.js";
import { destroyMiningLaserGpu } from "./mining-laser-gpu.js";
import type { System } from "../../types/world.js";

let _bulletGfx: Graphics | null = null;
let _beamGfx: Graphics | null = null;
let _utilityGfx: Graphics | null = null;
let _weaponLayer: Container | null = null;

export function initPixiCombat(parent: Container): void {
  destroyPixiCombat();

  _weaponLayer = new Container();
  _weaponLayer.label = "weapon-fire-under-hulls";
  parent.addChildAt(_weaponLayer, 0);

  _bulletGfx = new Graphics();
  _weaponLayer.addChild(_bulletGfx);

  _beamGfx = new Graphics();
  _weaponLayer.addChild(_beamGfx);

  _utilityGfx = new Graphics();
  _weaponLayer.addChild(_utilityGfx);
  
  initUtilityBeams(_weaponLayer);
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
  destroyMiningLaserGpu();
  if (_weaponLayer) {
    _weaponLayer.destroy({ children: false });
    _weaponLayer = null;
  }
}

export { syncBullets, syncBeams, setUtilityGraphics, syncUtilityBeams };
