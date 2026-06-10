/**
 * Boot Screen Profile Manager
 *
 * Renders the profile selection screen inside the left boot monitor.
 * Profile creation and continue logic are extracted to separate modules.
 */

import { sfxBlip } from "../../audio/procedural.js";
import { SHIPS } from "../../data/ships.js";
import { getState } from "../../state-access.js";
import { getProfiles, getActiveProfileId, deleteProfile, deleteAllProfiles, timeAgo, formatPlayTime, type ProfileMeta } from "../../data/profiles.js";
import { pushMonitorMenu, bindBackButtons } from "../monitor-nav.js";
import { t } from "../../utils/i18n.js";
import { continueSavedProfile } from "./boot-screen-profile-continue.js";
import { bindTitleScreenEvents } from "./boot-screen-title.js";
import { showProfileCreation } from "./boot-screen-profile-creation.js";
import { setHtml, onClick } from "../dom-helpers.js";

/* ──────────────────────────────────────────────────────────── */
/*  Profile Selection Screen                                   */
/* ──────────────────────────────────────────────────────────── */

/**
 * Build the HTML for the profile selection screen.
 */
export function buildProfileSelectionHtml(errorMessage = ""): string {
  const profiles = getProfiles().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const activeId = getActiveProfileId();
  const cardsHtml = profiles.map((p) => renderProfileCard(p, p.id === activeId)).join("");

  return `
    <div class="profile-screen">
      <div class="profile-header">
        <div class="profile-title">${t("profile.title")}</div>
        <div class="profile-sub">${t("profile.subtitle")}</div>
      </div>
      ${errorMessage ? `<div class="profile-error profile-error--banner">${escapeHtml(errorMessage)}</div>` : ""}
      <div class="profile-grid">
        ${cardsHtml}
      </div>
      <div class="profile-button-row">
        <button type="button" class="profile-back-btn" data-menu-back aria-label="${t("profile.back")}">← ${t("profile.back")}</button>
        <div class="profile-actions-right">
          <button type="button" id="profile-delete-all" class="profile-action-btn profile-action-btn--danger" aria-label="${t("profile.deleteAllHint")}">
            ${t("profile.deleteAll")}
          </button>
          <button type="button" id="profile-new-game" class="profile-action-btn profile-action-btn--primary" aria-label="${t("profile.newGameHint")}">
            ${t("profile.newGame")}
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Re-render the profile selection screen in-place without pushing a new menu.
 * Preserves the original restore callback so the back button still works.
 */
function refreshProfileSelection(monitor: HTMLElement, errorMessage = ""): void {
  setHtml(monitor, buildProfileSelectionHtml(errorMessage));
  bindProfileSelectionEvents(monitor);
  bindBackButtons(monitor);
}

/**
 * Bind event handlers for the profile selection screen.
 */
export function bindProfileSelectionEvents(monitor: HTMLElement): void {
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
      refreshProfileSelection(monitor);
    });
  });

  const deleteAllBtn = monitor.querySelector("#profile-delete-all");
  if (deleteAllBtn) onClick(deleteAllBtn, () => {
    sfxBlip();
    if (!confirm(t("profile.confirmDeleteAll"))) return;
    deleteAllProfiles();
    refreshProfileSelection(monitor);
  });

  const newGameBtn = monitor.querySelector("#profile-new-game");
  if (newGameBtn) onClick(newGameBtn, () => {
    sfxBlip();
    showProfileCreation();
  });
}

/**
 * Show the profile selection screen.
 */
export function showProfileSelection(errorMessage = ""): void {
  const menuHtml = buildProfileSelectionHtml(errorMessage);
  pushMonitorMenu(menuHtml, (monitor) => {
    bindProfileSelectionEvents(monitor);
  }, bindTitleScreenEvents);
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
          <span class="profile-stat-lbl">${t("profile.credits")}</span>
          <span class="profile-stat-val highlight-credits">${creditsFmt}${t("pilotTerminal.creditsSuffix")}</span>
        </div>
        <div class="profile-stat profile-stat--wide">
          <span class="profile-stat-lbl">${t("profile.location")}</span>
          <span class="profile-stat-val">${escapeHtml(systemName)}</span>
        </div>
      </div>
      <div class="profile-meta-row">
        <span class="profile-meta-item">${t("profile.lastPlayed")}: ${lastPlayed}</span>
        <span class="profile-meta-item">${t("profile.playTime")}: ${formatPlayTime(p.playTimeMs)}</span>
      </div>
      <div class="profile-actions">
        <button type="button" class="profile-continue-btn" data-profile-continue>${t("profile.continue")}</button>
        <button type="button" class="profile-delete-btn" data-profile-delete aria-label="${t("profile.delete")}">×</button>
      </div>
    </div>
  `;
}

/** Minimal HTML escape to prevent XSS from profile names. */
function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
