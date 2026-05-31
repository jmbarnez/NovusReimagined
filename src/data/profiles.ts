/**
 * Profile Manager
 *
 * Manages multiple pilot profiles stored in localStorage.
 * Each profile is a self-contained player save. The active profile
 * is staged in the legacy SAVE_KEY during gameplay for backward
 * compatibility with the existing save/load pipeline.
 */

import { SAVE_KEY } from "../constants.js";
import { getState } from "../state-access.js";
import type { Player } from "../state.js";
import { loadPlayer, savePlayer } from "../player/player-data.js";
import { t } from "../utils/i18n.js";

const PROFILES_INDEX_KEY = "novus-profiles-v1";
const ACTIVE_PROFILE_KEY = "novus-active-profile-id";

export interface ProfileMeta {
  id: string;
  pilotName: string;
  shipId: string;
  sysIdx: number;
  level: number;
  credits: number;
  createdAt: string;
  updatedAt: string;
}

function profileDataKey(id: string): string {
  return `novus-profile-data-${id}`;
}

/** Read the profile index from localStorage. */
export function getProfiles(): ProfileMeta[] {
  try {
    const raw = localStorage.getItem(PROFILES_INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as ProfileMeta[];
  } catch {
    return [];
  }
}

/** Persist the profile index to localStorage. */
function saveProfileIndex(profiles: ProfileMeta[]): void {
  try {
    localStorage.setItem(PROFILES_INDEX_KEY, JSON.stringify(profiles));
  } catch (e) {
    console.warn("[profiles] failed to save index:", e);
  }
}

/** Generate a stable profile ID. */
function genProfileId(): string {
  return `p-${Date.now()}-${Math.floor(Math.random() * 1_000_000).toString(36)}`;
}

/** Create a new profile entry from an existing player object. */
export function createProfile(player: Player): string {
  const id = genProfileId();
  const now = new Date().toISOString();

  const meta: ProfileMeta = {
    id,
    pilotName: (player.pilotName || "").trim() || "Unnamed Pilot",
    shipId: player.shipId || "scout",
    sysIdx: player.sysIdx || 0,
    level: player.level ?? 1,
    credits: player.credits ?? 0,
    createdAt: now,
    updatedAt: now,
  };

  const profiles = getProfiles();
  profiles.push(meta);
  saveProfileIndex(profiles);

  try {
    localStorage.setItem(profileDataKey(id), JSON.stringify(player));
  } catch (e) {
    console.warn("[profiles] failed to save profile data:", e);
  }

  localStorage.setItem(ACTIVE_PROFILE_KEY, id);
  return id;
}

/** Load a profile's raw player JSON and stage it into the legacy SAVE_KEY,
 *  then run the normal loadPlayer() migration pipeline. */
export function activateProfile(id: string): boolean {
  try {
    const raw = localStorage.getItem(profileDataKey(id));
    if (!raw) return false;

    localStorage.setItem(SAVE_KEY, raw);
    const player = loadPlayer();
    getState().player = player;
    localStorage.setItem(ACTIVE_PROFILE_KEY, id);
    return true;
  } catch (e) {
    console.warn("[profiles] failed to activate profile:", e);
    return false;
  }
}

/** Sync the current SAVE_KEY back into the active profile's dedicated slot
 *  and update its metadata. Call this before returning to the title screen
 *  or before page reload to ensure the profile is up to date. */
export function syncActiveProfile(): boolean {
  const id = getActiveProfileId();
  if (!id) return false;

  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;

    localStorage.setItem(profileDataKey(id), raw);

    const player = getState().player;
    const profiles = getProfiles();
    const idx = profiles.findIndex((p) => p.id === id);
    if (idx !== -1) {
      profiles[idx] = {
        ...profiles[idx],
        pilotName: (player.pilotName || "").trim() || "Unnamed Pilot",
        shipId: player.shipId || "scout",
        sysIdx: player.sysIdx || 0,
        level: player.level ?? 1,
        credits: player.credits ?? 0,
        updatedAt: new Date().toISOString(),
      };
      saveProfileIndex(profiles);
    }
    return true;
  } catch (e) {
    console.warn("[profiles] failed to sync active profile:", e);
    return false;
  }
}

/** Remove a profile permanently. */
export function deleteProfile(id: string): void {
  const profiles = getProfiles().filter((p) => p.id !== id);
  saveProfileIndex(profiles);
  try {
    localStorage.removeItem(profileDataKey(id));
  } catch {
    /* ignore */
  }

  const active = getActiveProfileId();
  if (active === id) {
    localStorage.removeItem(ACTIVE_PROFILE_KEY);
  }
}

/** Get the currently active profile ID, or null if none is selected. */
export function getActiveProfileId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_PROFILE_KEY);
  } catch {
    return null;
  }
}

/** Set (or clear) the active profile ID. */
export function setActiveProfileId(id: string | null): void {
  try {
    if (id) localStorage.setItem(ACTIVE_PROFILE_KEY, id);
    else localStorage.removeItem(ACTIVE_PROFILE_KEY);
  } catch {
    /* ignore */
  }
}

/** Convert a legacy single-save into the new multi-profile format.
 *  Safe to call repeatedly — it no-ops if profiles already exist. */
export function migrateLegacySave(): void {
  const existing = getProfiles();
  if (existing.length > 0) return;

  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const player = JSON.parse(raw) as Player;
    createProfile(player);
  } catch (e) {
    console.warn("[profiles] legacy migration failed:", e);
  }
}

/** Return display-friendly "time ago" text from an ISO date string. */
export function timeAgo(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diff = Math.max(0, now - then);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return t("timeAgo.days", { n: days });
    if (hours > 0) return t("timeAgo.hours", { n: hours });
    if (minutes > 0) return t("timeAgo.minutes", { n: minutes });
    return t("timeAgo.justNow");
  } catch {
    return t("timeAgo.unknown");
  }
}
