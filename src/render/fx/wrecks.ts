/**
 * Wreck piece rendering with 3D shadows, hit flashes, and target lock brackets.
 */
import { Graphics } from "pixi.js";
import { getState } from "../../state-access.js";
import { isVisible } from "../../utils/game.js";
import { ENEMY_DEFS } from "../../data/enemies.js";
import { drawTargetLockBrackets, drawSelectedTargetIndicator } from "../pixi-lock-brackets.js";
import { getAssignTargetId } from "../../player/target-selection.js";
import { PixiGeometryBufferPool } from "../pixi-geometry-buffer-pool.js";
import type { LockSlot } from "../../types/combat.js";

import { hexStringToNumber } from "../cache.js";

let _polyBuffers: PixiGeometryBufferPool | null = null;
let _lockSlotById = new Map<string, LockSlot>();

export function setPolyBuffers(buffers: PixiGeometryBufferPool): void {
  _polyBuffers = buffers;
}

export function syncWrecks(wreckGfx: Graphics, now: number): void {
  if (!_polyBuffers) return;
  const state = getState();
  _polyBuffers.resetFrame();

  const hasWreckPieces = state.wreckPieces?.length > 0;
  if (hasWreckPieces) wreckGfx.clear();
  const primaryId = state.player.targetLock?.id;
  const selectedId = getAssignTargetId(state.player.netId ?? state.player.shipId);
  _lockSlotById.clear();
  if (Array.isArray(state.player.lockQueue)) {
    for (const slot of state.player.lockQueue) _lockSlotById.set(slot.id, slot);
  }

  if (state.wreckPieces) {
    for (const p of state.wreckPieces) {
      if (!isVisible(p.x, p.y, 50)) continue;
      const def = ENEMY_DEFS[p.type];
      const fillCol = hexStringToNumber(def?.render?.fill ?? "#332016");
      const strokeCol = hexStringToNumber(def?.render?.stroke ?? "#aa6633");
      const fade = Math.min(1, p.despawnTimer / 30);
      const explosionPhase = Math.max(0, 1 - p.age / 1.0);

      const pts = p.pts;
      if (!pts?.length) continue;

      // Outer border styling
      const borderAlpha = (0.55 + explosionPhase * 0.45) * fade;
      const borderWidth = 0.85 + explosionPhase * 0.55;

      // Flat rotated/translated polygon points in world space
      const cos = Math.cos(p.angle);
      const sin = Math.sin(p.angle);
      const wreckFlatPts = _polyBuffers.writeRotatedScaledWorldPoints(pts, p.x, p.y, 1, cos, sin);

      // Draw the main body
      wreckGfx.poly(wreckFlatPts, true)
        .fill({ color: fillCol, alpha: 0.78 * fade })
        .stroke({ color: strokeCol, width: borderWidth, alpha: borderAlpha });

      // Explosion/Hit overlays
      if (explosionPhase > 0) {
        wreckGfx.poly(wreckFlatPts, true).fill({ color: 0xffb060, alpha: explosionPhase * 0.55 * fade });
      }
      if (p.hitFlash > 0) {
        wreckGfx.poly(wreckFlatPts, true).fill({ color: 0x9fffe5, alpha: (p.hitFlash / 0.18) * 0.7 * fade });
      }

      // Standard HP Bar below wreck
      if (p.hp < p.maxHp) {
        const hpFrac = Math.max(0, p.hp / p.maxHp);
        const w = 16;
        wreckGfx.rect(p.x - w / 2 - 1, p.y - 16, w + 2, 3).fill({ color: 0x0a1a1a, alpha: 0.85 * fade })
          .rect(p.x - w / 2, p.y - 15, w * hpFrac, 1).fill({ color: 0x00e8c8, alpha: 0.85 * fade });
      }

      // Target lock brackets (corner boxes drawn flat in world space)
      const slot = _lockSlotById.get(p.id);
      if (slot) {
        drawTargetLockBrackets(
          wreckGfx, p.x, p.y, p.radius ?? 14, slot, p.id === primaryId, now, "neutral", undefined, fade,
        );
        if (p.id === selectedId) {
          drawSelectedTargetIndicator(wreckGfx, p.x, p.y, p.radius ?? 14, now);
        }
      }
    }
  }
}
