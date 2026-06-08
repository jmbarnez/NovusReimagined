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

export function attachSettingsListeners(el: HTMLElement, bubble: HTMLElement) {
  const impactClass: Record<string, string> = { NONE: "tip-impact-none", LOW: "tip-impact-low", MEDIUM: "tip-impact-medium", HIGH: "tip-impact-high" };
  el.addEventListener("mouseover", (e) => {
    const icon = (e.target as HTMLElement).closest(".settings-tip-icon") as HTMLElement | null;
    if (!icon) {
      bubble.style.display = "none";
      return;
    }
    const impact = icon.dataset.tipImpact || "NONE";
    const desc = icon.dataset.tipDesc || "";
    bubble.innerHTML = `<div class="tip-impact ${impactClass[impact] || "tip-impact-none"}">PERF IMPACT: ${impact}</div><div class="tip-desc">${desc}</div>`;
    bubble.style.visibility = "hidden";
    bubble.style.display = "block";
    const bw = bubble.offsetWidth, bh = bubble.offsetHeight;
    const r = icon.getBoundingClientRect();
    let left = r.left - bw - 8;
    if (left < 8) left = r.right + 8;
    let top = r.top + r.height / 2 - bh / 2;
    if (top < 8) top = 8;
    if (top + bh > window.innerHeight - 8) top = window.innerHeight - bh - 8;
    bubble.style.left = `${left}px`;
    bubble.style.top = `${top}px`;
    bubble.style.visibility = "visible";
  });
  el.addEventListener("mouseout", (e) => {
    const icon = (e.target as HTMLElement).closest(".settings-tip-icon") as HTMLElement | null;
    if (icon) {
      bubble.style.display = "none";
    }
  });
  el.addEventListener("mouseleave", () => { bubble.style.display = "none"; });

  on("ui:close-overlays", () => {
    const panel = el.querySelector("#settings-panel") as HTMLElement | null;
    if (panel) resetWindowExpand(panel, { embedded: true });
    el.style.display = "none";
    bubble.style.display = "none";
    Client.settingsOpen = false;
  });

  const panel = el.id === "settings-panel" ? el : el.querySelector("#settings-panel");
  if (panel) {
    const closeBtn = panel.querySelector(".eve-win-close") as HTMLElement | null;
    const expandBtn = panel.querySelector(".eve-win-expand") as HTMLElement | null;
    if (closeBtn) {
      bindWindowChromeButton(closeBtn);
      closeBtn.addEventListener("click", (ev) => {
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
    tab.addEventListener("click", () => {
      sfxBlip();
      bubble.style.display = "none";
      const name = (tab as HTMLElement).dataset.tab!;
      el.querySelectorAll(".settings-tab").forEach((t) => t.classList.toggle("active", t === tab));
      el.querySelectorAll(".settings-tab-panel").forEach((p) =>
        p.classList.toggle("active", (p as HTMLElement).dataset.tabPanel === name));
    });
  });
  el.querySelector("#settings-exit")!.addEventListener("click", () => { sfxBlip(); closeSettings(); });
  el.querySelector("#settings-reset")!.addEventListener("click", () => { sfxBlip(); resetSettings(); });
  el.querySelector("#settings-save")!.addEventListener("click", () => {
    sfxConfirm();
    saveSettings(Client.settings);
    const btn = el.querySelector("#settings-save") as HTMLButtonElement;
    btn.textContent = "✓ " + t("common.saved");
    btn.disabled = true;
    setTimeout(() => { btn.textContent = t("common.save"); btn.disabled = false; }, 1200);
  });
  el.querySelector("#sfx-volume")!.addEventListener("input", (e) => {
    const v = parseFloat((e.target as HTMLInputElement).value);
    Client.settings.sfxVolume = v;
    setSfxVolume(v);
    saveSettings(Client.settings);
  });
  el.querySelector("#music-volume")!.addEventListener("input", (e) => {
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

  el.querySelector("#render-scale")!.addEventListener("input", (e) => {
    const v = parseFloat((e.target as HTMLInputElement).value);
    Client.settings.renderScale = v;
    (document.getElementById("render-scale-val") as HTMLElement).textContent = v.toFixed(1) + "x";
    resizePixi();
    setCustomPreset();
    saveSettings(Client.settings);
  });
  el.querySelector("#fps-limit")!.addEventListener("change", (e) => {
    const v = parseInt((e.target as HTMLSelectElement).value, 10);
    Client.settings.fpsLimit = Number.isFinite(v) ? v : 0;
    saveSettings(Client.settings);
  });
  el.querySelector("#bloom-intensity")!.addEventListener("input", (e) => {
    const v = parseFloat((e.target as HTMLInputElement).value);
    Client.settings.bloomIntensity = v;
    (document.getElementById("bloom-intensity-val") as HTMLElement).textContent = v.toFixed(1) + "x";
    setCustomPreset();
    saveSettings(Client.settings);
  });
  el.querySelector("#vignette-toggle")!.addEventListener("change", (e) => {
    Client.settings.vignetteEnabled = (e.target as HTMLInputElement).checked;
    setCustomPreset();
    saveSettings(Client.settings);
  });
  el.querySelector("#dir-light-toggle")!.addEventListener("change", (e) => {
    Client.settings.directionalLighting = (e.target as HTMLInputElement).checked;
    setCustomPreset();
    saveSettings(Client.settings);
    clearShipTextureCaches(); clearEnemyTextureCaches(); clearStationTextureCaches();
    rebuildPlayerSprites();
  });
  el.querySelector("#atm-rim-toggle")!.addEventListener("change", (e) => {
    Client.settings.atmosphericRim = (e.target as HTMLInputElement).checked;
    setCustomPreset();
    saveSettings(Client.settings);
  });
  el.querySelector("#color-grade-toggle")!.addEventListener("change", (e) => {
    const checked = (e.target as HTMLInputElement).checked;
    Client.settings.colorGrading = checked;
    syncColorGrading(checked);
    setCustomPreset();
    saveSettings(Client.settings);
  });
  el.querySelector("#mipmapping-toggle")!.addEventListener("change", (e) => {
    Client.settings.mipmapping = (e.target as HTMLInputElement).checked;
    setCustomPreset();
    saveSettings(Client.settings);
    clearShipTextureCaches();
    clearEnemyTextureCaches();
    rebuildPlayerSprites();
  });
  el.querySelector("#lens-flare-toggle")!.addEventListener("change", (e) => {
    Client.settings.lensFlare = (e.target as HTMLInputElement).checked;
    setCustomPreset();
    saveSettings(Client.settings);
  });


  el.querySelector("#ui-scale")!.addEventListener("input", (e) => {
    const v = parseFloat((e.target as HTMLInputElement).value);
    Client.settings.uiScale = v;
    (document.getElementById("ui-scale-val") as HTMLElement).textContent = v.toFixed(2) + "x";
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

  el.querySelector("#font-scale")!.addEventListener("input", (e) => {
    const v = parseFloat((e.target as HTMLInputElement).value);
    Client.settings.fontScale = v;
    (document.getElementById("font-scale-val") as HTMLElement).textContent = v.toFixed(2) + "x";
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

  el.querySelector("#settings-language")!.addEventListener("change", (e) => {
    const v = (e.target as HTMLSelectElement).value as "en" | "es";
    Client.settings.language = v;
    saveSettings(Client.settings);
    try { savePlayer(); } catch { /* no-op on title screen */ }
    location.reload();
  });

  window.addEventListener("keydown", (e) => {
    if (!Client.settingsOpen || !listeningFor) return;
    e.preventDefault();
    if (e.code === "Escape") {
      setListeningFor(null);
      renderSettings();
      return;
    }
    (Client.settings.keybinds as unknown as Record<string, string>)[listeningFor!] = e.code;
    saveSettings(Client.settings);
    setListeningFor(null);
    renderSettings();
  });
}
