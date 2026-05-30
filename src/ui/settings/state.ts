import { Client } from "../../state.js";
import { loadSettings } from "../../data/settings.js";
import { setSfxVolume } from "../../audio/procedural.js";
import { setMusicVolume } from "../../audio/music.js";
import { refreshTheme } from "../hud-overlay.js";
import { ensureSettingsUI } from "./shell.js";
import { renderSettings } from "./render.js";
import { resetWindowExpand } from "../hud/window-chrome.js";

export let listeningFor: string | null = null;

export function setListeningFor(val: string | null) {
  listeningFor = val;
}

export function initSettings() {
  Client.settings = loadSettings();
  Client.settingsOpen = false;
  setSfxVolume(Client.settings.sfxVolume);
  setMusicVolume(Client.settings.musicVolume);
  refreshTheme();
}

export function openSettings() {
  if (Client.stationOpen) return;
  ensureSettingsUI();
  Client.settingsOpen = true;
  (document.getElementById("settings-overlay") as HTMLElement).style.display = "flex";
  renderSettings();
}

export function closeSettings() {
  Client.settingsOpen = false;
  setListeningFor(null);
  const panel = document.getElementById("settings-panel");
  if (panel) resetWindowExpand(panel, { embedded: true });
  const el = document.getElementById("settings-overlay");
  if (el) el.style.display = "none";
  const bubble = document.getElementById("settings-tooltip-bubble");
  if (bubble) bubble.style.display = "none";
}

export function toggleSettings() {
  if (Client.settingsOpen) closeSettings();
  else openSettings();
}
