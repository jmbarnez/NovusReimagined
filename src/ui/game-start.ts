import { Client } from "../state.js";
import { WorldAccess, PlayerAccess, getState } from "../state-access.js";
import { makePlayer, savePlayer } from "../player/player-data.js";
import { computeStats } from "../player/player-stats.js";
import { populateSystem } from "../world-gen.js";
import { enterSpaceMode } from "../game-loop.js";
import { logEvent } from "./hud-overlay.js";
import { t } from "../utils/i18n.js";
import { ensurePlayerHasWeapon, clampPlayerVitals } from "../utils/restore-save.js";
import { setupPlayerSpawn as resolveSpawn, needsSpawnResolution } from "../utils/player-spawn.js";
import { initTutorial } from "../tutorial.js";
import { initTutorialOverlay } from "./tutorial-overlay.js";
import { showPilotProfileScreen } from "./pilot-profile.js";

function applyNewGameSpawn(): void {
  if (needsSpawnResolution(getState().player)) {
    resolveSpawn(getState().player, getState().GALAXY);
    PlayerAccess.updatePhysics({ x: getState().player.x, y: getState().player.y, px: getState().player.px, py: getState().player.py });
    PlayerAccess.setPendingHomeSpawn(false);
  }
}

/** Fresh save + profile screen, then enter space (solo new game). */
export function startNewGameWithProfile(onCancel?: () => void): void {
  const freshPlayer = makePlayer();
  WorldAccess.initPlayer(freshPlayer);

  const sysIdx = getState().player.sysIdx || 0;
  if (!getState().GALAXY[sysIdx]) PlayerAccess.setSysIdx(0);
  populateSystem(getState().GALAXY[getState().player.sysIdx]);

  applyNewGameSpawn();
  ensurePlayerHasWeapon();
  computeStats(getState().player);
  clampPlayerVitals();
  savePlayer();

  Client.camx = getState().player.x;
  Client.camy = getState().player.y;

  showPilotProfileScreen(
    () => {
      enterSpaceMode();
      if (getState().player.tutorial.active) {
        initTutorial();
        initTutorialOverlay(true);
      } else {
        initTutorialOverlay(false);
      }
      const sys = getState().GALAXY[getState().player.sysIdx];
      if (sys) {
        logEvent(t("game.neuralLink", { sys: sys.name, sec: sys.security.toFixed(1) }), "system");
      }
    },
    onCancel,
  );
}
