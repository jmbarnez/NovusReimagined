/**
 * Boot Screen Profile Manager
 *
 * Renders the profile selection and creation screens inside the
 * left boot monitor. Keeps the right-monitor console for logs.
 */

import { sfxBlip, sfxConfirm } from "../../audio/procedural.js";
import { SHIPS } from "../../data/ships.js";
import { getState } from "../../state-access.js";
import { getProfiles, activateProfile, createProfile, deleteProfile, timeAgo, type ProfileMeta } from "../../data/profiles.js";
import { pushMonitorMenu } from "../monitor-nav.js";
import { makePlayer, validatePilotName } from "../../player/player-data.js";
import { computeStats } from "../../player/player-stats.js";
import { populateSystem } from "../../world-gen.js";
import { enterSpaceMode } from "../../game-loop.js";
import { logEvent } from "../hud-overlay.js";
import { t } from "../../utils/i18n.js";
import { ensurePlayerHasWeapon, clampPlayerVitals } from "../../utils/restore-save.js";
import { setupPlayerSpawn as resolveSpawn, needsSpawnResolution } from "../../utils/player-spawn.js";
import { initTutorial } from "../../tutorial.js";
import { initTutorialOverlay } from "../tutorial-overlay.js";
import { bindTitleScreenEvents } from "../title-screen.js";

/* ──────────────────────────────────────────────────────────── */
/*  Profile Selection Screen                                   */
/* ──────────────────────────────────────────────────────────── */

export function showProfileSelection(): void {
  const profiles = getProfiles();

  const cardsHtml = profiles.map((p) => renderProfileCard(p)).join("");

  const menuHtml = `
    <div class="profile-screen">
      <div class="profile-header">
        <div class="profile-title">NEURAL LINKS</div>
        <div class="profile-sub">SELECT PILOT PROFILE</div>
      </div>
      <div class="profile-grid">
        ${cardsHtml}
        <button type="button" id="profile-new" class="profile-card profile-card--new" aria-label="Create new profile">
          <div class="profile-new-icon">+</div>
          <div class="profile-new-label">NEW NEURAL LINK</div>
          <div class="profile-new-hint">Establish a new pilot identity</div>
        </button>
      </div>
      <div class="profile-footer">
        <button type="button" data-menu-back class="ld-btn-start ld-btn-secondary">BACK</button>
      </div>
    </div>
  `;

  pushMonitorMenu(menuHtml, (monitor) => {
    // Bind each existing profile card
    monitor.querySelectorAll("[data-profile-id]").forEach((card) => {
      const id = (card as HTMLElement).dataset.profileId!;

      // Continue button
      const continueBtn = card.querySelector("[data-profile-continue]");
      continueBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        sfxConfirm();
        if (activateProfile(id)) {
          enterSpaceMode();
          const sys = getState().GALAXY[getState().player.sysIdx];
          if (sys) {
            logEvent(`Neural link restored. System entry: ${sys.name} (SEC ${sys.security.toFixed(1)})`, "system");
          }
        }
      });

      // Delete button
      const delBtn = card.querySelector("[data-profile-delete]");
      delBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        sfxBlip();
        const pilotName = (card.querySelector(".profile-name") as HTMLElement)?.textContent ?? "this profile";
        if (!confirm(`Permanently delete pilot "${pilotName}"? This cannot be undone.`)) return;
        deleteProfile(id);
        showProfileSelection();
      });
    });

    // New profile card
    monitor.querySelector("#profile-new")?.addEventListener("click", () => {
      sfxBlip();
      showProfileCreation();
    });
  }, bindTitleScreenEvents);
}

