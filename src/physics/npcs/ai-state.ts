/**
 * NPC AI state component store.
 *
 * Simulation (AI, physics) owns this state.
 * Render/UI may read from it but must never write.
 */

import type { Enemy } from "../../types/enemy.js";
import type { Player } from "../../state.js";

export interface EnemyAIState {
  orbitDir: 1 | -1 | undefined;
  npcTarget: Enemy | Player | null;
}

const _store = new Map<string, EnemyAIState>();

function defaultAiState(): EnemyAIState {
  return {
    orbitDir: undefined,
    npcTarget: null,
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

export function getNpcTarget(id: string): Enemy | Player | null {
  return _store.get(id)?.npcTarget ?? null;
}
