export type Language = "en" | "es";

import { bootStrings } from "./boot.js";
import { bridgeStrings } from "./bridge.js";
import { chatStrings } from "./chat.js";
import { combatStrings } from "./combat.js";
import { commonStrings } from "./common.js";
import { contractsStrings } from "./contracts.js";
import { decryptStrings } from "./decrypt.js";
import { enemyMenuStrings } from "./enemyMenu.js";
import { gameStrings } from "./game.js";
import { hangarStrings } from "./hangar.js";
import { hudStrings } from "./hud.js";
import { industryStrings } from "./industry.js";
import { inventoryStrings } from "./inventory.js";
import { loadingStrings } from "./loading.js";
import { mapStrings } from "./map.js";
import { marketStrings } from "./market.js";
import { missionStrings } from "./mission.js";
import { multiplayerStrings } from "./multiplayer.js";
import { pauseStrings } from "./pause.js";
import { perfStrings } from "./perf.js";
import { pilotStrings } from "./pilot.js";
import { pilotTerminalStrings } from "./pilotTerminal.js";
import { profileStrings } from "./profile.js";
import { settingsStrings } from "./settings.js";
import { shipStrings } from "./ship.js";
import { siteStrings } from "./site.js";
import { systemStrings } from "./system.js";
import { skillStrings } from "./skill.js";
import { stationStrings } from "./station.js";
import { timeAgoStrings } from "./timeAgo.js";
import { titleStrings } from "./title.js";
import { tooltipStrings } from "./tooltip.js";
import { tutorialStrings } from "./tutorial.js";
import { worldStrings } from "./world.js";

export const STRINGS: Record<Language, Record<string, string>> = {
  en: {
    ...bootStrings.en,
    ...bridgeStrings.en,
    ...chatStrings.en,
    ...combatStrings.en,
    ...commonStrings.en,
    ...contractsStrings.en,
    ...decryptStrings.en,
    ...enemyMenuStrings.en,
    ...gameStrings.en,
    ...hangarStrings.en,
    ...hudStrings.en,
    ...industryStrings.en,
    ...inventoryStrings.en,
    ...loadingStrings.en,
    ...mapStrings.en,
    ...marketStrings.en,
    ...missionStrings.en,
    ...multiplayerStrings.en,
    ...pauseStrings.en,
    ...perfStrings.en,
    ...pilotStrings.en,
    ...pilotTerminalStrings.en,
    ...profileStrings.en,
    ...settingsStrings.en,
    ...shipStrings.en,
    ...siteStrings.en,
    ...skillStrings.en,
    ...stationStrings.en,
    ...systemStrings.en,
    ...timeAgoStrings.en,
    ...titleStrings.en,
    ...tooltipStrings.en,
    ...tutorialStrings.en,
    ...worldStrings.en,
  },
  es: {
    ...bootStrings.es,
    ...bridgeStrings.es,
    ...chatStrings.es,
    ...combatStrings.es,
    ...commonStrings.es,
    ...contractsStrings.es,
    ...decryptStrings.es,
    ...enemyMenuStrings.es,
    ...gameStrings.es,
    ...hangarStrings.es,
    ...hudStrings.es,
    ...industryStrings.es,
    ...inventoryStrings.es,
    ...loadingStrings.es,
    ...mapStrings.es,
    ...marketStrings.es,
    ...missionStrings.es,
    ...multiplayerStrings.es,
    ...pauseStrings.es,
    ...perfStrings.es,
    ...pilotStrings.es,
    ...pilotTerminalStrings.es,
    ...profileStrings.es,
    ...settingsStrings.es,
    ...shipStrings.es,
    ...siteStrings.es,
    ...skillStrings.es,
    ...stationStrings.es,
    ...systemStrings.es,
    ...timeAgoStrings.es,
    ...titleStrings.es,
    ...tooltipStrings.es,
    ...tutorialStrings.es,
    ...worldStrings.es,
  },
};