/** Build the HTML for a single profile card. */
function renderProfileCard(p: ProfileMeta): string {
  const shipName = SHIPS[p.shipId]?.name ?? "Unknown Vessel";
  const systemName = getState().GALAXY[p.sysIdx]?.name ?? "Unknown Sector";
  const creditsFmt = p.credits.toLocaleString();
  const lastPlayed = timeAgo(p.updatedAt);

  return `
    <div class="profile-card" data-profile-id="${p.id}">
      <div class="profile-card-top">
        <div class="profile-avatar">${(p.pilotName || "?")[0].toUpperCase()}</div>
        <div class="profile-meta-col">
          <div class="profile-name">${escapeHtml(p.pilotName)}</div>
          <div class="profile-ship">${escapeHtml(shipName)}</div>
        </div>
      </div>
      <div class="profile-stats">
        <div class="profile-stat">
          <span class="profile-stat-lbl">LEVEL</span>
          <span class="profile-stat-val highlight-lvl">${p.level}</span>
        </div>
        <div class="profile-stat">
          <span class="profile-stat-lbl">LOCATION</span>
          <span class="profile-stat-val">${escapeHtml(systemName)}</span>
        </div>
        <div class="profile-stat">
          <span class="profile-stat-lbl">CREDITS</span>
          <span class="profile-stat-val highlight-credits">${creditsFmt} CR</span>
        </div>
        <div class="profile-stat">
          <span class="profile-stat-lbl">LAST PLAYED</span>
          <span class="profile-stat-val">${lastPlayed}</span>
        </div>
      </div>
      <div class="profile-actions">
        <button type="button" class="profile-continue-btn" data-profile-continue>CONTINUE</button>
        <button type="button" class="profile-delete-btn" data-profile-delete aria-label="Delete profile">×</button>
      </div>
    </div>
  `;
}

/* ──────────────────────────────────────────────────────────── */
/*  Profile Creation Screen (monitor-based)                    */
/* ──────────────────────────────────────────────────────────── */

function showProfileCreation(): void {
  const shipName = SHIPS.scout?.name ?? "Class-I Scout";

  const html = `
    <div class="profile-screen profile-screen--create">
      <div class="profile-header">
        <div class="profile-title">NEURAL LINK REGISTRY</div>
        <div class="profile-sub">ESTABLISH NEW PILOT IDENTITY</div>
      </div>
      <div class="profile-form">
        <div class="profile-field">
          <label for="profile-callsign">Callsign</label>
          <input
            type="text"
            id="profile-callsign"
            class="profile-input"
            maxlength="16"
            autocomplete="off"
            placeholder="Enter callsign..."
          />
          <div class="profile-error" id="profile-error"></div>
        </div>
        <div class="profile-field">
          <label>Hull Class</label>
          <div class="profile-readonly">${escapeHtml(shipName)}</div>
        </div>
      </div>
      <div class="profile-footer profile-footer--create">
        <button type="button" id="profile-establish" class="ld-btn-start">ESTABLISH LINK</button>
        <button type="button" data-menu-back class="ld-btn-start ld-btn-secondary">BACK</button>
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
        errorEl.textContent = result.error ?? t("pilot.invalidCallsign");
        sfxBlip();
        return;
      }

      sfxConfirm();
      errorEl.textContent = "";

      // Create a fresh player, populate the galaxy, and set up the spawn.
      const freshPlayer = makePlayer();
      freshPlayer.pilotName = result.name ?? input.value.trim();

      getState().player = freshPlayer;

      const sysIdx = freshPlayer.sysIdx || 0;
      if (!getState().GALAXY[sysIdx]) {
        getState().player.sysIdx = 0;
      }
      populateSystem(getState().GALAXY[getState().player.sysIdx]);

      if (needsSpawnResolution(getState().player)) {
        resolveSpawn(getState().player, getState().GALAXY);
      }

      ensurePlayerHasWeapon();
      computeStats();
      clampPlayerVitals();

      // Persist as a new profile.
      const profileId = createProfile(getState().player);
      logEvent(`Callsign registered: ${freshPlayer.pilotName}`, "system");

      // Enter the game.
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
    };

    establishBtn?.addEventListener("click", submit);
    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
      }
    });

    window.setTimeout(() => input?.focus(), 80);
  }, bindTitleScreenEvents);
}

/** Minimal HTML escape to prevent XSS from profile names. */
function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
