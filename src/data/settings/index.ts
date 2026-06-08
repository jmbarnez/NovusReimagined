// Barrel: re-export everything so existing `import { ... } from "../data/settings.js"` keeps working.
export type {
  Keybinds,
  KeybindAction,
  ControlSection,
  ControlSectionAction,
  UITheme,
  HudTheme,
  FontOption,
  Settings,
  VideoPreset,
  MovementControlMode,
} from "./types.js";

export { FONT_OPTIONS, getFontStack } from "./fonts.js";
export { DEFAULT_KEYBINDS, CONTROL_SECTIONS, loadKeybinds } from "./keybinds.js";
export { HUD_THEMES, getTheme, getThemeColors } from "./themes.js";
export { DEFAULT_SETTINGS, loadSettings, saveSettings } from "./persistence.js";
