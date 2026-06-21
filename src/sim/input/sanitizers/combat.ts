/**
 * Combat / targeting action sanitizers.
 */
import type { GameCommand } from "../../commands.js";
import {
  RACK_IDS,
  isRecord,
  numberPayload,
  optionalPayloadRecord,
  stringPayload,
} from "../sanitize-helpers.js";

export function sanitizeCombatAction(action: Record<string, unknown>): GameCommand | null {
  switch (action.type) {
    case "fireSelectedTurret":
      return { type: "fireSelectedTurret" };
    case "setFireControlSlot": {
      const slot = numberPayload(action, "slot");
      return slot == null ? null : { type: "setFireControlSlot", payload: { slot } };
    }
    case "toggleSlotDefaultAction": {
      const payload = optionalPayloadRecord(action);
      if (typeof payload.rack !== "string" || !RACK_IDS.has(payload.rack)) return null;
      if (typeof payload.idx !== "number" || !Number.isFinite(payload.idx)) return null;
      return { type: "toggleSlotDefaultAction", payload: { rack: payload.rack, idx: payload.idx } };
    }
    case "assignModuleSlotToTarget": {
      const payload = optionalPayloadRecord(action);
      if (typeof payload.slotIdx !== "number" || !Number.isFinite(payload.slotIdx)) return null;
      if (payload.targetId !== null && typeof payload.targetId !== "string") return null;
      const opts = isRecord(payload.opts)
        ? { clearAssign: payload.opts.clearAssign === true, silent: payload.opts.silent === true }
        : undefined;
      return { type: "assignModuleSlotToTarget", payload: { slotIdx: payload.slotIdx, targetId: payload.targetId, opts } };
    }
    case "setHighTarget": {
      const payload = optionalPayloadRecord(action);
      if (typeof payload.idx !== "number" || !Number.isFinite(payload.idx)) return null;
      if (payload.targetId !== null && typeof payload.targetId !== "string") return null;
      return { type: "setHighTarget", payload: { idx: payload.idx, targetId: payload.targetId } };
    }
    case "requestSensorLock":
    case "removeSensorLock":
    case "selectLockTarget": {
      const id = stringPayload(action, "id");
      return id == null ? null : { type: action.type, payload: { id } };
    }
    case "clearSensorLocks":
      return { type: "clearSensorLocks" };
    case "setTractorTightness": {
      const value = numberPayload(action, "value");
      return value == null ? null : { type: "setTractorTightness", payload: { value } };
    }
    default:
      return null;
  }
}
