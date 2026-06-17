/**
 * World border rendering - sector boundary ring with proximity warning.
 */
import { Graphics } from "pixi.js";
import { getState } from "../../state-access.js";
import type { System } from "../../types/system.js";
import { planetLayer } from "../../pixi.js";
import { SECTOR_OUTER_RADIUS } from "../../world-gen.js";
import { TUTORIAL_SECTOR } from "../../data/tutorial-layout.js";

const TAU = Math.PI * 2;

let _borderGfx: Graphics | null = null;
let _warningGfx: Graphics | null = null;
let _borderOuterRadius = -1;

export function initBorderSprites(): void {
  _borderGfx = new Graphics();
  _warningGfx = new Graphics();
  rebuildWorldBorder(SECTOR_OUTER_RADIUS);
  _borderGfx.alpha = 0;
  planetLayer!.addChild(_borderGfx);

  _warningGfx.alpha = 0;
  planetLayer!.addChild(_warningGfx);
}

function rebuildWorldBorder(radius: number): void {
  if (!_borderGfx || !_warningGfx) return;
  if (_borderOuterRadius === radius) return;
  _borderOuterRadius = radius;

  _borderGfx.clear();
  const segments = 120;
  for (let i = 0; i < segments; i++) {
    if (i % 2 === 0) {
      const a0 = (i / segments) * TAU;
      const a1 = ((i + 0.6) / segments) * TAU;
      _borderGfx.arc(0, 0, radius, a0, a1);
      _borderGfx.stroke({ color: 0x2a4560, width: 2.5 });
    }
  }

  _warningGfx.clear();
  _warningGfx.circle(0, 0, radius - 120).stroke({ color: 0x1a3048, width: 1.0 });
}

export function syncBorderSprites(sys: System): void {
  if (!_borderGfx || !_warningGfx || !getState().player) return;

  const tutorialBorder = sys.idx === 0 && getState().player.tutorial?.active;
  if (tutorialBorder) {
    _borderGfx.visible = false;
    _warningGfx.visible = false;
  } else {
    const outerR = sys.idx === 0 ? TUTORIAL_SECTOR.radius : SECTOR_OUTER_RADIUS;
    rebuildWorldBorder(outerR);
    const pr = Math.hypot(getState().player.x, getState().player.y);
    const distToEdge = outerR - pr;
    const fadeStart = 1800;
    const fadeEnd = 600;

    if (distToEdge <= fadeStart) {
      const t = Math.min(1, (fadeStart - distToEdge) / (fadeStart - fadeEnd));
      const borderAlpha = t * 0.18;
      const pulse = 0.92 + 0.08 * Math.sin(performance.now() * 0.0018);

      _borderGfx.alpha = borderAlpha * pulse;
      _borderGfx.visible = true;

      _warningGfx.alpha = borderAlpha * 0.35 * pulse;
      _warningGfx.visible = true;
    } else {
      _borderGfx.visible = false;
      _warningGfx.visible = false;
    }
  }
}

export function destroyBorderSprites(): void {
  if (_borderGfx) { _borderGfx.destroy(); _borderGfx = null; }
  if (_warningGfx) { _warningGfx.destroy(); _warningGfx = null; }
}
