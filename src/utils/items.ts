import { getState } from "../state-access.js";
import { ModuleInstance } from "../types/moduleInstance.js";
import type { Player } from "../state.js";

// Cached UID→instance map to avoid O(n) linear scans per lookup.
// Invalidate whenever moduleCargo changes (fitting, loot pickup, respawn).
let _instanceMap: Map<string, ModuleInstance> | null = null;

export function invalidateInstanceCache() { _instanceMap = null; }

export function getInstance(uid: string, p?: Player): ModuleInstance | null {
  const player = p ?? getState().player;
  if (player !== getState().player) {
    return player.moduleCargo.find(inst => inst.uid === uid) || null;
  }
  if (!_instanceMap) {
    _instanceMap = new Map();
    for (const inst of player.moduleCargo) _instanceMap.set(inst.uid, inst);
  }
  return _instanceMap.get(uid) || null;
}
