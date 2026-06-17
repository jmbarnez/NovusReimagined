/**
 * PixiJS Hit Effects & Lock Brackets Renderer.
 * 
 * Migrates ship shield ripple waves, hull impact sparks, and targeting brackets to PixiJS:
 * - Ship Lock Brackets: Draws red/orange/yellow brackets around targets under active scanning/locks.
 * - Shield Impact Ripples: Dynamic concentric expanding circular rings originating from the hit contact angle.
 * - Hull sparks: Fiery sparks and dispersing debris particle lines when projectiles strike hulls.
 */
import { Container, Graphics } from "pixi.js";
import { getState } from "../state-access.js";
import type { System } from "../types/system.js";
import type { LockSlot } from "../types/combat.js";
import { lerp } from "../utils/math.js";
import { isVisible } from "../utils/game.js";
import { drawTargetLockBrackets, drawSelectedTargetIndicator } from "./pixi-lock-brackets.js";
import { drawShipHitGlows } from "./pixi-hit-impact-draw.js";
import { effectLayer } from "../pixi.js";
import { getVisualState } from "./entity-visuals.js";

let _hitGfx: Graphics | null = null;
const _lockMap = new Map<string, LockSlot>();

export function initPixiHitEffects(parent: Container): void {
  destroyPixiHitEffects();

  _hitGfx = new Graphics();
  parent.addChild(_hitGfx);
}

export function syncPixiHitEffects(now: number, alpha: number, sys: System): void {
  if (!_hitGfx && effectLayer) {
    initPixiHitEffects(effectLayer);
  }
  if (!_hitGfx) return;

  _hitGfx.clear();
  _lockMap.clear();

  const primaryId = getState().player?.targetLock?.id;
  const selectedId = getState().player?._assignTargetId;
  if (Array.isArray(getState().player?.lockQueue)) {
    for (const slot of getState().player.lockQueue) _lockMap.set(slot.id, slot);
  }

  // 1. Enemy Lock brackets & Shield glows
  if (sys?._liveEnemies) {
    for (const e of sys._liveEnemies) {
      if (!isVisible(e.x, e.y, 40)) continue;
      const ix = lerp(e.px, e.x, alpha);
      const iy = lerp(e.py, e.y, alpha);

      // Lock Brackets
      const slot = _lockMap.get(e.id);
      if (slot) {
        drawTargetLockBrackets(
          _hitGfx, ix, iy, e.sigRadius ?? 18, slot, e.id === primaryId, now, "enemy",
          { hasLockOnPlayer: e.hasLockOnPlayer, targetingPlayer: e.targetingPlayer },
        );
        if (e.id === selectedId) {
          drawSelectedTargetIndicator(_hitGfx, ix, iy, e.sigRadius ?? 18, now);
        }
      }

      const sigR = e.sigRadius ?? 20;
      drawShipHitGlows(_hitGfx, ix, iy, sigR, Math.max(12, sigR * 0.85), getVisualState(e.id));
    }
  }

  // 2. Player Shield glows & Hull sparks
  if (getState().player) {
    const player = getState().player;
    const v = getVisualState(player.netId || "__player__");
    if ((v.shieldHitGlow ?? 0) > 0 || (v.hullHitGlow ?? 0) > 0) {
      const ix = lerp(player.px, player.x, alpha);
      const iy = lerp(player.py, player.y, alpha);
      drawShipHitGlows(_hitGfx, ix, iy, 34, 18, v);
    }
  }
}

export function destroyPixiHitEffects(): void {
  if (_hitGfx) {
    _hitGfx.destroy();
    _hitGfx = null;
  }
}
