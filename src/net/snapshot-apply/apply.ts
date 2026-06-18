import type { WorldSnapshot } from "../../sim/snapshot.js";
import { getState } from "../../state-access.js";
import { populateSystem } from "../../world-gen.js";
import { rebuildSpatialGrid } from "../../utils/spatial.js";
import { netLog } from "../../ui/net-console.js";
import { createSnapshotEntityMaps, categorizeSnapshotEntities } from "./entity-maps.js";
import { applyProjectileSnapshots } from "./projectiles.js";
import { applyLocalPlayerSnapshot, shouldApplyLocalPlayerSnapshot } from "./local-player.js";
import { applySalvageSnapshots, applyWreckSnapshots } from "./wreck-salvage.js";
import { applyRemotePlayerSnapshots } from "./remote-players.js";
import { applyAsteroidSnapshots, applyEnemySnapshots, rebuildSystemEntityMaps } from "./system-entities.js";

export function applySnapshotToG(snap: WorldSnapshot, isFullSnapshot = false): void {
  const p = getState().player;
  const applyLocalPlayer = shouldApplyLocalPlayerSnapshot(p, snap);
  if (p && !applyLocalPlayer) {
    netLog(`[WARN] snapshot player netId mismatch got=${snap.player.netId} local=${p.netId} — peers only`);
  }

  if (p && applyLocalPlayer) {
    applyLocalPlayerSnapshot(p, snap, isFullSnapshot);
  }

  const sys = getState().GALAXY[snap.player.sysIdx] || getState().GALAXY[0];
  if (!sys) return;

  if (!sys.ready) {
    populateSystem(sys);
  }

  const maps = createSnapshotEntityMaps();
  categorizeSnapshotEntities(snap, maps);

  applyProjectileSnapshots(snap);
  applyWreckSnapshots(maps);
  applySalvageSnapshots(maps, p);
  applyRemotePlayerSnapshots(maps, snap, p, isFullSnapshot);
  applyEnemySnapshots(sys, maps);
  applyAsteroidSnapshots(sys, maps);
  rebuildSystemEntityMaps(sys);

  rebuildSpatialGrid(snap.player.sysIdx);
}
