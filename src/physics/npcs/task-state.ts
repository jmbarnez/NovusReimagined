/**
 * NPC task/behavior state component store.
 *
 * Used exclusively by the ambient ship director (ambient-ships.ts)
 * to track FSM state for neutral faction ships.
 */

export type EnemyTaskKind = "transit-in" | "goto-station" | "dwell" | "mine" | "patrol" | "engage" | "depart";

export interface EnemyTaskState {
  task: EnemyTaskKind;
  taskTimer: number;
  wpX: number | undefined;
  wpY: number | undefined;
  exitGateIdx: number | undefined;
  mineTargetId: string | undefined;
}

const _store = new Map<string, EnemyTaskState>();

function defaultTaskState(): EnemyTaskState {
  return {
    task: "transit-in",
    taskTimer: 0,
    wpX: undefined,
    wpY: undefined,
    exitGateIdx: undefined,
    mineTargetId: undefined,
  };
}

/** Get or create task state for an enemy id. */
export function getTaskState(id: string): EnemyTaskState {
  let s = _store.get(id);
  if (!s) {
    s = defaultTaskState();
    _store.set(id, s);
  }
  return s;
}

/** Remove task state when an enemy is culled / despawned. */
export function removeTaskState(id: string): void {
  _store.delete(id);
}

/** Clear all task state (e.g. on system warp or respawn). */
export function clearTaskState(): void {
  _store.clear();
}
