/**
 * Boot Screen Profile Continue Logic
 *
 * Handles the continue/save profile loading flow, including
 * loading phases and UI state management during profile restoration.
 */

import { sfxConfirm } from "../../audio/procedural.js";
import { getState } from "../../state-access.js";
import { activateProfile } from "../../data/profiles.js";
import { enterSpaceMode } from "../../game-loop.js";
import { logEvent } from "../hud-overlay.js";
import { t } from "../../utils/i18n.js";
import { restoreGameFromSave } from "../../utils/restore-save.js";
import { bindTitleScreenEvents, restoreTitleScreen } from "./boot-screen-title.js";
import { query, setHtml } from "../dom-helpers.js";

type ContinueLoadingPhase = "restore" | "simulation" | "sync" | "enter";

let profileContinueInFlight = false;

/**
 * Continue a saved profile by activating it, restoring game state,
 * and entering space mode with loading phase feedback.
 */
export async function continueSavedProfile(
  id: string,
  continueBtn: HTMLButtonElement,
  monitor: HTMLElement,
  onError?: (errorMessage: string) => void
): Promise<void> {
  if (profileContinueInFlight) return;
  profileContinueInFlight = true;

  try {
    sfxConfirm();
    setProfileControlsDisabled(monitor, true);
    continueBtn.disabled = true;

    renderContinueLoading("restore");
    if (!activateProfile(id)) {
      throw new Error("Profile activation failed");
    }

    renderContinueLoading("simulation");
    if (!restoreGameFromSave()) {
      throw new Error("Save restoration failed");
    }

    renderContinueLoading("sync");
    await enterSpaceMode({
      reconnectLocal: true,
      onPhase: (phase) => {
        renderContinueLoading(phase === "entering" ? "enter" : "sync");
      },
    });

    const sys = getState().GALAXY[getState().player.sysIdx];
    if (sys) {
      logEvent(t("game.neuralRestored", { sys: sys.name, sec: sys.security.toFixed(1) }), "system");
    }
  } catch (err) {
    console.warn("[Profiles] Continue failed:", err);
    restoreTitleScreen();
    // Re-render profile selection with error message
    if (onError) {
      onError(t("profile.loadingFailed"));
    } else {
      const { showProfileSelection } = await import("./boot-screen-profiles.js");
      showProfileSelection(t("profile.loadingFailed"));
    }
  } finally {
    profileContinueInFlight = false;
  }
}

/**
 * Disable or enable all profile control buttons during loading.
 */
export function setProfileControlsDisabled(monitor: HTMLElement, disabled: boolean): void {
  monitor
    .querySelectorAll<HTMLButtonElement>("[data-profile-continue], [data-profile-delete], #profile-delete-all, #profile-new-game")
    .forEach((button) => {
      button.disabled = disabled;
    });
}

/**
 * Render the loading screen with progress bar for profile continue flow.
 */
function renderContinueLoading(phase: ContinueLoadingPhase): void {
  const monitor = query(".monitor-center .monitor-content");
  if (!monitor) return;

  const steps: ContinueLoadingPhase[] = ["restore", "simulation", "sync", "enter"];
  const index = steps.indexOf(phase);
  const width = `${Math.max(15, Math.round(((index + 1) / steps.length) * 100))}%`;

  setHtml(monitor, `
    <div class="profile-continue-loading" aria-busy="true">
      <div class="ld-title">NOVUS</div>
      <div class="ld-sep"></div>
      <div class="ld-sub">${t("profile.loadingSubtitle")}</div>
      <div class="ld-status profile-continue-status">${t(getContinueLoadingKey(phase))}<span class="ld-dots"></span></div>
      <div class="ld-progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(((index + 1) / steps.length) * 100)}">
        <div class="ld-progress-fill" style="width: ${width};"></div>
      </div>
    </div>
  `);
}

/**
 * Get the i18n key for a given loading phase.
 */
function getContinueLoadingKey(phase: ContinueLoadingPhase): string {
  switch (phase) {
    case "restore":
      return "profile.loadingRestore";
    case "simulation":
      return "profile.loadingSimulation";
    case "sync":
      return "profile.loadingSync";
    case "enter":
      return "profile.loadingEnter";
  }
}
