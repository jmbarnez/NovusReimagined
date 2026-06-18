/**
 * Player target-selection (assignTargetId) component store.
 *
 * Tracks which lock-queue entry the player has "selected" for module targeting.
 * Read by render/UI; written by targeting logic and snapshot apply.
 */

const _store = new Map<string, string | null>();

export function getAssignTargetId(id: string): string | null {
  return _store.get(id) ?? null;
}

export function setAssignTargetId(id: string, targetId: string | null): void {
  if (targetId === null) _store.delete(id);
  else _store.set(id, targetId);
}

export function removeAssignTargetId(id: string): void {
  _store.delete(id);
}

export function clearAssignTargetIds(): void {
  _store.clear();
}
