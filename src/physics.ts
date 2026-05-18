import { G } from "./state.js";
import { updateShip } from "./physics/ship.js";
import { updateCombat, updateProjectiles } from "./physics/combat-physics.js";
import { updateNpcs, updateEnemyBullets, updateAsteroids, updateMining, resolveNpcAsteroidCollisions, updateEnemyRespawns } from "./physics/npcs.js";
import { updateStationTurrets } from "./physics/station-turrets.js";
import { updateWarp } from "./dock.js";
import { rebuildSpatialGrid } from "./utils/spatial.js";
import { updateWreckPiecesAndPickups } from "./wreck.js";
import { updateSalvager } from "./salvager.js";
import { updateTrails } from "./utils/entities.js";
import { updateTurretCooldowns } from "./combat.js";
import { tickAbilities } from "./player/abilities.js";

export function tick(dt: number) {
  rebuildSpatialGrid();
  tickAbilities(dt);
  updateShip(dt);
  updateTurretPowerCd(dt);
  updateTurretCooldowns(dt);
  updateCombat(dt);
  updateNpcs(dt);
  updateEnemyBullets(dt);
  updateProjectiles(dt);
  updateAsteroids(dt);
  resolveNpcAsteroidCollisions();
  updateMining(dt);
  updateSalvager(dt);
  updateEnemyRespawns(dt);
  updateStationTurrets(dt);
  updateWarp(dt);
  updateWreckPiecesAndPickups(dt);
  updateTrails(dt);
}

function updateTurretPowerCd(dt: number) {
  if (!G.P?.turretPowerCd) return;
  for (let i = 0; i < G.P.turretPowerCd.length; i++) {
    if (G.P.turretPowerCd[i] > 0) {
      G.P.turretPowerCd[i] -= dt;
      if (G.P.turretPowerCd[i] < 0) G.P.turretPowerCd[i] = 0;
    }
  }
}
