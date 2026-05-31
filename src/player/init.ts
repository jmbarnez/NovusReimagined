import { Asteroid } from "../types/world.js";
import { PlayerAccess, getState } from "../state-access.js";
import { validateFitting } from "./player-fitting.js";
import { MODULES, MODULE_FLAGS } from "../data/modules.js";
import { ModuleRarity } from "../data/moduleRarity.js";
import { getInstance } from "../utils/items.js";
import { C } from "../config/index.js";

/**
 * Setup player spawn position based on pending home spawn flag.
 * Handles spawning near stations, asteroid clusters, or fallback to origin.
 */
function setupPlayerSpawn() {
  if (getState().player.pendingHomeSpawn) {
    PlayerAccess.setPendingHomeSpawn(false);
    const sys = getState().GALAXY[getState().player.sysIdx];

    // Prefer spawning near the first station in the system
    const st = sys?.stations?.[0];
    if (st) {
      const len = Math.hypot(st.x, st.y) || 1;
      // Default outward direction to (1,0) when station is at origin
      const nx = len > 0.5 ? st.x / len : 1;
      const ny = len > 0.5 ? st.y / len : 0;
      const pad = st.radius + 240;
      PlayerAccess.updatePhysics({ x: st.x + nx * pad, y: st.y + ny * pad });
    } else if (sys?.asteroids?.length) {
      // Fallback: spawn near the first asteroid cluster
      const firstAst = sys.asteroids[0];
      const clusterId = firstAst.id.split("-")[2];
      const cluster = sys.asteroids.filter((a: Asteroid) => a.id.split("-")[2] === clusterId);
      let cx = 0, cy = 0;
      for (const a of cluster) { cx += a.x; cy += a.y; }
      cx /= cluster.length;
      cy /= cluster.length;
      const spawnAngle = Math.random() * Math.PI * 2;
      const spawnDist = 120 + Math.random() * 80;
      PlayerAccess.updatePhysics({ x: cx + Math.cos(spawnAngle) * spawnDist, y: cy + Math.sin(spawnAngle) * spawnDist });
    } else {
      PlayerAccess.updatePhysics({ x: 0, y: 0 });
    }
    PlayerAccess.updatePhysics({ px: getState().player.x, py: getState().player.y });
  }
}

/**
 * Validate player fitting and ensure they have at least one weapon.
 * If no weapon is found, adds a fallback weapon to the first empty turret slot.
 */
function validatePlayerFitting() {
  validateFitting();
  const hasWeapon = getState().player.fitting.turret.some((uid: string | null) => {
    if (!uid) return false;
    const inst = getInstance(uid);
    if (!inst) return false;
    const m = MODULES[inst.baseId];
    return m?.weaponDelivery && !MODULE_FLAGS.isMiningTurret(m);
  });
  if (!hasWeapon) {
    const firstEmpty = getState().player.fitting.turret.findIndex((id: string | null) => id === null);
    if (firstEmpty >= 0) {
      const fallbackUid = `${C.SPAWNING.FALLBACK_WEAPON.uidPrefix}-${Date.now()}`;
      PlayerAccess.addModuleCargo({
        uid: fallbackUid, baseId: C.SPAWNING.FALLBACK_WEAPON.moduleBaseId,
        rarity: ModuleRarity.Stock, itemLevel: C.SPAWNING.FALLBACK_WEAPON.itemLevel,
        durability: C.SPAWNING.FALLBACK_WEAPON.durability, maxDurability: C.SPAWNING.FALLBACK_WEAPON.maxDurability, affixes: [],
      });
      PlayerAccess.setFittingSlot("turret", firstEmpty, fallbackUid);
      validateFitting();
    }
  }
}

/**
 * Clamp player vitals to valid ranges.
 * Ensures HP and structure don't exceed maximums or go below minimums.
 */
function clampPlayerVitals() {
  if (getState().player.hp > getState().player.maxHp) PlayerAccess.setHp(getState().player.maxHp);
  if (getState().player.structure > getState().player.maxStructure) PlayerAccess.setStructure(getState().player.maxStructure);
  if (getState().player.structure < 0) PlayerAccess.setStructure(0);
}

/**
 * Initialize player game setup including spawn position, fitting validation, and vitals clamping.
 * This should be called after player data is loaded and galaxy is populated.
 */
export function initPlayerGameSetup() {
  setupPlayerSpawn();
  validatePlayerFitting();
  clampPlayerVitals();
}
