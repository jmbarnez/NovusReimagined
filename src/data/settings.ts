const SETTINGS_KEY = "novus-settings-v1";

export interface Keybinds {
  inventory: string;
  overview: string;
  map: string;
  dock: string;
  warp: string;
  brake: string;
  engineBoost: string;
  forwardThrust: string;
  reverseThrust: string;
  turnLeft: string;
  turnRight: string;
  settings: string;
  skills: string;
  eventLog: string;
  perf: string;
}

export type KeybindAction = keyof Keybinds;

export interface ControlSectionAction {
  action: KeybindAction;
  labelKey: string;
  descriptionKey?: string;
}

export interface ControlSection {
  id: string;
  titleKey: string;
  descriptionKey?: string;
  actions: ControlSectionAction[];
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
  arcane?: string;   // skills / industry-purple accent
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

export type VideoPreset = "performance" | "balanced" | "cinematic" | "custom";
export type MovementControlMode = "waypoint" | "direct";

export interface Settings {
  theme: string;
  reticleStyle: string;
  fontFamily: string;
  fontScale: number;
  keybinds: Keybinds;
  sfxVolume: number;
  musicVolume: number;
  renderScale: number;
  fpsLimit: number;
  backgroundDetail: string;
  videoPreset: VideoPreset;
  movementControlMode: MovementControlMode;
  nebulaDensity: number;
  colorGrading: boolean;
  vignetteEnabled: boolean;
  directionalLighting: boolean;
  atmosphericRim: boolean;
  mipmapping: boolean;
  lensFlare: boolean;
  bloomIntensity: number;
  uiScale: number;
  language: "en" | "es";
  antialias: boolean;
}

export const DEFAULT_KEYBINDS: Keybinds = {
  inventory: "Tab",
  overview: "KeyP",
  map: "KeyM",
  dock: "KeyF",
  warp: "KeyG",
  brake: "Space",
  engineBoost: "ShiftLeft",
  forwardThrust: "KeyW",
  reverseThrust: "KeyS",
  turnLeft: "KeyA",
  turnRight: "KeyD",
  settings: "Escape",
  skills: "KeyK",
  eventLog: "KeyC",
  perf: "Backquote",
};

export const CONTROL_SECTIONS: ControlSection[] = [
  {
    id: "navigation",
    titleKey: "settings.controls.section.navigation",
    actions: [
      { action: "brake", labelKey: "settings.controls.brake" },
      { action: "engineBoost", labelKey: "settings.controls.engineBoost" },
      { action: "forwardThrust", labelKey: "settings.controls.forwardThrust" },
      { action: "reverseThrust", labelKey: "settings.controls.reverseThrust" },
      { action: "turnLeft", labelKey: "settings.controls.turnLeft" },
      { action: "turnRight", labelKey: "settings.controls.turnRight" },
      { action: "dock", labelKey: "settings.controls.dock" },
      { action: "warp", labelKey: "settings.controls.warp" },
      { action: "map", labelKey: "settings.controls.map" },
    ],
  },
  {
    id: "awareness",
    titleKey: "settings.controls.section.awareness",
    actions: [
      { action: "overview", labelKey: "settings.controls.overview" },
      { action: "eventLog", labelKey: "settings.controls.eventLog" },
      { action: "perf", labelKey: "settings.controls.perf" },
    ],
  },
  {
    id: "systems",
    titleKey: "settings.controls.section.systems",
    actions: [
      { action: "inventory", labelKey: "settings.controls.inventory" },
      { action: "skills", labelKey: "settings.controls.skills" },
      { action: "settings", labelKey: "settings.controls.settings" },
    ],
  },
];

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
    arcane: "#a855f7",
  },
  mono: {
    name: "Mono",
    bgDeep: "rgba(6,7,8,0.88)", bgWindow: "rgba(16,17,18,0.82)",
    bgPanel: "rgba(20,21,22,0.95)", bgElevated: "rgba(48,50,52,0.75)",
    border: "rgba(90,95,100,0.65)", borderSoft: "rgba(60,63,66,0.5)", borderAccent: "rgba(150,155,160,0.72)",
    textBright: "#f0f2f4", textMain: "#c0c4c8", textDim: "#909498", textFaint: "#606468",
    accent: "#e0e4e8", positive: "#b0d0b8", shield: "#b0c4d0", hull: "#d0c0a0", danger: "#e08080", cap: "#d8d8c0",
  },
  nebula: {
    name: "Nebula Sunset",
    bgDeep: "rgba(8,3,15,0.88)", bgWindow: "rgba(18,8,30,0.82)",
    bgPanel: "rgba(22,10,36,0.95)", bgElevated: "rgba(50,25,80,0.75)",
    border: "rgba(120,60,160,0.65)", borderSoft: "rgba(80,40,110,0.5)", borderAccent: "rgba(220,130,50,0.72)",
    textBright: "#f6e2ff", textMain: "#d3aee5", textDim: "#a887bb", textFaint: "#7e5f90",
    accent: "#ff9e3b", positive: "#5cd699", shield: "#d946ef", hull: "#f97316", danger: "#ef4444", cap: "#fcd34d",
  },
  solar: {
    name: "Solar Flare",
    bgDeep: "rgba(15,5,0,0.88)", bgWindow: "rgba(28,12,2,0.82)",
    bgPanel: "rgba(34,16,2,0.95)", bgElevated: "rgba(74,38,10,0.75)",
    border: "rgba(160,100,40,0.65)", borderSoft: "rgba(110,65,25,0.5)", borderAccent: "rgba(240,180,50,0.72)",
    textBright: "#ffeedd", textMain: "#e5c0a0", textDim: "#bb9a7a", textFaint: "#90755a",
    accent: "#f59e0b", positive: "#a3e635", shield: "#facc15", hull: "#ea580c", danger: "#dc2626", cap: "#fde047",
  },
  cyberpunk: {
    name: "Neon Edge",
    bgDeep: "rgba(4,2,8,0.90)", bgWindow: "rgba(10,6,20,0.85)",
    bgPanel: "rgba(14,8,26,0.95)", bgElevated: "rgba(32,15,58,0.75)",
    border: "rgba(15,185,220,0.65)", borderSoft: "rgba(10,120,150,0.5)", borderAccent: "rgba(244,63,94,0.8)",
    textBright: "#e0f7fc", textMain: "#06b6d4", textDim: "#0891b2", textFaint: "#155e75",
    accent: "#ec4899", positive: "#10b981", shield: "#06b6d4", hull: "#d946ef", danger: "#f43f5e", cap: "#facc15",
    arcane: "#8b5cf6",
  },
  deepspace: {
    name: "Deep Space",
    bgDeep: "rgba(1,3,10,0.92)", bgWindow: "rgba(3,8,20,0.86)",
    bgPanel: "rgba(4,10,26,0.96)", bgElevated: "rgba(14,30,64,0.75)",
    border: "rgba(30,100,180,0.65)", borderSoft: "rgba(20,70,130,0.5)", borderAccent: "rgba(56,189,248,0.8)",
    textBright: "#e0f2fe", textMain: "#38bdf8", textDim: "#0284c7", textFaint: "#0369a1",
    accent: "#60a5fa", positive: "#34d399", shield: "#38bdf8", hull: "#fbbf24", danger: "#f87171", cap: "#38bdf8",
  },
  orion: {
    name: "Orion's Belt",
    bgDeep: "rgba(1,10,8,0.88)", bgWindow: "rgba(5,20,18,0.82)",
    bgPanel: "rgba(8,26,24,0.95)", bgElevated: "rgba(20,58,50,0.75)",
    border: "rgba(50,130,110,0.65)", borderSoft: "rgba(35,90,80,0.5)", borderAccent: "rgba(212,175,55,0.72)",
    textBright: "#e6faf4", textMain: "#a7f3d0", textDim: "#6ee7b7", textFaint: "#34d399",
    accent: "#fbbf24", positive: "#10b981", shield: "#2dd4bf", hull: "#f59e0b", danger: "#f43f5e", cap: "#34d399",
  },
  supernova: {
    name: "Supernova",
    bgDeep: "rgba(12,2,8,0.88)", bgWindow: "rgba(24,6,18,0.82)",
    bgPanel: "rgba(30,8,22,0.95)", bgElevated: "rgba(68,16,48,0.75)",
    border: "rgba(150,50,110,0.65)", borderSoft: "rgba(100,35,80,0.5)", borderAccent: "rgba(250,100,50,0.72)",
    textBright: "#ffe6f0", textMain: "#f472b6", textDim: "#ec4899", textFaint: "#db2777",
    accent: "#f97316", positive: "#a3e635", shield: "#ec4899", hull: "#f97316", danger: "#ef4444", cap: "#fbcfe8",
  },
  abyss: {
    name: "Marianas Abyss",
    bgDeep: "rgba(0,8,12,0.90)", bgWindow: "rgba(2,16,24,0.84)",
    bgPanel: "rgba(3,22,32,0.95)", bgElevated: "rgba(10,48,68,0.75)",
    border: "rgba(40,120,130,0.65)", borderSoft: "rgba(25,85,95,0.5)", borderAccent: "rgba(0,220,180,0.72)",
    textBright: "#e0fcf8", textMain: "#99f6e4", textDim: "#5eead4", textFaint: "#14b8a6",
    accent: "#06b6d4", positive: "#10b981", shield: "#2dd4bf", hull: "#eab308", danger: "#f43f5e", cap: "#a5f3fc",
  },
  aurora: {
    name: "Boreal Aurora",
    bgDeep: "rgba(2,6,12,0.88)", bgWindow: "rgba(6,14,24,0.82)",
    bgPanel: "rgba(8,18,30,0.95)", bgElevated: "rgba(20,44,68,0.75)",
    border: "rgba(50,110,130,0.65)", borderSoft: "rgba(35,75,90,0.5)", borderAccent: "rgba(50,220,120,0.72)",
    textBright: "#e2f9f6", textMain: "#a5f3fc", textDim: "#22d3ee", textFaint: "#0891b2",
    accent: "#4ade80", positive: "#22c55e", shield: "#06b6d4", hull: "#f59e0b", danger: "#ef4444", cap: "#cffafe",
  },
  void: {
    name: "Void Core",
    bgDeep: "rgba(3,3,3,0.93)", bgWindow: "rgba(12,12,12,0.85)",
    bgPanel: "rgba(16,16,16,0.96)", bgElevated: "rgba(36,36,36,0.75)",
    border: "rgba(80,80,80,0.65)", borderSoft: "rgba(55,55,55,0.5)", borderAccent: "rgba(220,220,220,0.8)",
    textBright: "#ffffff", textMain: "#d1d5db", textDim: "#9ca3af", textFaint: "#6b7280",
    accent: "#f3f4f6", positive: "#10b981", shield: "#9ca3af", hull: "#d1d5db", danger: "#f43f5e", cap: "#ffffff",
  },
  eclipse: {
    name: "Eclipse",
    bgDeep: "rgba(4,4,6,0.92)", bgWindow: "rgba(12,12,16,0.85)",
    bgPanel: "rgba(15,15,20,0.96)", bgElevated: "rgba(35,35,46,0.75)",
    border: "rgba(80,80,95,0.65)", borderSoft: "rgba(55,55,65,0.5)", borderAccent: "rgba(245,158,11,0.72)",
    textBright: "#faf5eb", textMain: "#d9ceb9", textDim: "#a89b82", textFaint: "#7c7059",
    accent: "#f59e0b", positive: "#84cc16", shield: "#60a5fa", hull: "#f97316", danger: "#ef4444", cap: "#fef08a",
  },
  quasar: {
    name: "Quasar",
    bgDeep: "rgba(6,2,14,0.90)", bgWindow: "rgba(14,6,28,0.84)",
    bgPanel: "rgba(18,8,34,0.95)", bgElevated: "rgba(44,18,74,0.75)",
    border: "rgba(120,50,180,0.65)", borderSoft: "rgba(80,35,120,0.5)", borderAccent: "rgba(6,182,212,0.75)",
    textBright: "#f5f0ff", textMain: "#c084fc", textDim: "#a855f7", textFaint: "#7e22ce",
    accent: "#06b6d4", positive: "#10b981", shield: "#8b5cf6", hull: "#f43f5e", danger: "#ef4444", cap: "#e9d5ff",
    arcane: "#a21caf",
  },
  titan: {
    name: "Titan Dunes",
    bgDeep: "rgba(12,8,2,0.88)", bgWindow: "rgba(24,18,6,0.82)",
    bgPanel: "rgba(30,22,8,0.95)", bgElevated: "rgba(64,48,20,0.75)",
    border: "rgba(140,100,50,0.65)", borderSoft: "rgba(90,65,35,0.5)", borderAccent: "rgba(56,189,248,0.72)",
    textBright: "#fff2e0", textMain: "#fbbf24", textDim: "#f59e0b", textFaint: "#b45309",
    accent: "#38bdf8", positive: "#a3e635", shield: "#0ea5e9", hull: "#ea580c", danger: "#dc2626", cap: "#fef3c7",
  },
  plasma: {
    name: "Plasma Stream",
    bgDeep: "rgba(10,2,12,0.88)", bgWindow: "rgba(22,6,24,0.82)",
    bgPanel: "rgba(28,8,30,0.95)", bgElevated: "rgba(64,20,68,0.75)",
    border: "rgba(140,50,140,0.65)", borderSoft: "rgba(90,35,90,0.5)", borderAccent: "rgba(100,200,255,0.72)",
    textBright: "#ffeafc", textMain: "#f472b6", textDim: "#d946ef", textFaint: "#a21caf",
    accent: "#38bdf8", positive: "#4ade80", shield: "#a21caf", hull: "#f472b6", danger: "#e11d48", cap: "#fae8ff",
  },
  quantum: {
    name: "Quantum Shift",
    bgDeep: "rgba(2,4,12,0.90)", bgWindow: "rgba(6,10,24,0.82)",
    bgPanel: "rgba(8,12,30,0.95)", bgElevated: "rgba(20,28,68,0.75)",
    border: "rgba(50,70,140,0.65)", borderSoft: "rgba(35,45,95,0.5)", borderAccent: "rgba(34,211,238,0.72)",
    textBright: "#e5edff", textMain: "#818cf8", textDim: "#6366f1", textFaint: "#4f46e5",
    accent: "#22d3ee", positive: "#10b981", shield: "#4f46e5", hull: "#818cf8", danger: "#f43f5e", cap: "#e0e7ff",
  },
  retro: {
    name: "Retro Future",
    bgDeep: "rgba(14,6,12,0.88)", bgWindow: "rgba(26,12,24,0.82)",
    bgPanel: "rgba(32,16,30,0.95)", bgElevated: "rgba(74,36,68,0.75)",
    border: "rgba(160,80,140,0.65)", borderSoft: "rgba(110,55,95,0.5)", borderAccent: "rgba(255,230,100,0.72)",
    textBright: "#ffebf5", textMain: "#f472b6", textDim: "#fda4af", textFaint: "#fb7185",
    accent: "#fde047", positive: "#a7f3d0", shield: "#38bdf8", hull: "#fb7185", danger: "#f43f5e", cap: "#fef9c3",
  },
  rust: {
    name: "Scrap Metal",
    bgDeep: "rgba(8,6,4,0.88)", bgWindow: "rgba(18,14,10,0.82)",
    bgPanel: "rgba(22,18,12,0.95)", bgElevated: "rgba(48,38,28,0.75)",
    border: "rgba(100,80,60,0.65)", borderSoft: "rgba(70,55,40,0.5)", borderAccent: "rgba(202,138,4,0.72)",
    textBright: "#faf0e6", textMain: "#d97706", textDim: "#b45309", textFaint: "#78350f",
    accent: "#ea580c", positive: "#84cc16", shield: "#ca8a04", hull: "#b45309", danger: "#dc2626", cap: "#fef3c7",
  },
  toxic: {
    name: "Hazardous",
    bgDeep: "rgba(3,6,2,0.90)", bgWindow: "rgba(8,16,6,0.82)",
    bgPanel: "rgba(10,20,8,0.95)", bgElevated: "rgba(28,48,20,0.75)",
    border: "rgba(60,110,50,0.65)", borderSoft: "rgba(40,75,35,0.5)", borderAccent: "rgba(234,179,8,0.72)",
    textBright: "#ebfaeb", textMain: "#a3e635", textDim: "#84cc16", textFaint: "#65a30d",
    accent: "#eab308", positive: "#22c55e", shield: "#84cc16", hull: "#d97706", danger: "#ef4444", cap: "#fef08a",
  },
  helios: {
    name: "Helios Prime",
    bgDeep: "rgba(14,4,2,0.88)", bgWindow: "rgba(26,10,6,0.82)",
    bgPanel: "rgba(32,12,8,0.95)", bgElevated: "rgba(74,28,20,0.75)",
    border: "rgba(160,70,50,0.65)", borderSoft: "rgba(110,50,35,0.5)", borderAccent: "rgba(249,115,22,0.72)",
    textBright: "#fff0eb", textMain: "#f97316", textDim: "#ea580c", textFaint: "#c2410c",
    accent: "#ea580c", positive: "#bef264", shield: "#facc15", hull: "#c2410c", danger: "#dc2626", cap: "#ffedd5",
  },
  starlight: {
    name: "Starlight",
    bgDeep: "rgba(6,4,12,0.88)", bgWindow: "rgba(14,10,24,0.82)",
    bgPanel: "rgba(18,12,30,0.95)", bgElevated: "rgba(44,32,68,0.75)",
    border: "rgba(100,80,140,0.65)", borderSoft: "rgba(70,55,95,0.5)", borderAccent: "rgba(255,255,255,0.8)",
    textBright: "#fcfaff", textMain: "#ddd6fe", textDim: "#c084fc", textFaint: "#a855f7",
    accent: "#ffffff", positive: "#a7f3d0", shield: "#c084fc", hull: "#ddd6fe", danger: "#fda4af", cap: "#f3e8ff",
    arcane: "#c084fc",
  },
  comet: {
    name: "Comet Tail",
    bgDeep: "rgba(4,6,10,0.88)", bgWindow: "rgba(10,14,20,0.82)",
    bgPanel: "rgba(12,18,25,0.95)", bgElevated: "rgba(32,48,64,0.75)",
    border: "rgba(80,110,130,0.65)", borderSoft: "rgba(55,75,90,0.5)", borderAccent: "rgba(186,230,253,0.72)",
    textBright: "#f0f9ff", textMain: "#bae6fd", textDim: "#7dd3fc", textFaint: "#38bdf8",
    accent: "#e0f2fe", positive: "#86efac", shield: "#0284c7", hull: "#7dd3fc", danger: "#f87171", cap: "#bae6fd",
  },
};

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
  movementControlMode: "waypoint",
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

function loadKeybinds(value: unknown): Keybinds {
  if (!value || typeof value !== "object") return { ...DEFAULT_KEYBINDS };
  const saved = value as Partial<Record<keyof Keybinds | "thrust", unknown>>;
  const migrated: Keybinds = { ...DEFAULT_KEYBINDS };
  for (const key of Object.keys(DEFAULT_KEYBINDS) as (keyof Keybinds)[]) {
    const savedValue = saved[key];
    if (typeof savedValue === "string") migrated[key] = savedValue;
  }
  if (typeof saved.thrust === "string" && saved.forwardThrust === undefined) {
    migrated.forwardThrust = saved.thrust;
  }
  return migrated;
}

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
        movementControlMode: parsed.movementControlMode === "direct" ? "direct" : "waypoint",
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

export function getTheme(themeId: string): UITheme {
  return HUD_THEMES[themeId] || HUD_THEMES.default;
}

/** Back-compat alias for older call sites (crosshair, hud.ts). */
export const getThemeColors = getTheme;
