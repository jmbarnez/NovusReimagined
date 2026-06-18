/**
 * Player collision damage cooldown component store.
 *
 * Prevents rapid repeated collision damage by gating hits per player.
 */

const _store = new Map<string, number>();

export function getCollisionCooldown(id: string): number {
  return _store.get(id) ?? 0;
}

export function setCollisionCooldown(id: string, value: number): void {
  _store.set(id, value);
}

export function tickCollisionCooldown(id: string, dt: number): void {
  const current = _store.get(id) ?? 0;
  if (current > 0) {
    const next = current - dt;
    if (next <= 0) _store.delete(id);
    else _store.set(id, next);
  }
}

export function resetCollisionCooldown(id: string): void {
  _store.delete(id);
}

export function clearCollisionCooldowns(): void {
  _store.clear();
}
