/**
 * Profile Manager
 *
 * Manages multiple pilot profiles stored in localStorage.
 * Each profile is a self-contained player save. The active profile
 * is staged in the legacy SAVE_KEY during gameplay for backward
 * compatibility with the existing save/load pipeline.
 */

import { SAVE_KEY } from "../constants.js";
import { getState, WorldAccess } from "../state-access.js";
import type { Player } from "../state.js";
import { loadPlayer, savePlayer } from "../player/player-data.js";
import { t } from "../utils/i18n.js";

const PROFILES_INDEX_KEY = "novus-profiles-v1";
const ACTIVE_PROFILE_KEY = "novus-active-profile-id";
const PROFILE_MIGRATION_KEY = "novus-profiles-migrated";

export interface ProfileMeta {
  id: string;
  pilotName: string;
  shipId: string;
  sysIdx: number;
  level: number;
  credits: number;
  createdAt: string;
  updatedAt: string;
  playTimeMs: number;
}

type StoredProfileMeta = Omit<ProfileMeta, "playTimeMs"> & { playTimeMs?: number };

let sessionProfileId: string | null = null;
let sessionLastTimestamp: number | null = null;

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
    return (parsed as StoredProfileMeta[]).map((p) =>
      Number.isFinite(p.playTimeMs) ? (p as ProfileMeta) : { ...p, playTimeMs: 0 }
    );
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
    playTimeMs: 0,
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
  startActiveProfileSessionTimer();
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
    WorldAccess.initPlayer(player);
    localStorage.setItem(ACTIVE_PROFILE_KEY, id);
    sessionProfileId = id;
    sessionLastTimestamp = Date.now();
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
      const sessionDelta = captureSessionDelta(id);
      profiles[idx] = {
        ...profiles[idx],
        pilotName: (player.pilotName || "").trim() || "Unnamed Pilot",
        shipId: player.shipId || "scout",
        sysIdx: player.sysIdx || 0,
        level: player.level ?? 1,
        credits: player.credits ?? 0,
        updatedAt: new Date().toISOString(),
        playTimeMs: profiles[idx].playTimeMs + sessionDelta,
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

/** Remove all profiles permanently. */
export function deleteAllProfiles(): void {
  const profiles = getProfiles();
  for (const p of profiles) {
    try {
      localStorage.removeItem(profileDataKey(p.id));
    } catch {
      /* ignore */
    }
  }
  try {
    localStorage.removeItem(PROFILES_INDEX_KEY);
    localStorage.removeItem(ACTIVE_PROFILE_KEY);
  } catch {
    /* ignore */
  }
  sessionProfileId = null;
  sessionLastTimestamp = null;
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
 *  No-ops once migration has been performed or profiles already exist. */
export function migrateLegacySave(): void {
  try {
    if (localStorage.getItem(PROFILE_MIGRATION_KEY)) return;
  } catch {
    return;
  }

  const existing = getProfiles();
  if (existing.length > 0) {
    try { localStorage.setItem(PROFILE_MIGRATION_KEY, "1"); } catch { /* ignore */ }
    return;
  }

  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      localStorage.setItem(PROFILE_MIGRATION_KEY, "1");
      return;
    }
    const player = JSON.parse(raw) as Player;
    createProfile(player);
    localStorage.setItem(PROFILE_MIGRATION_KEY, "1");
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

/** Calculate elapsed milliseconds for the current session and reset the timer. */
function captureSessionDelta(id: string): number {
  if (!sessionProfileId || sessionProfileId !== id || sessionLastTimestamp == null) return 0;
  const now = Date.now();
  const delta = Math.max(0, now - sessionLastTimestamp);
  sessionLastTimestamp = now;
  return delta;
}

/** Start (or resume) the active-profile session timer. Call after activation. */
export function startActiveProfileSessionTimer(): void {
  const id = getActiveProfileId();
  if (!id) {
    sessionProfileId = null;
    sessionLastTimestamp = null;
    return;
  }
  sessionProfileId = id;
  sessionLastTimestamp = Date.now();
}

/** Stop the session timer without syncing. Call when leaving gameplay. */
export function stopActiveProfileSessionTimer(): void {
  sessionProfileId = null;
  sessionLastTimestamp = null;
}

/** Format milliseconds into a compact play-time string (e.g., "2h 15m"). */
export function formatPlayTime(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
