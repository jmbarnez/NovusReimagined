import { Client } from "../../state.js";
import { saveSettings } from "../../data/settings.js";
import { sfxBlip, sfxConfirm, setSfxVolume } from "../../audio/procedural.js";
import { setMusicVolume } from "../../audio/music.js";
import { resizePixi, syncColorGrading } from "../../pixi.js";
import { refreshTheme } from "../hud-overlay.js";
import { clearShipTextureCaches, rebuildPlayerSprites } from "../../render/player/index.js";
import { clearEnemyTextureCaches, refreshEntityFonts } from "../../render/enemy/index.js";
import { clearStationTextureCaches } from "../../render/pixi-stations.js";
import { refreshCelestialFonts } from "../../render/celestial/index.js";
import { refreshEffectFonts } from "../../render/fx/index.js";
import { refreshHudFonts } from "../../render/pixi-hud-core.js";
import { refreshChatBubbleFonts } from "../../render/pixi-chat-bubbles.js";
import { refreshStationOverlayFonts } from "../../render/pixi-station-overlays.js";
import { refreshTargetArrowFonts } from "../../render/pixi-target-arrows.js";
import { refreshTutorialGateFonts } from "../../render/pixi-tutorial-gates.js";
import { refreshWarpScreenFonts } from "../../render/pixi-warp-screen.js";
import { refreshEffectsOverlayFonts } from "../../render/pixi-effects-overlay.js";
import { refreshWorldLabelTextStyle } from "../../render/world-label-card.js";
import { savePlayer } from "../../player/player-data.js";
import { on } from "../../events.js";
import { bindWindowChromeButton, attachSingleWindowExpand, resetWindowExpand } from "../hud/window-chrome.js";
import { closeSettings, listeningFor, setListeningFor } from "./state.js";
import { renderSettings } from "./render.js";
import { resetSettings } from "./reset.js";
import { t } from "../../utils/i18n.js";
import { getElement, setHtml, setText, setStyle, onClick, onInput, onChange, onMouseOver, onMouseOut, onMouseLeave, onWindowKeydown } from "../dom-helpers.js";

