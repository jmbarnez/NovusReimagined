import { G } from "../state.js";
import { ModuleInstance } from "../types/moduleInstance.js";

// Cached UID→instance map to avoid O(n) linear scans per lookup.
// Invalidate whenever moduleCargo changes (fitting, loot pickup, respawn).
let _instanceMap: Map<string, ModuleInstance> | null = null;

export function invalidateInstanceCache() { _instanceMap = null; }

export function getInstance(uid: string): ModuleInstance | null {
  if (!_instanceMap) {
    _instanceMap = new Map();
    for (const inst of G.P.moduleCargo) _instanceMap.set(inst.uid, inst);
  }
  return _instanceMap.get(uid) || null;
}
