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

/**
 * Comprehensive UI theme. Every color the DOM HUD/windows need is a token here.
 * Themes only specify the "bright" colors — gradient dark-ends and translucent
 * variants are derived in CSS via color-mix(), keeping this table authorable.
 */
export interface UITheme {
  name: string;
  // surfaces
  bgDeep: string;      // deepest backdrop (top bar, prompts)
  bgWindow: string;    // floating window body
  bgPanel: string;     // solid side/bottom panels
  bgElevated: string;  // header rows, raised chrome
  // borders
  border: string;       // general structural border
  borderSoft: string;   // subtle dividers
  borderAccent: string; // gold/brand accent border
  // text
  textBright: string;
  textMain: string;
  textDim: string;
  textFaint: string;
  // semantic accents
  accent: string;    // brand highlight (was hardcoded #ffcc44)
  positive: string;  // ok / success
  shield: string;    // shield bar / info
  hull: string;      // hull bar / warning-warm
  danger: string;    // hostile / structure damage
  cap: string;       // capacitor / energy
}

/** Back-compat alias — older call sites import `HudTheme`. */
export type HudTheme = UITheme;

export interface FontOption {
  id: string;     // primary family name, stored in Settings.fontFamily
  label: string;
  stack: string;  // full CSS font-family stack
}

/** Fonts the player can pick. Loaded via index.html. */
export const FONT_OPTIONS: FontOption[] = [
  { id: "Orbitron",       label: "Orbitron",     stack: "'Orbitron', sans-serif" },
  { id: "Rajdhani",       label: "Rajdhani",     stack: "'Rajdhani', sans-serif" },
  { id: "Exo 2",          label: "Exo 2",        stack: "'Exo 2', sans-serif" },
  { id: "Share Tech Mono",label: "Tech Mono",    stack: "'Share Tech Mono', monospace" },
  { id: "system-ui",      label: "System",       stack: "system-ui, sans-serif" },
];

export function getFontStack(id: string): string {
  return (FONT_OPTIONS.find((f) => f.id === id) || FONT_OPTIONS[0]).stack;
}

