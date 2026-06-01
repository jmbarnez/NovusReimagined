import type { EntitySnapshot, WorldSnapshot } from "../../sim/snapshot.js";

export interface SnapshotEntityMaps {
  wrecks: Map<string, EntitySnapshot>;
  salvages: Map<string, EntitySnapshot>;
  players: Map<string, EntitySnapshot>;
  enemies: Map<string, EntitySnapshot>;
  asteroids: Map<string, EntitySnapshot>;
}

export function createSnapshotEntityMaps(): SnapshotEntityMaps {
  return {
    wrecks: new Map(),
    salvages: new Map(),
    players: new Map(),
    enemies: new Map(),
    asteroids: new Map(),
  };
}

export function categorizeSnapshotEntities(snap: WorldSnapshot, maps: SnapshotEntityMaps): void {
  for (const ent of snap.entities) {
    if (ent.type === "wreckpiece") {
      maps.wrecks.set(String(ent.id), ent);
    } else if (ent.type === "salvagepickup") {
      maps.salvages.set(String(ent.id), ent);
    } else if (ent.type === "player") {
      maps.players.set(String(ent.id), ent);
    } else if (ent.type === "enemy") {
      maps.enemies.set(String(ent.id), ent);
    } else if (ent.type === "asteroid") {
      maps.asteroids.set(String(ent.id), ent);
    }
  }
}
