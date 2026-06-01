import { playerCoreAccess } from "./player/core.js";
import { playerFittingAccess } from "./player/fitting.js";
import { playerEconomyAccess } from "./player/economy.js";
import { playerTutorialScanningAccess } from "./player/tutorial-scanning.js";
import { playerMultiplayerAccess } from "./player/multiplayer.js";

export const PlayerAccess = {
  ...playerCoreAccess,
  ...playerFittingAccess,
  ...playerEconomyAccess,
  ...playerTutorialScanningAccess,
  ...playerMultiplayerAccess,
};
