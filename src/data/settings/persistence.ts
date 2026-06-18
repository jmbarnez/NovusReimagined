import type { Settings, VideoPreset } from "./types.js";
import { DEFAULT_KEYBINDS, loadKeybinds } from "./keybinds.js";

const SETTINGS_KEY = "novus-settings-v1";

export const DEFAULT_SETTINGS: Settings = {
  theme: "default",
  reticleStyle: "classic",
  fontFamily: "Orbitron",
  fontScale: 1.0,
  keybinds: { ...DEFAULT_KEYBINDS },
  sfxVolume: 1.0,
  musicVolume: 1.0,
  renderScale: 2.2,
  fpsLimit: 0,
  backgroundDetail: "high",
  videoPreset: "balanced",
  nebulaDensity: 1.0,
  colorGrading: true,
  vignetteEnabled: true,
  directionalLighting: true,
  atmosphericRim: true,
  mipmapping: true,
  lensFlare: true,
  bloomIntensity: 1.0,
  uiScale: 1.0,
  language: "en",
  antialias: false,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        theme: parsed.theme || "default",
        reticleStyle: parsed.reticleStyle || "classic",
        fontFamily: parsed.fontFamily || "Orbitron",
        fontScale: parsed.fontScale ?? 1.0,
        keybinds: loadKeybinds(parsed.keybinds),
        sfxVolume: parsed.sfxVolume ?? 1.0,
        musicVolume: parsed.musicVolume ?? 1.0,
        renderScale: parsed.renderScale ?? 2.2,
        fpsLimit: Number.isFinite(parsed.fpsLimit) ? parsed.fpsLimit : 0,
        backgroundDetail: parsed.backgroundDetail || "high",
        videoPreset: (parsed.videoPreset as VideoPreset) ?? "balanced",
        nebulaDensity: parsed.nebulaDensity ?? 1.0,
        colorGrading: parsed.colorGrading ?? true,
        vignetteEnabled: parsed.vignetteEnabled ?? true,
        directionalLighting: parsed.directionalLighting ?? true,
        atmosphericRim: parsed.atmosphericRim ?? true,
        mipmapping: parsed.mipmapping ?? true,
        lensFlare:   parsed.lensFlare   ?? true,
        bloomIntensity: parsed.bloomIntensity ?? 1.0,
        uiScale: parsed.uiScale ?? 1.0,
        language: (parsed.language === "es" ? "es" : "en") as "en" | "es",
        antialias: parsed.antialias ?? false,
      };
    }
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}
