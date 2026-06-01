import type { DeltaSnapshot, EntitySnapshot, PlayerSnapshot, WorldSnapshot } from "./types.js";
import { setEntityDiff, setPlayerDiff } from "./helpers.js";

const DEEP_PLAYER_KEYS = new Set<keyof PlayerSnapshot>([
  "miningLaser",
  "salvager",
  "tractor",
  "gateCooldowns",
  "gatesCleared",
  "targetLock",
  "lockQueue",
  "turretTargets",
  "highTargets",
  "slotActive",
  "turretPower",
  "turretCds",
  "turretPowerCd",
  "slotPowerCd",
  "moduleHp",
  "fitting",
  "ore",
  "refined",
  "loot",
  "components",
  "ammo",
  "blueprints",
  "skills",
  "skillXp",
  "craftQueue",
  "hubQueue",
  "hubOutput",
  "hubDeposit",
  "moduleCargo",
  "contracts",
  "stationOffers",
]);

const DEEP_ENTITY_KEYS = new Set<keyof EntitySnapshot>(["miningLaser", "salvager", "tractor", "dmgProfile", "pts"]);

export function diffSnapshots(prev: WorldSnapshot, curr: WorldSnapshot): DeltaSnapshot {
  const delta: DeltaSnapshot = {
    tick: curr.tick,
    fromTick: prev.tick,
  };

  const playerDiff: Partial<PlayerSnapshot> = {};
  let playerChanged = false;
  for (const key of Object.keys(curr.player) as (keyof PlayerSnapshot)[]) {
    const prevVal = prev.player[key];
    const currVal = curr.player[key];
    const changed = DEEP_PLAYER_KEYS.has(key) ? JSON.stringify(prevVal) !== JSON.stringify(currVal) : currVal !== prevVal;
    if (changed) {
      setPlayerDiff(playerDiff, key, currVal);
      playerChanged = true;
    }
  }
  if (playerChanged) {
    delta.player = playerDiff;
  }

  const prevMap = new Map<string | number, EntitySnapshot>();
  for (const e of prev.entities) prevMap.set(e.id, e);

  const currMap = new Map<string | number, EntitySnapshot>();
  for (const e of curr.entities) currMap.set(e.id, e);

  const spawned: EntitySnapshot[] = [];
  const updated: Partial<EntitySnapshot>[] = [];
  const destroyed: (string | number)[] = [];

  for (const [id, currEnt] of currMap) {
    const prevEnt = prevMap.get(id);
    if (!prevEnt) {
      spawned.push(currEnt);
    } else {
      const entDiff: Partial<EntitySnapshot> = { id: currEnt.id };
      let changed = false;
      for (const key of Object.keys(currEnt) as (keyof EntitySnapshot)[]) {
        const prevVal = prevEnt[key];
        const currVal = currEnt[key];
        const fieldChanged = DEEP_ENTITY_KEYS.has(key) ? JSON.stringify(prevVal) !== JSON.stringify(currVal) : currVal !== prevVal;
        if (fieldChanged) {
          setEntityDiff(entDiff, key, currVal);
          changed = true;
        }
      }
      if (changed) {
        updated.push(entDiff);
      }
    }
  }

  for (const id of prevMap.keys()) {
    if (!currMap.has(id)) {
      destroyed.push(id);
    }
  }

  if (spawned.length || updated.length || destroyed.length) {
    delta.entities = {};
    if (spawned.length) delta.entities.spawned = spawned;
    if (updated.length) delta.entities.updated = updated;
    if (destroyed.length) delta.entities.destroyed = destroyed;
  }

  return delta;
}
