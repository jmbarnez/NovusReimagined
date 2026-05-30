import { Client } from "../../state.js";
import { saveSettings } from "../../data/settings.js";
import { sfxBlip, sfxConfirm, setSfxVolume } from "../../audio/procedural.js";
import { setMusicVolume } from "../../audio/music.js";
import { resize } from "../../canvas.js";
import { resizePixi } from "../../pixi.js";
import { refreshTheme } from "../hud-overlay.js";
import { clearShipTextureCaches, rebuildPlayerSprites } from "../../render/pixi-player.js";
import { clearEnemyTextureCaches } from "../../render/pixi-entities.js";
import { clearStationTextureCaches } from "../../render/pixi-stations.js";
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
    const scale = Client.settings?.uiScale ?? 1.0;
    const bw = bubble.offsetWidth, bh = bubble.offsetHeight;
    const r = icon.getBoundingClientRect();
    let left = r.left - (bw * scale) - 8;
    if (left < 8) left = r.right + 8;
    let top = r.top + r.height / 2 - (bh * scale) / 2;
    if (top < 8) top = 8;
    if (top + (bh * scale) > window.innerHeight - 8) top = window.innerHeight - (bh * scale) - 8;
    bubble.style.left = `${left / scale}px`;
    bubble.style.top = `${top / scale}px`;
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

  const panel = el.querySelector("#settings-panel") as HTMLElement;
  const closeBtn = panel.querySelector(".eve-win-close") as HTMLElement;
  const expandBtn = panel.querySelector(".eve-win-expand") as HTMLElement;
  bindWindowChromeButton(closeBtn);
  closeBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    sfxBlip();
    closeSettings();
  });
  attachSingleWindowExpand(panel, expandBtn, { embedded: true });

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
  el.querySelector("#render-scale")!.addEventListener("input", (e) => {
    const v = parseFloat((e.target as HTMLInputElement).value);
    Client.settings.renderScale = v;
    (document.getElementById("render-scale-val") as HTMLElement).textContent = v.toFixed(1) + "x";
    resize();
    resizePixi();
    saveSettings(Client.settings);
  });
  el.querySelector("#bloom-intensity")!.addEventListener("input", (e) => {
    const v = parseFloat((e.target as HTMLInputElement).value);
    Client.settings.bloomIntensity = v;
    (document.getElementById("bloom-intensity-val") as HTMLElement).textContent = v.toFixed(1) + "x";
    saveSettings(Client.settings);
  });
  el.querySelector("#vignette-toggle")!.addEventListener("change", (e) => {
    Client.settings.vignetteEnabled = (e.target as HTMLInputElement).checked;
    saveSettings(Client.settings);
  });
  el.querySelector("#dir-light-toggle")!.addEventListener("change", (e) => {
    Client.settings.directionalLighting = (e.target as HTMLInputElement).checked;
    saveSettings(Client.settings);
    clearShipTextureCaches(); clearEnemyTextureCaches(); clearStationTextureCaches();
    rebuildPlayerSprites();
  });
  el.querySelector("#atm-rim-toggle")!.addEventListener("change", (e) => {
    Client.settings.atmosphericRim = (e.target as HTMLInputElement).checked;
    saveSettings(Client.settings);
  });
  el.querySelector("#color-grade-toggle")!.addEventListener("change", (e) => {
    Client.settings.colorGrading = (e.target as HTMLInputElement).checked;
    saveSettings(Client.settings);
  });
  el.querySelector("#mipmapping-toggle")!.addEventListener("change", (e) => {
    Client.settings.mipmapping = (e.target as HTMLInputElement).checked;
    saveSettings(Client.settings);
    clearShipTextureCaches();
    clearEnemyTextureCaches();
    rebuildPlayerSprites();
  });
  el.querySelector("#lens-flare-toggle")!.addEventListener("change", (e) => {
    Client.settings.lensFlare = (e.target as HTMLInputElement).checked;
    saveSettings(Client.settings);
  });

  el.querySelector("#camera-smoothing")!.addEventListener("input", (e) => {
    const v = parseFloat((e.target as HTMLInputElement).value);
    Client.settings.cameraSmoothing = v;
    (document.getElementById("camera-smoothing-val") as HTMLElement).textContent = v.toFixed(2);
    saveSettings(Client.settings);
  });

  el.querySelector("#ui-scale")!.addEventListener("input", (e) => {
    const v = parseFloat((e.target as HTMLInputElement).value);
    Client.settings.uiScale = v;
    (document.getElementById("ui-scale-val") as HTMLElement).textContent = v.toFixed(2) + "x";
    saveSettings(Client.settings);
    refreshTheme();
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
