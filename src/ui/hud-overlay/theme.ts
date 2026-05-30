import { Client } from "../../state.js";
import { HUD_BOTTOM_H } from "../../constants.js";
import { getTheme, getFontStack } from "../../data/settings.js";
import { hudState } from "../hud/state.js";

/* ── Theme ──
 * Tokens are written to the document root so every DOM UI surface (HUD,
 * bridge windows, station screens, settings) inherits the active theme + font.
 * Re-applied each frame but short-circuited unless theme/font actually changed.
 */
let appliedTheme = "";
let appliedFont = "";
let appliedUiScale = -1;

export function applyTheme(themeId: string, fontId: string) {
  // Layout var on the HUD root.
  if (hudState.root) {
    hudState.root.style.setProperty("--hud-bottom-h", `${HUD_BOTTOM_H}px`);
  }
  const uiScale = Client.settings?.uiScale ?? 1.0;
  const s = document.documentElement.style;
  s.setProperty("--ui-scale", String(uiScale));

  if (themeId === appliedTheme && fontId === appliedFont && uiScale === appliedUiScale) return;
  appliedTheme = themeId;
  appliedFont = fontId;
  appliedUiScale = uiScale;

  const t = getTheme(themeId);
  // Font
  s.setProperty("--font-family", getFontStack(fontId));
  // Surfaces
  s.setProperty("--hud-bg-deep", t.bgDeep);
  s.setProperty("--hud-bg-window", t.bgWindow);
  s.setProperty("--hud-bg-panel", t.bgPanel);
  s.setProperty("--hud-bg-elevated", t.bgElevated);
  // Borders
  s.setProperty("--hud-border", t.border);
  s.setProperty("--hud-border-soft", t.borderSoft);
  s.setProperty("--hud-border-accent", t.borderAccent);
  // Text
  s.setProperty("--hud-text-bright", t.textBright);
  s.setProperty("--hud-text-main", t.textMain);
  s.setProperty("--hud-text-dim", t.textDim);
  s.setProperty("--hud-text-faint", t.textFaint);
  // Semantic accents
  s.setProperty("--hud-accent", t.accent);
  s.setProperty("--hud-positive", t.positive);
  s.setProperty("--hud-shield", t.shield);
  s.setProperty("--hud-hull", t.hull);
  s.setProperty("--hud-danger", t.danger);
  s.setProperty("--hud-cap", t.cap);
  s.setProperty("--hud-arcane", t.arcane ?? "#8858a8");
  // Legacy aliases used by existing layout CSS (top/bottom bars).
  s.setProperty("--hud-top-bar", t.bgDeep);
  s.setProperty("--hud-top-border", t.border);
  s.setProperty("--hud-bottom-top", t.bgPanel);
  s.setProperty("--hud-bottom-bot", t.bgDeep);
  s.setProperty("--hud-bottom-border", t.borderAccent);
}

/** Force a re-apply (e.g. after the player changes theme/font in settings). */
export function refreshTheme() {
  appliedTheme = "";
  appliedFont = "";
  applyTheme(Client.settings?.theme || "default", Client.settings?.fontFamily || "Orbitron");
}