export interface Settings {
  theme: string;
  reticleStyle: string;
  fontFamily: string;
  keybinds: Keybinds;
  sfxVolume: number;
  musicVolume: number;
  renderScale: number;
  backgroundDetail: string;
  colorGrading: boolean;
  vignetteEnabled: boolean;
  cameraSmoothing: number;
  directionalLighting: boolean;
  atmosphericRim: boolean;
  fpsCounter: boolean;
  mipmapping: boolean;
  lensFlare: boolean;
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

export const HUD_THEMES: Record<string, UITheme> = {
  default: {
    name: "Midnight",
    bgDeep: "rgba(2,5,10,0.88)", bgWindow: "rgba(10,14,20,0.82)",
    bgPanel: "rgba(10,15,25,0.95)", bgElevated: "rgba(30,42,58,0.75)",
    border: "rgba(55,85,110,0.65)", borderSoft: "rgba(40,55,70,0.5)", borderAccent: "rgba(140,118,70,0.72)",
    textBright: "#cfe0f5", textMain: "#9eb6d4", textDim: "#7a8fa8", textFaint: "#5a7080",
    accent: "#ffcc44", positive: "#66ff88", shield: "#44ccff", hull: "#ee9944", danger: "#ee4444", cap: "#ffdd66",
  },
  amber: {
    name: "Amber",
    bgDeep: "rgba(10,6,0,0.88)", bgWindow: "rgba(20,14,6,0.82)",
    bgPanel: "rgba(25,18,8,0.95)", bgElevated: "rgba(58,44,24,0.75)",
    border: "rgba(110,85,55,0.65)", borderSoft: "rgba(70,55,35,0.5)", borderAccent: "rgba(180,140,70,0.72)",
    textBright: "#f5e0c0", textMain: "#d4b69e", textDim: "#a89078", textFaint: "#806850",
    accent: "#ffbb44", positive: "#bbdd66", shield: "#ffcc66", hull: "#ee9944", danger: "#ff6644", cap: "#ffdd88",
  },
  matrix: {
    name: "Matrix",
    bgDeep: "rgba(0,10,2,0.88)", bgWindow: "rgba(6,18,10,0.82)",
    bgPanel: "rgba(8,22,12,0.95)", bgElevated: "rgba(24,58,36,0.75)",
    border: "rgba(55,110,85,0.65)", borderSoft: "rgba(35,70,50,0.5)", borderAccent: "rgba(70,180,100,0.72)",
    textBright: "#c0f5d0", textMain: "#9ed4b6", textDim: "#78a890", textFaint: "#507060",
    accent: "#66ff99", positive: "#66ff88", shield: "#44ffcc", hull: "#ccff44", danger: "#ff5555", cap: "#aaff66",
  },
  crimson: {
    name: "Crimson",
    bgDeep: "rgba(10,0,0,0.88)", bgWindow: "rgba(20,8,8,0.82)",
    bgPanel: "rgba(24,8,8,0.95)", bgElevated: "rgba(58,28,28,0.75)",
    border: "rgba(110,55,55,0.65)", borderSoft: "rgba(70,35,35,0.5)", borderAccent: "rgba(180,70,70,0.72)",
    textBright: "#f5cccc", textMain: "#d49e9e", textDim: "#a87878", textFaint: "#805050",
    accent: "#ff8866", positive: "#dd8866", shield: "#ff6688", hull: "#ee7744", danger: "#ff4444", cap: "#ffaa66",
  },
  ice: {
    name: "Ice",
    bgDeep: "rgba(2,8,12,0.88)", bgWindow: "rgba(8,18,24,0.82)",
    bgPanel: "rgba(10,22,28,0.95)", bgElevated: "rgba(28,52,64,0.75)",
    border: "rgba(70,120,140,0.65)", borderSoft: "rgba(45,75,90,0.5)", borderAccent: "rgba(90,170,200,0.72)",
    textBright: "#e0f6ff", textMain: "#aad8ec", textDim: "#80acc0", textFaint: "#587888",
    accent: "#66e0ff", positive: "#66ffcc", shield: "#66ddff", hull: "#ffbb66", danger: "#ff6688", cap: "#aaeeff",
  },
  viridian: {
    name: "Viridian",
    bgDeep: "rgba(2,10,8,0.88)", bgWindow: "rgba(8,20,16,0.82)",
    bgPanel: "rgba(8,24,20,0.95)", bgElevated: "rgba(24,56,46,0.75)",
    border: "rgba(55,110,95,0.65)", borderSoft: "rgba(35,70,60,0.5)", borderAccent: "rgba(80,170,140,0.72)",
    textBright: "#c8f5e4", textMain: "#9ed4c2", textDim: "#78a896", textFaint: "#507064",
    accent: "#44e0a8", positive: "#66ffaa", shield: "#44ddcc", hull: "#e0cc55", danger: "#ff6655", cap: "#88eebb",
  },
  synthwave: {
    name: "Synthwave",
    bgDeep: "rgba(8,2,16,0.88)", bgWindow: "rgba(16,8,28,0.82)",
    bgPanel: "rgba(18,8,32,0.95)", bgElevated: "rgba(48,24,68,0.75)",
    border: "rgba(110,70,140,0.65)", borderSoft: "rgba(70,45,90,0.5)", borderAccent: "rgba(200,90,180,0.72)",
    textBright: "#f0d6ff", textMain: "#d0aae8", textDim: "#a080c0", textFaint: "#705890",
    accent: "#ff66dd", positive: "#88ffdd", shield: "#66ccff", hull: "#ffaa66", danger: "#ff4488", cap: "#ffcc66",
  },
  mono: {
    name: "Mono",
    bgDeep: "rgba(6,7,8,0.88)", bgWindow: "rgba(16,17,18,0.82)",
    bgPanel: "rgba(20,21,22,0.95)", bgElevated: "rgba(48,50,52,0.75)",
    border: "rgba(90,95,100,0.65)", borderSoft: "rgba(60,63,66,0.5)", borderAccent: "rgba(150,155,160,0.72)",
    textBright: "#f0f2f4", textMain: "#c0c4c8", textDim: "#909498", textFaint: "#606468",
    accent: "#e0e4e8", positive: "#b0d0b8", shield: "#b0c4d0", hull: "#d0c0a0", danger: "#e08080", cap: "#d8d8c0",
  },
};

export const DEFAULT_SETTINGS: Settings = {
  theme: "default",
  reticleStyle: "classic",
  fontFamily: "Orbitron",
  keybinds: { ...DEFAULT_KEYBINDS },
  sfxVolume: 1.0,
  musicVolume: 1.0,
  renderScale: 2.5,
  backgroundDetail: "high",
  colorGrading: true,
  vignetteEnabled: true,
  cameraSmoothing: 0.08,
  directionalLighting: true,
  atmosphericRim: true,
  fpsCounter: false,
  mipmapping: true,
  lensFlare: true,
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
        keybinds: { ...DEFAULT_KEYBINDS, ...(parsed.keybinds || {}) },
        sfxVolume: parsed.sfxVolume ?? 1.0,
        musicVolume: parsed.musicVolume ?? 1.0,
        renderScale: parsed.renderScale ?? 2.5,
        backgroundDetail: parsed.backgroundDetail || "high",
        colorGrading: parsed.colorGrading ?? true,
        vignetteEnabled: parsed.vignetteEnabled ?? true,
        cameraSmoothing: parsed.cameraSmoothing ?? 0.08,
        directionalLighting: parsed.directionalLighting ?? true,
        atmosphericRim: parsed.atmosphericRim ?? true,
        fpsCounter: parsed.fpsCounter ?? false,
        mipmapping: parsed.mipmapping ?? true,
        lensFlare:   parsed.lensFlare   ?? true,
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

export function getTheme(themeId: string): UITheme {
  return HUD_THEMES[themeId] || HUD_THEMES.default;
}

/** Back-compat alias for older call sites (crosshair, hud.ts). */
export const getThemeColors = getTheme;
