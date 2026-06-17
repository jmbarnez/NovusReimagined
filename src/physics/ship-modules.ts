/**
 * Module capacitor drain and boost state computation for the player ship.
 */
import { PlayerAccess } from "../state-access.js";
import { MODULES, MODULE_FLAGS } from "../data/modules.js";
import { RACK_TYPES } from "../constants.js";
import { C } from "../config/index.js";
import { getIonBoostModuleState, ION_BOOST_MODULE_ID } from "../player/boost-module.js";
import { invalidate } from "../player/player-stats.js";
import type { Player } from "../state.js";
import type { ModuleInstance } from "../types/moduleInstance.js";

export interface CapDrainResult {
  capDrained: boolean;
  anyStateChanged: boolean;
}

/** Drain capacitor for active fitted modules.  Mutates player state. */
export function processModuleCapDrain(
  p: Player,
  dt: number,
  cargoMap: Map<string, ModuleInstance>,
  isThrusting: boolean,
): CapDrainResult {
  let capDrained = false;
  let anyStateChanged = false;

  for (const rack of RACK_TYPES) {
    const slots = p.fitting?.[rack] || [];
    for (let i = 0; i < slots.length; i++) {
      const uid = slots[i];
      if (!uid) continue;
      const inst = cargoMap.get(uid);
      if (!inst) continue;
      const m = MODULES[inst.baseId];
      if (!m?.isActive || !m.capDrainPerSec) continue;
      if (MODULE_FLAGS.isTractor(m)) continue;
      if (!(p.slotActive?.[rack]?.[i] ?? true)) continue;
      if (inst.baseId === ION_BOOST_MODULE_ID && !isThrusting) continue;
      const drain = m.capDrainPerSec * dt;
      if (p.energy >= drain) {
        PlayerAccess.setEnergy(p.energy - drain, p);
        capDrained = true;
      } else {
        PlayerAccess.setSlotActive(rack, i, false, p);
        anyStateChanged = true;
      }
    }
  }
  if (anyStateChanged) invalidate(p);

  return { capDrained, anyStateChanged };
}

export interface BoostState {
  boostThrustMult: number;
  boostSpeedMult: number;
  boostActive: boolean;
}

/** Compute boost multipliers and drain capacitor if active.  Mutates player state. */
export function computeBoostState(
  p: Player,
  dt: number,
  cargoMap: Map<string, ModuleInstance>,
  boostRequested: boolean,
  isApplyingThrust: boolean,
): BoostState {
  const boostModule = getIonBoostModuleState(p, cargoMap);
  if (p.boostLockout === true) PlayerAccess.updatePhysics({ boostLockout: false }, p);

  const boostCapMult = boostModule.online ? C.PHYSICS.SHIP.boostModuleCapCostMult : 1;
  const boostDrain = C.PHYSICS.SHIP.boostCapDrainPerSec * boostCapMult * dt;
  const boostActive = boostRequested
    && isApplyingThrust
    && p.energy >= Math.max(C.PHYSICS.SHIP.boostMinEnergyToStart, boostDrain);

  let boostThrustMult = 1;
  let boostSpeedMult = 1;

  if (boostActive) {
    PlayerAccess.setEnergy(Math.max(0, p.energy - boostDrain), p);
    boostThrustMult = C.PHYSICS.SHIP.boostBaseThrustMult
      + (boostModule.online ? C.PHYSICS.SHIP.boostModuleThrustBonus : 0);
    boostSpeedMult = C.PHYSICS.SHIP.boostBaseSpeedMult
      + (boostModule.online ? C.PHYSICS.SHIP.boostModuleSpeedBonus : 0);
  }

  return { boostThrustMult, boostSpeedMult, boostActive };
}
