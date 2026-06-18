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
  bgDeep: string;
  bgWindow: string;
  bgPanel: string;
  bgElevated: string;
  // borders
  border: string;
  borderSoft: string;
  borderAccent: string;
  // text
  textBright: string;
  textMain: string;
  textDim: string;
  textFaint: string;
  // semantic accents
  accent: string;
  positive: string;
  shield: string;
  hull: string;
  danger: string;
  cap: string;
  arcane?: string;
}

/** Back-compat alias — older call sites import `HudTheme`. */
export type HudTheme = UITheme;

export interface FontOption {
  id: string;
  label: string;
  stack: string;
}

export type VideoPreset = "performance" | "balanced" | "cinematic" | "custom";

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
