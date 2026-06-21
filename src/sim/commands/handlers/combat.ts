/**
 * Combat command handlers.
 *
 * Covers turret fire, tractor retraction, fire-control slot selection, and
 * module slot toggling (including ability activation).
 */
import type { Player } from "../../../state.js";
import { PlayerAccess } from "../../../state-access.js";
import { fireSelectedTurret } from "../../../combat/turret-control.js";
import { detachTractorBeam } from "../../../player/tractor.js";
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
      | "retractTractorBeam"
      | "setFireControlSlot"
      | "toggleSlotDefaultAction";
  }
>;

export function handleCombatCommand(command: CombatCommand, p: Player): void {
  switch (command.type) {
    case "fireSelectedTurret":
      fireSelectedTurret(p);
      break;
    case "retractTractorBeam":
      detachTractorBeam(p);
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
  }
}
