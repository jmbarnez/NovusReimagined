/**
 * Combat / targeting command handlers.
 *
 * Covers turret fire, fire-control slot selection, module slot toggling
 * (including ability activation), module-to-target assignment, high-slot
 * target selection, sensor lock lifecycle, and tractor tightness.
 */
import type { Player } from "../../../state.js";
import { PlayerAccess } from "../../../state-access.js";
import { fireSelectedTurret } from "../../../combat/turret-control.js";
import {
  assignModuleSlotToTarget,
  clearSensorLocks,
  requestSensorLock,
  removeSensorLock,
  selectLockTarget,
} from "../../../targeting.js";
import { applyToggleSlotMutation } from "../../../player/player-fitting.js";
import { tryActivate as tryActivateAbility, ABILITY_BY_ID } from "../../../player/abilities.js";
import { MODULES } from "../../../data/modules.js";
import { getInstance } from "../../../utils/items.js";
import type { GameCommand } from "../types.js";
import { isRackId, isValidHardpointIndex, isValidSlotIndex } from "../validators.js";

export type CombatCommand = Extract<
  GameCommand,
  {
    type:
      | "fireSelectedTurret"
      | "setFireControlSlot"
      | "toggleSlotDefaultAction"
      | "assignModuleSlotToTarget"
      | "setHighTarget"
      | "requestSensorLock"
      | "removeSensorLock"
      | "selectLockTarget"
      | "clearSensorLocks"
      | "setTractorTightness";
  }
>;

export function handleCombatCommand(command: CombatCommand, p: Player): void {
  switch (command.type) {
    case "fireSelectedTurret":
      fireSelectedTurret(p);
      break;
    case "setFireControlSlot":
      if (!isValidHardpointIndex(command.payload.slot, p)) break;
      PlayerAccess.setFireControlSlot(command.payload.slot, p);
      break;
    case "toggleSlotDefaultAction": {
      const { rack, idx } = command.payload;
      if (!isRackId(rack)) break;
      if (!isValidSlotIndex(idx, rack, p)) break;
      const instanceId = p.fitting[rack]?.[idx];
      const instance = instanceId ? getInstance(instanceId, p) : null;
      const m = instance ? MODULES[instance.baseId] : null;
      if (!m) break;
      if (m.ability && ABILITY_BY_ID[m.ability]) {
        tryActivateAbility(m.ability, p);
        break;
      }
      applyToggleSlotMutation(rack, idx, p);
      break;
    }
    case "assignModuleSlotToTarget":
      if (!isValidHardpointIndex(command.payload.slotIdx, p)) break;
      if (command.payload.targetId !== null && typeof command.payload.targetId !== "string") break;
      assignModuleSlotToTarget(
        command.payload.slotIdx,
        command.payload.targetId,
        p,
        { ...command.payload.opts, suppressFrameAction: true },
      );
      break;
    case "setHighTarget":
      if (!Number.isInteger(command.payload.idx) || command.payload.idx < 0) break;
      if (command.payload.targetId !== null && typeof command.payload.targetId !== "string") break;
      PlayerAccess.setHighTarget(command.payload.idx, command.payload.targetId, p);
      break;
    case "requestSensorLock":
      if (!command.payload.id) break;
      requestSensorLock(command.payload.id, p, { suppressFrameAction: true });
      break;
    case "removeSensorLock":
      if (!command.payload.id) break;
      removeSensorLock(command.payload.id, p, { suppressFrameAction: true });
      break;
    case "selectLockTarget":
      if (!command.payload.id) break;
      selectLockTarget(command.payload.id, p, { suppressFrameAction: true });
      break;
    case "clearSensorLocks":
      clearSensorLocks(p, { suppressFrameAction: true });
      break;
    case "setTractorTightness":
      if (!Number.isFinite(command.payload.value)) break;
      PlayerAccess.setTractorTightness(Math.max(0, Math.min(1, command.payload.value)), p);
      break;
  }
}
