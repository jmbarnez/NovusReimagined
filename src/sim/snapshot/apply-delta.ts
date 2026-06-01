import type { DeltaSnapshot, EntitySnapshot, WorldSnapshot } from "./types.js";

export function applyDelta(base: WorldSnapshot, delta: DeltaSnapshot): WorldSnapshot {
  const player = { ...base.player, ...delta.player };
  const entMap = new Map<string | number, EntitySnapshot>();
  for (const e of base.entities) entMap.set(e.id, { ...e });

  if (delta.entities) {
    if (delta.entities.destroyed) {
      for (const id of delta.entities.destroyed) {
        entMap.delete(id);
      }
    }
    if (delta.entities.updated) {
      for (const u of delta.entities.updated) {
        const existing = entMap.get(u.id!);
        if (existing) {
          Object.assign(existing, u);
        }
      }
    }
    if (delta.entities.spawned) {
      for (const s of delta.entities.spawned) {
        entMap.set(s.id, { ...s });
      }
    }
  }

  return {
    tick: delta.tick,
    player,
    entities: Array.from(entMap.values()),
  };
}