export function attachSettingsListeners(el: HTMLElement, bubble: HTMLElement) {
  const impactClass: Record<string, string> = { NONE: "tip-impact-none", LOW: "tip-impact-low", MEDIUM: "tip-impact-medium", HIGH: "tip-impact-high" };
  onMouseOver(el, (e) => {
    const icon = (e.target as HTMLElement).closest(".settings-tip-icon") as HTMLElement | null;
    if (!icon) {
      setStyle(bubble, { display: "none" });
      return;
    }
    const impact = icon.dataset.tipImpact || "NONE";
    const desc = icon.dataset.tipDesc || "";
    setHtml(bubble, `<div class="tip-impact ${impactClass[impact] || "tip-impact-none"}">PERF IMPACT: ${impact}</div><div class="tip-desc">${desc}</div>`);
    setStyle(bubble, { visibility: "hidden", display: "block" });
    const bw = bubble.offsetWidth, bh = bubble.offsetHeight;
    const r = icon.getBoundingClientRect();
    let left = r.left - bw - 8;
    if (left < 8) left = r.right + 8;
    let top = r.top + r.height / 2 - bh / 2;
    if (top < 8) top = 8;
    if (top + bh > window.innerHeight - 8) top = window.innerHeight - bh - 8;
    setStyle(bubble, { left: `${left}px`, top: `${top}px`, visibility: "visible" });
  });
  onMouseOut(el, (e) => {
    const icon = (e.target as HTMLElement).closest(".settings-tip-icon") as HTMLElement | null;
    if (icon) {
      setStyle(bubble, { display: "none" });
    }
  });
  onMouseLeave(el, () => { setStyle(bubble, { display: "none" }); });

  on("ui:close-overlays", () => {
    const panel = el.querySelector("#settings-panel") as HTMLElement | null;
    if (panel) resetWindowExpand(panel, { embedded: true });
    setStyle(el, { display: "none" });
    setStyle(bubble, { display: "none" });
    Client.settingsOpen = false;
  });

  const panel = el.id === "settings-panel" ? el : el.querySelector("#settings-panel");
  if (panel) {
    const closeBtn = panel.querySelector(".eve-win-close") as HTMLElement | null;
    const expandBtn = panel.querySelector(".eve-win-expand") as HTMLElement | null;
    if (closeBtn) {
      bindWindowChromeButton(closeBtn);
      onClick(closeBtn, (ev) => {
        ev.stopPropagation();
        sfxBlip();
        closeSettings();
      });
    }
    if (expandBtn) {
      attachSingleWindowExpand(panel as HTMLElement, expandBtn, { embedded: true });
    }
  }

  // Tab strip — toggle which panel is visible.
  el.querySelectorAll(".settings-tab").forEach((tab) => {
    onClick(tab, () => {
      sfxBlip();
      setStyle(bubble, { display: "none" });
      const name = (tab as HTMLElement).dataset.tab!;
      el.querySelectorAll(".settings-tab").forEach((t) => t.classList.toggle("active", t === tab));
      el.querySelectorAll(".settings-tab-panel").forEach((p) =>
        p.classList.toggle("active", (p as HTMLElement).dataset.tabPanel === name));
    });
  });
  onClick(el.querySelector("#settings-exit")!, () => { sfxBlip(); closeSettings(); });
  onClick(el.querySelector("#settings-reset")!, () => { sfxBlip(); resetSettings(); });
  onClick(el.querySelector("#settings-save")!, () => {
    sfxConfirm();
    saveSettings(Client.settings);
    const btn = el.querySelector("#settings-save") as HTMLButtonElement;
    setText(btn, "✓ " + t("common.saved"));
    btn.disabled = true;
    setTimeout(() => { setText(btn, t("common.save")); btn.disabled = false; }, 1200);
  });
  onInput(el.querySelector("#sfx-volume")!, (e) => {
    const v = parseFloat((e.target as HTMLInputElement).value);
    Client.settings.sfxVolume = v;
    setSfxVolume(v);
    saveSettings(Client.settings);
  });
  onInput(el.querySelector("#music-volume")!, (e) => {
    const v = parseFloat((e.target as HTMLInputElement).value);
    Client.settings.musicVolume = v;
    setMusicVolume(v);
    saveSettings(Client.settings);
  });
  const setCustomPreset = () => {
    if (Client.settings.videoPreset !== "custom") {
      Client.settings.videoPreset = "custom";
      saveSettings(Client.settings);
    }
  };

  onInput(el.querySelector("#render-scale")!, (e) => {
    const v = parseFloat((e.target as HTMLInputElement).value);
    Client.settings.renderScale = v;
    setText(getElement("render-scale-val") as HTMLElement, v.toFixed(1) + "x");
    resizePixi();
    setCustomPreset();
    saveSettings(Client.settings);
  });
  onChange(el.querySelector("#fps-limit")!, (e) => {
    const v = parseInt((e.target as HTMLSelectElement).value, 10);
    Client.settings.fpsLimit = Number.isFinite(v) ? v : 0;
    saveSettings(Client.settings);
  });
  onInput(el.querySelector("#bloom-intensity")!, (e) => {
    const v = parseFloat((e.target as HTMLInputElement).value);
    Client.settings.bloomIntensity = v;
    setText(getElement("bloom-intensity-val") as HTMLElement, v.toFixed(1) + "x");
    setCustomPreset();
    saveSettings(Client.settings);
  });
  onChange(el.querySelector("#vignette-toggle")!, (e) => {
    Client.settings.vignetteEnabled = (e.target as HTMLInputElement).checked;
    setCustomPreset();
    saveSettings(Client.settings);
  });
  onChange(el.querySelector("#dir-light-toggle")!, (e) => {
    Client.settings.directionalLighting = (e.target as HTMLInputElement).checked;
    setCustomPreset();
    saveSettings(Client.settings);
    clearShipTextureCaches(); clearEnemyTextureCaches(); clearStationTextureCaches();
    rebuildPlayerSprites();
  });
  onChange(el.querySelector("#atm-rim-toggle")!, (e) => {
    Client.settings.atmosphericRim = (e.target as HTMLInputElement).checked;
    setCustomPreset();
    saveSettings(Client.settings);
  });
  onChange(el.querySelector("#color-grade-toggle")!, (e) => {
    const checked = (e.target as HTMLInputElement).checked;
    Client.settings.colorGrading = checked;
    syncColorGrading(checked);
    setCustomPreset();
    saveSettings(Client.settings);
  });
  onChange(el.querySelector("#mipmapping-toggle")!, (e) => {
    Client.settings.mipmapping = (e.target as HTMLInputElement).checked;
    setCustomPreset();
    saveSettings(Client.settings);
    clearShipTextureCaches();
    clearEnemyTextureCaches();
    rebuildPlayerSprites();
  });
  onChange(el.querySelector("#lens-flare-toggle")!, (e) => {
    Client.settings.lensFlare = (e.target as HTMLInputElement).checked;
    setCustomPreset();
    saveSettings(Client.settings);
  });
  onChange(el.querySelector("#antialias-toggle")!, (e) => {
    Client.settings.antialias = (e.target as HTMLInputElement).checked;
    setCustomPreset();
    saveSettings(Client.settings);
  });


  onInput(el.querySelector("#ui-scale")!, (e) => {
    const v = parseFloat((e.target as HTMLInputElement).value);
    Client.settings.uiScale = v;
    setText(getElement("ui-scale-val") as HTMLElement, v.toFixed(2) + "x");
    saveSettings(Client.settings);
    refreshTheme();
    refreshWorldLabelTextStyle();
    refreshEntityFonts();
    refreshCelestialFonts();
    refreshHudFonts();
    refreshChatBubbleFonts();
    refreshStationOverlayFonts();
    refreshEffectFonts();
    refreshTargetArrowFonts();
    refreshTutorialGateFonts();
    refreshWarpScreenFonts();
    refreshEffectsOverlayFonts();
    window.dispatchEvent(new Event("resize"));
  });

  onInput(el.querySelector("#font-scale")!, (e) => {
    const v = parseFloat((e.target as HTMLInputElement).value);
    Client.settings.fontScale = v;
    setText(getElement("font-scale-val") as HTMLElement, v.toFixed(2) + "x");
    saveSettings(Client.settings);
    refreshTheme();
    refreshWorldLabelTextStyle();
    refreshEntityFonts();
    refreshCelestialFonts();
    refreshHudFonts();
    refreshChatBubbleFonts();
    refreshStationOverlayFonts();
    refreshEffectFonts();
    refreshTargetArrowFonts();
    refreshTutorialGateFonts();
    refreshWarpScreenFonts();
    refreshEffectsOverlayFonts();
    window.dispatchEvent(new Event("resize"));
  });

  onChange(el.querySelector("#settings-language")!, (e) => {
    const v = (e.target as HTMLSelectElement).value as "en" | "es";
    Client.settings.language = v;
    saveSettings(Client.settings);
    try { savePlayer(); } catch { /* no-op on title screen */ }
    location.reload();
  });

  onWindowKeydown((e) => {
    const ev = e as KeyboardEvent;
    if (!Client.settingsOpen || !listeningFor) return;
    ev.preventDefault();
    if (ev.code === "Escape") {
      setListeningFor(null);
      renderSettings();
      return;
    }
    (Client.settings.keybinds as unknown as Record<string, string>)[listeningFor!] = ev.code;
    saveSettings(Client.settings);
    setListeningFor(null);
    renderSettings();
  });
}
