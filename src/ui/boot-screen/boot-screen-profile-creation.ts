/**
 * Boot Screen Profile Creation
 *
 * Handles the profile creation screen, including callsign validation,
 * player initialization, and new game session setup.
 */

import { sfxBlip, sfxConfirm } from "../../audio/procedural.js";
import { SHIPS } from "../../data/ships.js";
import { getState } from "../../state-access.js";
import { createProfile } from "../../data/profiles.js";
import { pushMonitorMenu } from "../monitor-nav.js";
import { makePlayer, validatePilotName } from "../../player/player-data.js";
import { enterSpaceMode } from "../../game-loop.js";
import { logEvent } from "../hud-overlay.js";
import { t } from "../../utils/i18n.js";
import { initGameSession } from "../../utils/restore-save.js";
import { setText, onClick, onKeydown } from "../dom-helpers.js";

/**
 * Show the profile creation screen for new players.
 */
export function showProfileCreation(): void {
  const shipName = SHIPS.scout?.name ?? t("profile.unknownVessel");

  const html = `
    <div class="profile-screen profile-screen--create">
      <button type="button" class="profile-back-btn" data-menu-back aria-label="${t("profile.back")}">← ${t("profile.back")}</button>
      <div class="profile-header">
        <div class="profile-title">${t("profile.registryTitle")}</div>
        <div class="profile-sub">${t("profile.registrySubtitle")}</div>
      </div>
      <div class="profile-form">
        <div class="profile-field">
          <label for="profile-callsign">${t("pilot.callsign")}</label>
          <input
            type="text"
            id="profile-callsign"
            class="profile-input"
            maxlength="16"
            autocomplete="off"
            placeholder="${t("pilot.callsignPlaceholder")}"
          />
          <div class="profile-error" id="profile-error"></div>
        </div>
        <div class="profile-field">
          <label>${t("pilot.hullClass")}</label>
          <div class="profile-readonly">${escapeHtml(shipName)}</div>
        </div>
      </div>
      <div class="profile-footer profile-footer--create">
        <button type="button" id="profile-establish" class="ld-btn-start">${t("profile.establishLink")}</button>
      </div>
    </div>
  `;

  pushMonitorMenu(html, (monitor) => {
    const input = monitor.querySelector("#profile-callsign") as HTMLInputElement;
    const errorEl = monitor.querySelector("#profile-error") as HTMLElement;
    const establishBtn = monitor.querySelector("#profile-establish") as HTMLButtonElement;

    const submit = () => {
      const result = validatePilotName(input.value);
      if (!result.ok) {
        setText(errorEl, result.error ?? t("pilot.invalidCallsign"));
        sfxBlip();
        return;
      }

      sfxConfirm();
      setText(errorEl, "");

      // Create a fresh player and initialize the session.
      const freshPlayer = makePlayer();
      freshPlayer.pilotName = result.name ?? input.value.trim();

      initGameSession(freshPlayer, { setupSpawn: true });

      // Persist as a new profile.
      const profileId = createProfile(getState().player);
      logEvent(t("profile.callsignRegistered", { name: freshPlayer.pilotName }), "system");

      // Enter the game.
      enterSpaceMode();

      const sys = getState().GALAXY[getState().player.sysIdx];
      if (sys) {
        logEvent(t("game.neuralLink", { sys: sys.name, sec: sys.security.toFixed(1) }), "system");
      }
    };

    if (establishBtn) onClick(establishBtn, submit);
    if (input) onKeydown(input, (e) => {
      if ((e as KeyboardEvent).key === "Enter") {
        (e as KeyboardEvent).preventDefault();
        submit();
      }
    });

    window.setTimeout(() => input?.focus(), 80);
  }, async (monitor) => {
    // On back, return to profile selection (or title screen if none remain)
    const { getProfiles } = await import("../../data/profiles.js");
    if (getProfiles().length === 0) {
      const { restoreTitleScreen } = await import("./boot-screen-title.js");
      restoreTitleScreen();
      return;
    }
    const { buildProfileSelectionHtml, bindProfileSelectionEvents } = await import("./boot-screen-profiles.js");
    const { setHtml } = await import("../dom-helpers.js");
    setHtml(monitor, buildProfileSelectionHtml());
    bindProfileSelectionEvents(monitor);
  });
}

/** Minimal HTML escape to prevent XSS from profile names. */
function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
