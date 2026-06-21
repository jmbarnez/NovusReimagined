/**
 * Tutorial command handlers: tutorial step sync (with track-state reset) and
 * tutorial skip (mark skipped/complete, set home system, remove the academy
 * training contract).
 */
import type { Player } from "../../../state.js";
import { PlayerAccess } from "../../../state-access.js";
import { resetTutorialTrackState } from "../../../physics/tutorial-track.js";
import type { GameCommand } from "../types.js";

export type TutorialCommand = Extract<GameCommand, { type: "syncTutorialStep" | "skipTutorial" }>;

export function handleTutorialCommand(command: TutorialCommand, p: Player): void {
  switch (command.type) {
    case "syncTutorialStep":
      PlayerAccess.setTutorialState(command.payload, p);
      resetTutorialTrackState(p);
      break;
    case "skipTutorial": {
      PlayerAccess.setTutorialSkipped(p);
      PlayerAccess.setTutorialComplete(p);
      PlayerAccess.setHomeSysIdx(command.payload.primeIdx, p);
      resetTutorialTrackState(p);
      if (p.contracts) {
        const idx = p.contracts.findIndex((contract) => contract.id === "mc_academy_training");
        if (idx >= 0) PlayerAccess.removeContract(idx, p);
      }
      break;
    }
  }
}
