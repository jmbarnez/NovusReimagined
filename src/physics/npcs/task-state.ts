/**
 * NPC task/behavior state component store.
 *
 * Used exclusively by the ambient mining vessel director (ambient-ships.ts)
 * to track FSM state for neutral faction miners.
 */

export type EnemyTaskKind = "transit-in" | "mine" | "depart";

export interface EnemyMiningLaser {
  active: boolean;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  phase: number;
  hitNx: number;
  hitNy: number;
  hitR: number;
}

export interface EnemyTaskState {
  task: EnemyTaskKind;
  taskTimer: number;
  wpX: number | undefined;
  wpY: number | undefined;
  exitGateIdx: number | undefined;
  mineTargetId: string | undefined;
  mineCd: number;
  miningLaser: EnemyMiningLaser;
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
    mineCd: 0,
    miningLaser: { active: false, x1: 0, y1: 0, x2: 0, y2: 0, phase: 0, hitNx: 0, hitNy: 0, hitR: 0 },
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
