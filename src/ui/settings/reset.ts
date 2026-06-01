import { Client } from "../../state.js";
import { DEFAULT_SETTINGS, saveSettings } from "../../data/settings.js";
import { setSfxVolume } from "../../audio/procedural.js";
import { setMusicVolume } from "../../audio/music.js";
import { initBackgroundStars } from "../../render/background.js";
import { setNebulaSystem } from "../../render/pixi-nebula-gpu.js";
import { resizePixi } from "../../pixi.js";
import { refreshBackground } from "../../render/pixi-background.js";
import { refreshTheme } from "../hud-overlay.js";
import { refreshWorldLabelTextStyle } from "../../render/world-label-card.js";
import { refreshEntityFonts } from "../../render/pixi-entities.js";
import { refreshCelestialFonts } from "../../render/pixi-celestial.js";
import { getState } from "../../state-access.js";
import { setListeningFor } from "./state.js";
import { renderSettings } from "./render.js";

export function resetSettings() {
  const defs = DEFAULT_SETTINGS;
  Client.settings = { ...defs, keybinds: { ...defs.keybinds } };
  setSfxVolume(Client.settings.sfxVolume);
  setMusicVolume(Client.settings.musicVolume);
  initBackgroundStars(Client.settings.backgroundDetail);
  const state = getState();
  const curSys = state.GALAXY?.[state.player?.sysIdx ?? 0];
  setNebulaSystem(curSys);
  resizePixi();
  refreshBackground();
  refreshTheme();
  refreshWorldLabelTextStyle();
  refreshEntityFonts();
  refreshCelestialFonts();
  saveSettings(Client.settings);
  setListeningFor(null);
  renderSettings();
}
