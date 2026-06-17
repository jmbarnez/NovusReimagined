/**
 * Player ephemeral input state component store.
 *
 * Continuous input (keys, mouse) is written every frame by input binding
 * and read by physics / combat / docking systems.  It does NOT belong on
 * the persistent Player entity and is never serialized in snapshots.
 */

export interface PlayerInputState {
  keys: {
    space: boolean;
    w: boolean;
    a: boolean;
    s: boolean;
    d: boolean;
    boost: boolean;
    warp: boolean;
  };
  mouseWorld: { x: number; y: number };
}

const _store = new Map<string, PlayerInputState>();

function defaultKeys(): PlayerInputState["keys"] {
  return { space: false, w: false, a: false, s: false, d: false, boost: false, warp: false };
}

function defaultMouseWorld(p: { x: number; y: number; angle: number }): PlayerInputState["mouseWorld"] {
  return { x: p.x + Math.cos(p.angle) * 200, y: p.y + Math.sin(p.angle) * 200 };
}

/** Get or create input state for a player id. */
export function getPlayerInput(id: string): PlayerInputState {
  let s = _store.get(id);
  if (!s) {
    s = { keys: defaultKeys(), mouseWorld: { x: 0, y: 0 } };
    _store.set(id, s);
  }
  return s;
}

/** Overwrite keys and mouse world for a player. */
export function setPlayerInput(
  id: string,
  keys: PlayerInputState["keys"],
  mouseWorld: PlayerInputState["mouseWorld"],
): void {
  _store.set(id, { keys, mouseWorld });
}

/** Reset input to neutral (used on sanitize / respawn). */
export function resetPlayerInput(id: string): void {
  const s = getPlayerInput(id);
  s.keys = defaultKeys();
}

/** Remove input state for a player (disconnect / cull). */
export function removePlayerInput(id: string): void {
  _store.delete(id);
}

/** Clear all input state (system warp, full reset). */
export function clearPlayerInput(): void {
  _store.clear();
}

/** Convenience: read keys for a player. */
export function getPlayerInputKeys(id: string): PlayerInputState["keys"] {
  return _store.get(id)?.keys ?? defaultKeys();
}

/** Convenience: read mouse world for a player. */
export function getPlayerInputMouseWorld(id: string): PlayerInputState["mouseWorld"] | undefined {
  return _store.get(id)?.mouseWorld;
}

/** Convenience: set keys only. */
export function setPlayerInputKeys(id: string, keys: PlayerInputState["keys"]): void {
  const s = getPlayerInput(id);
  s.keys = keys;
}

/** Convenience: set mouse world only. */
export function setPlayerInputMouseWorld(id: string, mouseWorld: PlayerInputState["mouseWorld"]): void {
  const s = getPlayerInput(id);
  s.mouseWorld = mouseWorld;
}
