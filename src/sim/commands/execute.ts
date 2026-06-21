/**
 * Game command dispatcher.
 *
 * Routes a validated {@link GameCommand} to its domain handler under
 * `./handlers/`. Each handler owns a slice of the command surface and
 * performs its own payload validation before mutating server-authoritative
 * state. The dispatcher is a thin type-narrowing switch — no business logic
 * lives here.
 */
import type { Player } from "../../state.js";
import type { GameCommand } from "./types.js";
import { handleCombatCommand } from "./handlers/combat.js";
import { handleScanningCommand } from "./handlers/scanning.js";
import { handleIndustryCommand } from "./handlers/industry.js";
import { handleSitesCommand } from "./handlers/sites.js";
import { handleDockingCommand } from "./handlers/docking.js";
import { handleWarpCommand } from "./handlers/warp.js";
import { handleTutorialCommand } from "./handlers/tutorial.js";

export function executeGameCommand(command: GameCommand, p: Player): void {
  switch (command.type) {
    case "fireSelectedTurret":
    case "setFireControlSlot":
    case "toggleSlotDefaultAction":
    case "assignModuleSlotToTarget":
    case "setHighTarget":
    case "requestSensorLock":
    case "removeSensorLock":
    case "selectLockTarget":
    case "clearSensorLocks":
    case "setTractorTightness":
      return handleCombatCommand(command, p);

    case "setMapScannerPower":
    case "setMapScannerCone":
    case "setMapScannerStrength":
    case "startScanPulse":
      return handleScanningCommand(command, p);

    case "queueIndustryJob":
    case "cancelIndustryJob":
    case "buyBlueprint":
    case "buyAmmunition":
    case "sellCargoResource":
    case "setHomeSystem":
    case "jettisonItem":
    case "repairShip":
    case "fitModule":
    case "unfitModule":
    case "swapModule":
    case "turnInContract":
    case "abandonContract":
    case "buyModule":
    case "sellModule":
    case "acceptContract":
    case "processHubFloatingItem":
    case "processHubMixedOre":
    case "separateHubMaterial":
    case "alloyHubMaterial":
    case "collectHubOutput":
      return handleIndustryCommand(command, p);

    case "interactSite":
    case "completeSite":
      return handleSitesCommand(command, p);

    case "dock":
    case "undock":
      return handleDockingCommand(command, p);

    case "warp":
    case "warpGate":
      return handleWarpCommand(command, p);

    case "syncTutorialStep":
    case "skipTutorial":
      return handleTutorialCommand(command, p);
  }
}
