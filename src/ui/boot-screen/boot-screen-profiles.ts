/**
 * Boot Screen Profile Manager
 *
 * Renders the profile selection and creation screens inside the
 * left boot monitor. Keeps the right-monitor console for logs.
 */

import { sfxBlip, sfxConfirm } from "../../audio/procedural.js";
import { SHIPS } from "../../data/ships.js";
import { getState } from "../../state-access.js";
import { getProfiles, getActiveProfileId, activateProfile, createProfile, deleteProfile, timeAgo, type ProfileMeta } from "../../data/profiles.js";
import { pushMonitorMenu } from "../monitor-nav.js";
import { makePlayer, validatePilotName } from "../../player/player-data.js";
import { enterSpaceMode } from "../../game-loop.js";
import { logEvent } from "../hud-overlay.js";
import { t } from "../../utils/i18n.js";
import { initGameSession, restoreGameFromSave } from "../../utils/restore-save.js";
import { bindTitleScreenEvents, restoreTitleScreen } from "../title-screen.js";
import { query, setHtml, setText, onClick, onKeydown } from "../dom-helpers.js";

type ContinueLoadingPhase = "restore" | "simulation" | "sync" | "enter";

let profileContinueInFlight = false;

/* ──────────────────────────────────────────────────────────── */
/*  Profile Selection Screen                                   */
/* ──────────────────────────────────────────────────────────── */

function buildProfileSelectionHtml(errorMessage = ""): string {
  const profiles = getProfiles();
  const activeId = getActiveProfileId();
  const cardsHtml = profiles.map((p) => renderProfileCard(p, p.id === activeId)).join("");

  return `
    <div class="profile-screen">
      <button type="button" class="profile-back-btn" data-menu-back aria-label="${t("profile.back")}">← ${t("profile.back")}</button>
      <div class="profile-header">
        <div class="profile-title">${t("profile.title")}</div>
        <div class="profile-sub">${t("profile.subtitle")}</div>
      </div>
      ${errorMessage ? `<div class="profile-error profile-error--banner">${escapeHtml(errorMessage)}</div>` : ""}
      <div class="profile-grid">
        ${cardsHtml}
        <button type="button" id="profile-new" class="profile-card profile-card--new" aria-label="${t("profile.newHint")}">
          <div class="profile-new-icon">+</div>
          <div class="profile-new-label">${t("profile.newLink")}</div>
          <div class="profile-new-hint">${t("profile.newHint")}</div>
        </button>
      </div>
    </div>
  `;
}

function bindProfileSelectionEvents(monitor: HTMLElement): void {
  monitor.querySelectorAll("[data-profile-id]").forEach((card) => {
    const id = (card as HTMLElement).dataset.profileId!;

    const continueBtn = card.querySelector("[data-profile-continue]") as HTMLButtonElement | null;
    if (continueBtn) onClick(continueBtn, (e) => {
      (e as MouseEvent).stopPropagation();
      void continueSavedProfile(id, continueBtn, monitor);
    });

    const delBtn = card.querySelector("[data-profile-delete]");
    if (delBtn) onClick(delBtn, (e) => {
      (e as MouseEvent).stopPropagation();
      sfxBlip();
      const pilotName = (card.querySelector(".profile-name") as HTMLElement)?.textContent ?? t("pilotTerminal.thisProfile");
      if (!confirm(t("profile.confirmDelete", { name: pilotName }))) return;
      deleteProfile(id);
      showProfileSelection();
    });
  });

  const profileNew = monitor.querySelector("#profile-new");
  if (profileNew) onClick(profileNew, () => {
    sfxBlip();
    showProfileCreation();
  });
}

export function showProfileSelection(errorMessage = ""): void {
  const menuHtml = buildProfileSelectionHtml(errorMessage);
  pushMonitorMenu(menuHtml, (monitor) => {
    bindProfileSelectionEvents(monitor);
  }, bindTitleScreenEvents);
}

async function continueSavedProfile(id: string, continueBtn: HTMLButtonElement, monitor: HTMLElement): Promise<void> {
  if (profileContinueInFlight) return;
  profileContinueInFlight = true;

  sfxConfirm();
  setProfileControlsDisabled(monitor, true);
  continueBtn.disabled = true;

  try {
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
    showProfileSelection(t("profile.loadingFailed"));
  } finally {
    profileContinueInFlight = false;
  }
}

function setProfileControlsDisabled(monitor: HTMLElement, disabled: boolean): void {
  monitor
    .querySelectorAll<HTMLButtonElement>("[data-profile-continue], [data-profile-delete], #profile-new")
    .forEach((button) => {
      button.disabled = disabled;
    });
}

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

/** Build the HTML for a single profile card. */
function renderProfileCard(p: ProfileMeta, isActive = false): string {
  const shipName = SHIPS[p.shipId]?.name ?? t("profile.unknownVessel");
  const systemName = getState().GALAXY[p.sysIdx]?.name ?? t("profile.unknownSector");
  const creditsFmt = p.credits.toLocaleString();
  const lastPlayed = timeAgo(p.updatedAt);
  const activeClass = isActive ? "profile-card--active" : "";

  return `
    <div class="profile-card ${activeClass}" data-profile-id="${p.id}">
      <span class="profile-card-led" aria-hidden="true"></span>
      <div class="profile-card-top">
        <div class="profile-avatar">${(p.pilotName || "?")[0].toUpperCase()}</div>
        <div class="profile-meta-col">
          <div class="profile-name">${escapeHtml(p.pilotName)}</div>
          <div class="profile-ship">${escapeHtml(shipName)}</div>
        </div>
      </div>
      <div class="profile-stats">
        <div class="profile-stat">
          <span class="profile-stat-lbl">${t("profile.level")}</span>
          <span class="profile-stat-val highlight-lvl">${p.level}</span>
        </div>
        <div class="profile-stat">
          <span class="profile-stat-lbl">${t("profile.location")}</span>
          <span class="profile-stat-val">${escapeHtml(systemName)}</span>
        </div>
        <div class="profile-stat">
          <span class="profile-stat-lbl">${t("profile.credits")}</span>
          <span class="profile-stat-val highlight-credits">${creditsFmt}${t("pilotTerminal.creditsSuffix")}</span>
        </div>
        <div class="profile-stat">
          <span class="profile-stat-lbl">${t("profile.lastPlayed")}</span>
          <span class="profile-stat-val">${lastPlayed}</span>
        </div>
      </div>
      <div class="profile-actions">
        <button type="button" class="profile-continue-btn" data-profile-continue>${t("profile.continue")}</button>
        <button type="button" class="profile-delete-btn" data-profile-delete aria-label="${t("profile.delete")}">×</button>
      </div>
    </div>
  `;
}

/* ──────────────────────────────────────────────────────────── */
/*  Profile Creation Screen (monitor-based)                    */
/* ──────────────────────────────────────────────────────────── */

function showProfileCreation(): void {
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
  }, (monitor) => {
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
