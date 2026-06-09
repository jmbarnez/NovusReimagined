import { Client } from "../../state.js";
import { HUD_BOTTOM_H } from "../../constants.js";
import { getTheme, getFontStack } from "../../data/settings.js";
import { hudState } from "../hud/state.js";
import { setCssVar } from "../dom-helpers.js";

/* ── Theme ──
 * Tokens are written to the document root so every DOM UI surface (HUD,
 * bridge windows, station screens, settings) inherits the active theme + font.
 * Re-applied each frame but short-circuited unless theme/font actually changed.
 */
let appliedTheme = "";
let appliedFont = "";
let appliedUiScale = -1;
let appliedFontScale = -1;

export function applyTheme(themeId: string, fontId: string) {
  // Layout var on the HUD root.
  if (hudState.root) {
    setCssVar(hudState.root, "--hud-bottom-h", `${HUD_BOTTOM_H}px`);
  }
  const uiScale = Client.settings?.uiScale ?? 1.0;
  const fontScale = Client.settings?.fontScale ?? 1.0;
  const s = document.documentElement;
  setCssVar(s, "--ui-scale", String(uiScale));
  setCssVar(s, "--font-scale", String(fontScale));
  // UI overlays are scaled via `transform: scale(var(--ui-scale))`. Counteract that
  // so font size can be controlled independently.
  setCssVar(s, "--effective-font-scale", String(fontScale / uiScale));

  if (themeId === appliedTheme && fontId === appliedFont && uiScale === appliedUiScale && fontScale === appliedFontScale) return;
  appliedTheme = themeId;
  appliedFont = fontId;
  appliedUiScale = uiScale;
  appliedFontScale = fontScale;

  const t = getTheme(themeId);
  // Font
  setCssVar(s, "--font-family", getFontStack(fontId));
  // Surfaces
  setCssVar(s, "--hud-bg-deep", t.bgDeep);
  setCssVar(s, "--hud-bg-window", t.bgWindow);
  setCssVar(s, "--hud-bg-panel", t.bgPanel);
  setCssVar(s, "--hud-bg-elevated", t.bgElevated);
  // Borders
  setCssVar(s, "--hud-border", t.border);
  setCssVar(s, "--hud-border-soft", t.borderSoft);
  setCssVar(s, "--hud-border-accent", t.borderAccent);
  // Text
  setCssVar(s, "--hud-text-bright", t.textBright);
  setCssVar(s, "--hud-text-main", t.textMain);
  setCssVar(s, "--hud-text-dim", t.textDim);
  setCssVar(s, "--hud-text-faint", t.textFaint);
  // Semantic accents
  setCssVar(s, "--hud-accent", t.accent);
  setCssVar(s, "--hud-positive", t.positive);
  setCssVar(s, "--hud-shield", t.shield);
  setCssVar(s, "--hud-hull", t.hull);
  setCssVar(s, "--hud-danger", t.danger);
  setCssVar(s, "--hud-cap", t.cap);
  setCssVar(s, "--hud-arcane", t.arcane ?? "#8858a8");
  // Legacy aliases used by existing layout CSS (top/bottom bars).
  setCssVar(s, "--hud-top-bar", t.bgDeep);
  setCssVar(s, "--hud-top-border", t.border);
  setCssVar(s, "--hud-bottom-top", t.bgPanel);
  setCssVar(s, "--hud-bottom-bot", t.bgDeep);
  setCssVar(s, "--hud-bottom-border", t.borderAccent);
}

/** Force a re-apply (e.g. after the player changes theme/font in settings). */
export function refreshTheme() {
  appliedTheme = "";
  appliedFont = "";
  applyTheme(Client.settings?.theme || "default", Client.settings?.fontFamily || "Orbitron");
}
