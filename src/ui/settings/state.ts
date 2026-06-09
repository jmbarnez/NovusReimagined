import { Client } from "../../state.js";
import { loadSettings } from "../../data/settings.js";
import { setSfxVolume } from "../../audio/procedural.js";
import { setMusicVolume } from "../../audio/music.js";
import { refreshTheme } from "../hud-overlay.js";
import { ensureSettingsUI } from "./shell.js";
import { renderSettings } from "./render.js";
import { resetWindowExpand } from "../hud/window-chrome.js";
import { getElement, setStyle } from "../dom-helpers.js";

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
  const overlay = getElement("settings-overlay");
  if (overlay) setStyle(overlay, { display: "flex" });
  renderSettings();
}

export function closeSettings() {
  Client.settingsOpen = false;
  setListeningFor(null);
  const panel = getElement("settings-panel");
  if (panel) resetWindowExpand(panel, { embedded: true });
  const el = getElement("settings-overlay");
  if (el) setStyle(el, { display: "none" });
  const bubble = getElement("settings-tooltip-bubble");
  if (bubble) setStyle(bubble, { display: "none" });
}

export function toggleSettings() {
  if (Client.settingsOpen) closeSettings();
  else openSettings();
}
