/**
 * PixiJS Combat & Projectile Renderer.
 * 
 * Migrates combat rendering from Canvas 2D to PixiJS:
 * - Bullets: Single-pass batch graphics rendering for trails, outer glow, and core slug shapes.
 * - Beams: Layered high-intensity line rendering with core glows.
 * - Mining Laser: Triple-layered glowing laser cord with contact glints.
 * - Salvager Beam: Dashed animated scanning beam with contact point sparkles.
 * - Tractor Beam: Multi-stop animated cyan force cords or red hazard lines.
 */
import { Container, Graphics } from "pixi.js";
import { getState } from "../state-access.js";
import type { System } from "../types/world.js";
import { syncBullets } from "./combat/bullets.js";
import { syncBeams } from "./combat/beams.js";
import { setUtilityGraphics, syncUtilityBeams } from "./combat/utility.js";

let _bulletGfx: Graphics | null = null;
let _beamGfx: Graphics | null = null;
let _utilityGfx: Graphics | null = null;

export function initPixiCombat(parent: Container): void {
  destroyPixiCombat();

  // Create single-pass graphics containers
  _bulletGfx = new Graphics();
  parent.addChild(_bulletGfx);

  _beamGfx = new Graphics();
  parent.addChild(_beamGfx);

  _utilityGfx = new Graphics();
  parent.addChild(_utilityGfx);
  
  // Set utility graphics reference for the utility module
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
