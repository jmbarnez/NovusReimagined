/**
 * Warp command handlers: system-to-system warp via target index and warp-gate
 * traversal by stable gate id (only when the gate is charging/active).
 */
import type { Player } from "../../../state.js";
import { getState } from "../../../state-access.js";
import { beginWarpThroughGate } from "../../../docking/index.js";
import { gateStableId } from "../../../utils/warp-gates.js";
import type { GameCommand } from "../types.js";

export type WarpCommand = Extract<GameCommand, { type: "warp" | "warpGate" }>;

export function handleWarpCommand(command: WarpCommand, p: Player): void {
  switch (command.type) {
    case "warp": {
      const targetIdx = command.payload?.targetIdx;
      if (typeof targetIdx !== "number") break;
      const sys = getState().GALAXY[p.sysIdx];
      if (!sys) break;
      const gate = sys.gates?.find((g) => g.targetSysIdx === targetIdx);
      if (gate) {
        beginWarpThroughGate(gate, p);
      }
      break;
    }
    case "warpGate": {
      const gateId = command.payload?.gateId;
      if (typeof gateId !== "string") break;
      const sys = getState().GALAXY[p.sysIdx];
      if (!sys) break;
      const gate = sys.gates?.find((g) => gateStableId(g) === gateId);
      if (gate && (gate.gateState === "charging" || gate.gateState === "active")) {
        beginWarpThroughGate(gate, p);
      }
      break;
    }
  }
}
