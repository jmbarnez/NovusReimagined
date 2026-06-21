/**
 * Shared monotonic entity ID generator.
 *
 * Every simulation entity (bullet, beam, particle, wreck, etc.) receives a
 * unique numeric ID via {@link generateId} for network sync and debugging.
 * The counter is process-global and shared across all entity types so IDs
 * never collide.
 */
let _nextId = 1;

export function generateId(): number {
  return _nextId++;
}
