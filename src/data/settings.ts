const SETTINGS_KEY = "novus-settings-v1";

export interface Keybinds {
  inventory: string;
  overview: string;
  map: string;
  dock: string;
  brake: string;
  settings: string;
  skills: string;
  up: string;
  down: string;
  left: string;
  right: string;
  perf: string;
}

export interface HudTheme {
  name: string;
  topBar: string;
  topBarBorder: string;
  bottomBarTop: string;
  bottomBarBottom: string;
  bottomBarBorder: string;
  textMain: string;
  textDim: string;
}

export interface Settings {
  theme: string;
  keybinds: Keybinds;
  sfxVolume: number;
  musicVolume: number;
  renderScale: number;
  backgroundDetail: string;
  nebulaDensity: string;
  bloomEnabled: boolean;
  colorGrading: boolean;
  vignetteEnabled: boolean;
  cameraSmoothing: number;
  directionalLighting: boolean;
  atmosphericRim: boolean;
  ambientFalloff: boolean;
  lensFlare: boolean;
  fpsCounter: boolean;
  mipmapping: boolean;
}

export const DEFAULT_KEYBINDS: Keybinds = {
  inventory: "Tab",
  overview: "KeyP",
  map: "KeyM",
  dock: "KeyF",
  brake: "Space",
  settings: "Escape",
  skills: "KeyK",
  up: "KeyW",
  down: "KeyS",
  left: "KeyA",
  right: "KeyD",
  perf: "Backquote",
};

export const KEYBIND_LABELS: Record<string, string> = {
  inventory: "Inventory / Cargo",
  overview: "Local Scanner / Overview",
  map: "Galaxy Map",
  dock: "Dock / Undock",
  brake: "Brake",
  settings: "Settings",
  skills: "Skills Window",
  up: "Thrust Forward",
  down: "Thrust Backward",
  left: "Thrust Left",
  right: "Thrust Right",
  perf: "Performance Overlay",
};

export const HUD_THEMES: Record<string, HudTheme> = {
  default: {
    name: "Midnight",
    topBar: "rgba(2,5,10,0.88)",
    topBarBorder: "rgba(55,85,110,0.65)",
    bottomBarTop: "rgba(4,6,11,0.98)",
    bottomBarBottom: "rgba(2,3,6,0.99)",
    bottomBarBorder: "rgba(140,118,70,0.72)",
    textMain: "#9eb6d4",
    textDim: "#7a8fa8",
  },
  amber: {
    name: "Amber",
    topBar: "rgba(10,6,0,0.88)",
    topBarBorder: "rgba(110,85,55,0.65)",
    bottomBarTop: "rgba(11,8,4,0.98)",
    bottomBarBottom: "rgba(6,4,2,0.99)",
    bottomBarBorder: "rgba(180,140,70,0.72)",
    textMain: "#d4b69e",
    textDim: "#a89078",
  },
  matrix: {
    name: "Matrix",
    topBar: "rgba(0,10,2,0.88)",
    topBarBorder: "rgba(55,110,85,0.65)",
    bottomBarTop: "rgba(4,11,6,0.98)",
    bottomBarBottom: "rgba(2,6,3,0.99)",
    bottomBarBorder: "rgba(70,180,100,0.72)",
    textMain: "#9ed4b6",
    textDim: "#78a890",
  },
  crimson: {
    name: "Crimson",
    topBar: "rgba(10,0,0,0.88)",
    topBarBorder: "rgba(110,55,55,0.65)",
    bottomBarTop: "rgba(11,4,4,0.98)",
    bottomBarBottom: "rgba(6,2,2,0.99)",
    bottomBarBorder: "rgba(180,70,70,0.72)",
    textMain: "#d49e9e",
    textDim: "#a87878",
  },
};

export const DEFAULT_SETTINGS: Settings = {
  theme: "default",
  keybinds: { ...DEFAULT_KEYBINDS },
  sfxVolume: 1.0,
  musicVolume: 1.0,
  renderScale: 2.5,
  backgroundDetail: "high",
  nebulaDensity: "high",
  bloomEnabled: true,
  colorGrading: true,
  vignetteEnabled: true,
  cameraSmoothing: 0.08,
  directionalLighting: true,
  atmosphericRim: true,
  ambientFalloff: true,
  lensFlare: true,
  fpsCounter: false,
  mipmapping: true,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        theme: parsed.theme || "default",
        keybinds: { ...DEFAULT_KEYBINDS, ...(parsed.keybinds || {}) },
        sfxVolume: parsed.sfxVolume ?? 1.0,
        musicVolume: parsed.musicVolume ?? 1.0,
        renderScale: parsed.renderScale ?? 2.5,
        backgroundDetail: parsed.backgroundDetail || "high",
        nebulaDensity: parsed.nebulaDensity || "high",
        bloomEnabled: parsed.bloomEnabled ?? true,
        colorGrading: parsed.colorGrading ?? true,
        vignetteEnabled: parsed.vignetteEnabled ?? true,
        cameraSmoothing: parsed.cameraSmoothing ?? 0.08,
        directionalLighting: parsed.directionalLighting ?? true,
        atmosphericRim: parsed.atmosphericRim ?? true,
        ambientFalloff: parsed.ambientFalloff ?? true,
        lensFlare: parsed.lensFlare ?? true,
        fpsCounter: parsed.fpsCounter ?? false,
        mipmapping: parsed.mipmapping ?? true,
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

export function getThemeColors(themeId: string): HudTheme {
  return HUD_THEMES[themeId] || HUD_THEMES.default;
}
