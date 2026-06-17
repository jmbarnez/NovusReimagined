/**
 * NPC AI state component store.
 *
 * Simulation (AI, physics) owns this state.
 * Render/UI may read from it but must never write.
 */

import type { Enemy } from "../../types/enemy.js";
import type { Player } from "../../state.js";

export interface EnemyAIState {
  targetingPlayer: boolean;
  hasLockOnPlayer: boolean;
  lockOnTimer: number;
  _orbitDir: 1 | -1 | undefined;
  _npcTarget: Enemy | Player | null;
  _npcLockTimer: number;
  _npcHasLock: boolean;
}

const _store = new Map<string, EnemyAIState>();

function defaultAiState(): EnemyAIState {
  return {
    targetingPlayer: false,
    hasLockOnPlayer: false,
    lockOnTimer: 0,
    _orbitDir: undefined,
    _npcTarget: null,
    _npcLockTimer: 0,
    _npcHasLock: false,
  };
}

/** Get or create AI state for an enemy id. */
export function getAiState(id: string): EnemyAIState {
  let s = _store.get(id);
  if (!s) {
    s = defaultAiState();
    _store.set(id, s);
  }
  return s;
}

/** Remove AI state when an enemy is culled / despawned. */
export function removeAiState(id: string): void {
  _store.delete(id);
}

/** Clear all AI state (e.g. on system warp or respawn). */
export function clearAiState(): void {
  _store.clear();
}

// ── Convenience accessors for render / UI (read-only) ──────────────────────

export function isTargetingPlayer(id: string): boolean {
  return _store.get(id)?.targetingPlayer ?? false;
}

export function hasLockOnPlayer(id: string): boolean {
  return _store.get(id)?.hasLockOnPlayer ?? false;
}

export function getLockOnTimer(id: string): number {
  return _store.get(id)?.lockOnTimer ?? 0;
}

export function getNpcTarget(id: string): Enemy | Player | null {
  return _store.get(id)?._npcTarget ?? null;
}

/** Iterate all AI states. Used by warning-pulse logic. */
export function forEachAiState(cb: (id: string, s: EnemyAIState) => void): void {
  for (const [id, s] of _store) cb(id, s);
}
