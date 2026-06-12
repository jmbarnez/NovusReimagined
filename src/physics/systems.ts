import { Client } from "../state.js";
import { getState, PlayerAccess } from "../state-access.js";
import { updateShip } from "./ship.js";
import { updateTutorialTrack } from "./tutorial-track.js";
import { updateCombat, updateProjectiles } from "./combat-physics.js";
import {
  updateNpcs,
  updateEnemyBullets,
  updateAsteroids,
  updateMining,
  resolveNpcAsteroidCollisions,
  updateEnemyRespawns,
} from "./npcs.js";
import { updateStationTurrets } from "./station-turrets.js";
import { updateWarp } from "../docking/index.js";
import { syncSpatialGrid } from "../utils/spatial.js";
import { allActivePlayers } from "../utils/game.js";
import { updateWreckPiecesAndPickups } from "../wreck/index.js";
import { updateSalvager } from "../player/salvager.js";
import { updateTractor } from "../player/tractor.js";
import { updateHub, tickHubQueue } from "../refinery/index.js";
import { updateTrails } from "../utils/entities.js";
import { updateTurretCooldowns } from "../combat/turret-control.js";
import { tickAbilities } from "../player/abilities.js";
import { updateAsteroidDebris } from "../utils/mining.js";
import { updateAmbientDirector } from "./ambient-ships.js";
import { tickIndustryQueue } from "../state/actions.js";
import { updateMapScanner, updateScanning } from "../scanning/index.js";

export interface SimSystem {
  id: string;
  category: "physics" | "combat" | "economy" | "ai" | "warp" | "fx";
  run: (dt: number) => void;
}

function spatialGrid(): SimSystem {
  return { id: "spatial-grid", category: "physics", run() { syncSpatialGrid(); } };
}

function abilities(): SimSystem {
  return { id: "abilities", category: "physics", run(dt) { tickAbilities(dt); } };
}

function ships(): SimSystem {
  return {
    id: "ships",
    category: "physics",
    run(dt) {
      for (const p of allActivePlayers()) updateShip(dt, p);
    },
  };
}

function tutorialTrack(): SimSystem {
  return {
    id: "tutorial-track",
    category: "physics",
    run(dt) { updateTutorialTrack(dt, getState().player); },
  };
}

function turretPowerCd(): SimSystem {
  return {
    id: "turret-power-cd",
    category: "combat",
    run(dt) {
      const p = getState().player;
      if (!p?.turretPowerCd) return;
      for (let i = 0; i < p.turretPowerCd.length; i++) {
        if (p.turretPowerCd[i] > 0) {
          const nextCd = Math.max(0, p.turretPowerCd[i] - dt);
          PlayerAccess.setTurretPowerCd(i, nextCd);
        }
      }
    },
  };
}

function turretCooldowns(): SimSystem {
  return { id: "turret-cooldowns", category: "combat", run(dt) { updateTurretCooldowns(dt); } };
}

function combat(): SimSystem {
  return { id: "combat", category: "combat", run(dt) { updateCombat(dt); } };
}

function ambientDirector(): SimSystem {
  return {
    id: "ambient-director",
    category: "ai",
    run(dt) {
      if (getState().player?.sysIdx === 0) updateAmbientDirector(dt);
    },
  };
}

function npcs(): SimSystem {
  return { id: "npcs", category: "ai", run(dt) { updateNpcs(dt); } };
}

function enemyBullets(): SimSystem {
  return { id: "enemy-bullets", category: "combat", run(dt) { updateEnemyBullets(dt); } };
}

function projectiles(): SimSystem {
  return { id: "projectiles", category: "combat", run(dt) { updateProjectiles(dt); } };
}

function asteroids(): SimSystem {
  return { id: "asteroids", category: "physics", run(dt) { updateAsteroids(dt); } };
}

function npcAsteroidCollisions(): SimSystem {
  return { id: "npc-asteroid-collisions", category: "physics", run() { resolveNpcAsteroidCollisions(); } };
}

function mining(): SimSystem {
  return { id: "mining", category: "economy", run(dt) { updateMining(dt); } };
}

function salvager(): SimSystem {
  return { id: "salvager", category: "economy", run(dt) { updateSalvager(dt); } };
}

function tractor(): SimSystem {
  return { id: "tractor", category: "economy", run(dt) { updateTractor(dt); } };
}

function hub(): SimSystem {
  return { id: "hub", category: "economy", run(dt) { updateHub(dt); } };
}

function hubQueue(): SimSystem {
  return { id: "hub-queue", category: "economy", run() { tickHubQueue(); } };
}

function industryQueue(): SimSystem {
  return {
    id: "industry-queue",
    category: "economy",
    run() {
      if (Client.multiplayerRole === "client") return;
      tickIndustryQueue();
    },
  };
}

function mapScanner(): SimSystem {
  return {
    id: "map-scanner",
    category: "physics",
    run(dt) {
      if (Client.multiplayerRole === "client") return;
      updateMapScanner(dt, getState().player);
    },
  };
}

function scanning(): SimSystem {
  return {
    id: "scanning",
    category: "physics",
    run(dt) {
      if (Client.multiplayerRole === "client") return;
      updateScanning(dt, getState().player);
    },
  };
}

function enemyRespawns(): SimSystem {
  return { id: "enemy-respawns", category: "ai", run(dt) { updateEnemyRespawns(dt); } };
}

function stationTurrets(): SimSystem {
  return { id: "station-turrets", category: "combat", run(dt) { updateStationTurrets(dt); } };
}

function warp(): SimSystem {
  return { id: "warp", category: "warp", run(dt) { updateWarp(dt); } };
}

function wreckPieces(): SimSystem {
  return { id: "wreck-pieces", category: "fx", run(dt) { updateWreckPiecesAndPickups(dt); } };
}

function trails(): SimSystem {
  return { id: "trails", category: "fx", run(dt) { updateTrails(dt); } };
}

function asteroidDebris(): SimSystem {
  return { id: "asteroid-debris", category: "fx", run(dt) { updateAsteroidDebris(dt); } };
}

/**
 * Declarative simulation system registry.
 *
 * Order equals execution order per tick. When adding a new physics subsystem,
 * append a factory call here rather than hardcoding it into tick().
 *
 * Conditional systems (ambient-director, industry-queue, map-scanner, scanning)
 * guard themselves inside their run() functions so the array stays stable.
 */
export const SIMULATION_SYSTEMS: readonly SimSystem[] = [
  spatialGrid(),
  abilities(),
  ships(),
  tutorialTrack(),
  turretPowerCd(),
  turretCooldowns(),
  combat(),
  ambientDirector(),
  npcs(),
  enemyBullets(),
  projectiles(),
  asteroids(),
  npcAsteroidCollisions(),
  mining(),
  salvager(),
  tractor(),
  hub(),
  hubQueue(),
  industryQueue(),
  mapScanner(),
  scanning(),
  enemyRespawns(),
  stationTurrets(),
  warp(),
  wreckPieces(),
  trails(),
  asteroidDebris(),
];
