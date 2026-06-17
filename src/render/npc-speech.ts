/**
 * NPC speech bubble state — render-side cache.
 *
 * Simulation (ambient AI, UI hails) triggers speech.
 * Render (enemy sprites) reads and displays it.
 */

export interface NpcSpeech {
  text: string;
  until: number;
}

const _store = new Map<string, NpcSpeech>();

/** Set or update speech for an NPC. */
export function setNpcSpeech(id: string, text: string, durationMs: number = 4000): void {
  _store.set(id, { text, until: performance.now() + durationMs });
}

/** Get active speech for an NPC (returns null if expired or missing). */
export function getNpcSpeech(id: string): NpcSpeech | null {
  const s = _store.get(id);
  if (!s) return null;
  if (performance.now() > s.until) {
    _store.delete(id);
    return null;
  }
  return s;
}

/** Remove speech for a specific NPC. */
export function removeNpcSpeech(id: string): void {
  _store.delete(id);
}

/** Clear all speech entries (system warp, respawn). */
export function clearNpcSpeech(): void {
  _store.clear();
}
