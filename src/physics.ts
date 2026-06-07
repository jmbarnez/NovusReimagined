import { Client } from "./state.js";
import { getState, PlayerAccess } from "./state-access.js";
import { updateShip } from "./physics/ship.js";
import { updateTutorialTrack } from "./physics/tutorial-track.js";
import { updateCombat, updateProjectiles } from "./physics/combat-physics.js";
import { updateNpcs, updateEnemyBullets, updateAsteroids, updateMining, resolveNpcAsteroidCollisions, updateEnemyRespawns } from "./physics/npcs.js";
import { updateStationTurrets } from "./physics/station-turrets.js";
import { updateWarp } from "./dock.js";
import { syncSpatialGrid } from "./utils/spatial.js";
import { allActivePlayers } from "./utils/game.js";
import { updateWreckPiecesAndPickups } from "./wreck.js";
import { updateSalvager } from "./salvager.js";
import { updateTractor } from "./tractor.js";
import { updateHub, tickHubQueue } from "./refinery/index.js";
import { updateTrails } from "./utils/entities.js";
import { updateTurretCooldowns } from "./combat/turret-control.js";
import { tickAbilities } from "./player/abilities.js";
import { updateAsteroidDebris } from "./utils/mining.js";
import { updateAmbientDirector } from "./physics/ambient-ships.js";
import { tickIndustryQueue } from "./state/actions.js";
import { updateMapScanner, updateScanning } from "./scanning.js";

export function tick(dt: number) {
  syncSpatialGrid();
  tickAbilities(dt);
  for (const p of allActivePlayers()) {
    updateShip(dt, p);
  }
  updateTutorialTrack(dt, getState().player);
  updateTurretPowerCd(dt);
  updateTurretCooldowns(dt);
  updateCombat(dt);
  
  if (getState().player?.sysIdx === 0) {
    updateAmbientDirector(dt);
  }

  updateNpcs(dt);
  updateEnemyBullets(dt);
  updateProjectiles(dt);
  updateAsteroids(dt);
  resolveNpcAsteroidCollisions();
  updateMining(dt);
  updateSalvager(dt);
  updateTractor(dt);
  updateHub(dt);
  tickHubQueue();
  if (Client.multiplayerRole !== "client") {
    tickIndustryQueue();
    updateMapScanner(dt, getState().player);
    updateScanning(dt, getState().player);
  }
  updateEnemyRespawns(dt);
  updateStationTurrets(dt);
  updateWarp(dt);
  updateWreckPiecesAndPickups(dt);
  updateTrails(dt);
  updateAsteroidDebris(dt);
}

function updateTurretPowerCd(dt: number) {
  if (!getState().player?.turretPowerCd) return;
  for (let i = 0; i < getState().player.turretPowerCd.length; i++) {
    if (getState().player.turretPowerCd[i] > 0) {
      const nextCd = Math.max(0, getState().player.turretPowerCd[i] - dt);
      PlayerAccess.setTurretPowerCd(i, nextCd);
    }
  }
}

export const simulationTick = tick;
