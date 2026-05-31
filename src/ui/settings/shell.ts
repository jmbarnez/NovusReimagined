import "../styles/settings.css";
import { t } from "../../utils/i18n.js";
import { windowHeadButtonsHTML } from "../hud/window-chrome.js";
import { attachSettingsListeners } from "./listeners.js";

export function settingsContentHTML(): string {
  return `
      <div class="settings-tabs" id="settings-tabs">
        <button class="settings-tab active" data-tab="audio">${t("settings.tab.audio")}</button>
        <button class="settings-tab" data-tab="video">${t("settings.tab.video")}</button>
        <button class="settings-tab" data-tab="interface">${t("settings.tab.interface")}</button>
        <button class="settings-tab" data-tab="controls">${t("settings.tab.controls")}</button>
      </div>
      <div class="eve-win-body">
        <div id="settings-body">
        <div class="settings-tab-panel active" data-tab-panel="audio">
        <h3 class="accent-audio">${t("settings.tab.audio")}</h3>
        <div class="settings-row">
          <label>${t("settings.sfxVolume")}</label>
          <input type="range" id="sfx-volume" min="0" max="1" step="0.05" value="1">
          <span class="settings-tip-icon" data-tip-impact="NONE" data-tip-desc="${t("settings.tip.sfxVolume")}">ⓘ</span>
        </div>
        <div class="settings-row">
          <label>${t("settings.music")}</label>
          <input type="range" id="music-volume" min="0" max="1" step="0.05" value="1">
          <span class="settings-tip-icon" data-tip-impact="NONE" data-tip-desc="${t("settings.tip.music")}">ⓘ</span>
        </div>
        </div>
        <div class="settings-tab-panel" data-tab-panel="video">
        <h3 class="accent-video">${t("settings.tab.video")}</h3>
        <div class="settings-row">
          <label>${t("settings.renderScale")}</label>
          <input type="range" id="render-scale" min="0.5" max="2.5" step="0.1" value="2.5">
          <span id="render-scale-val" class="settings-val">2.5x</span>
          <span class="settings-tip-icon" data-tip-impact="HIGH" data-tip-desc="${t("settings.tip.renderScale")}">ⓘ</span>
        </div>
        <div class="settings-row">
          <label>${t("settings.bloom")}</label>
          <input type="range" id="bloom-intensity" min="0.0" max="2.0" step="0.1" value="1.0">
          <span id="bloom-intensity-val" class="settings-val">1.0x</span>
          <span class="settings-tip-icon" data-tip-impact="LOW" data-tip-desc="${t("settings.tip.bloom")}">ⓘ</span>
        </div>
        <div class="settings-row">
          <label>${t("settings.background")}</label>
          <div id="detail-buttons" style="display:flex;gap:6px;"></div>
          <span class="settings-tip-icon" data-tip-impact="MEDIUM" data-tip-desc="${t("settings.tip.background")}">ⓘ</span>
        </div>
        <div class="settings-row settings-toggle-row">
          <label>${t("settings.vignette")}</label>
          <input type="checkbox" id="vignette-toggle" class="toggle-switch" checked>
          <span class="settings-tip-icon" data-tip-impact="LOW" data-tip-desc="${t("settings.tip.vignette")}">ⓘ</span>
        </div>
        <div class="settings-row settings-toggle-row">
          <label>${t("settings.directionalLighting")}</label>
          <input type="checkbox" id="dir-light-toggle" class="toggle-switch" checked>
          <span class="settings-tip-icon" data-tip-impact="LOW" data-tip-desc="${t("settings.tip.directionalLighting")}">ⓘ</span>
        </div>
        <div class="settings-row settings-toggle-row">
          <label>${t("settings.atmosphericRim")}</label>
          <input type="checkbox" id="atm-rim-toggle" class="toggle-switch" checked>
          <span class="settings-tip-icon" data-tip-impact="LOW" data-tip-desc="${t("settings.tip.atmosphericRim")}">ⓘ</span>
        </div>
        <div class="settings-row settings-toggle-row">
          <label>${t("settings.colorGrading")}</label>
          <input type="checkbox" id="color-grade-toggle" class="toggle-switch" checked>
          <span class="settings-tip-icon" data-tip-impact="LOW" data-tip-desc="${t("settings.tip.colorGrading")}">ⓘ</span>
        </div>
        <div class="settings-row settings-toggle-row">
          <label>${t("settings.mipmapping")}</label>
          <input type="checkbox" id="mipmapping-toggle" class="toggle-switch" checked>
          <span class="settings-tip-icon" data-tip-impact="NONE" data-tip-desc="${t("settings.tip.mipmapping")}">ⓘ</span>
        </div>
        <div class="settings-row settings-toggle-row">
          <label>${t("settings.lensFlare")}</label>
          <input type="checkbox" id="lens-flare-toggle" class="toggle-switch" checked>
          <span class="settings-tip-icon" data-tip-impact="LOW" data-tip-desc="${t("settings.tip.lensFlare")}">ⓘ</span>
        </div>

        <h3 class="accent-camera">Camera</h3>
        <div class="settings-row">
          <label>${t("settings.smoothing")}</label>
          <input type="range" id="camera-smoothing" min="0.02" max="0.20" step="0.01" value="0.08">
          <span id="camera-smoothing-val" class="settings-val">0.08</span>
          <span class="settings-tip-icon" data-tip-impact="NONE" data-tip-desc="${t("settings.tip.smoothing")}">ⓘ</span>
        </div>
        </div>
        <div class="settings-tab-panel" data-tab-panel="interface">
        <h3 class="accent-theme">${t("settings.theme")}</h3>
        <div id="theme-buttons" class="settings-swatch-grid"></div>
        <h3 class="accent-theme">${t("settings.font")}</h3>
        <div id="font-buttons" class="settings-btn-row"></div>
        <h3 class="accent-theme">${t("settings.reticle")}</h3>
        <div id="reticle-buttons" class="settings-btn-row"></div>
        <h3 class="accent-theme">${t("settings.uiScale")}</h3>
        <div class="settings-row">
          <label>${t("settings.scaleFactor")}</label>
          <input type="range" id="ui-scale" min="0.7" max="1.5" step="0.05" value="1.0">
          <span id="ui-scale-val" class="settings-val">1.00x</span>
          <span class="settings-tip-icon" data-tip-impact="NONE" data-tip-desc="${t("settings.tip.uiScale")}">ⓘ</span>
        </div>
        <h3 class="accent-theme">${t("settings.language")}</h3>
        <div class="settings-row">
          <label>${t("settings.language")}</label>
          <select id="settings-language" class="settings-select">
            <option value="en">${t("settings.option.en")}</option>
            <option value="es">${t("settings.option.es")}</option>
          </select>
        </div>
        </div>
        <div class="settings-tab-panel" data-tab-panel="controls">
        <h3 class="accent-controls">${t("settings.tab.controls")}</h3>
        <div id="keybind-list"></div>
        </div>
        </div>
      </div>
      <div class="eve-win-foot" id="settings-footer">
        <button id="settings-exit" class="btn-exit">${t("common.exit")}</button>
        <button id="settings-reset">${t("settings.reset")}</button>
        <button id="settings-save">${t("common.save")}</button>
      </div>`;
}

export function ensureSettingsUI() {
  if (document.getElementById("settings-overlay")) return;
  const el = document.createElement("div");
  el.id = "settings-overlay";
  el.innerHTML = `
    <div id="settings-panel" class="eve-window">
      <div class="eve-win-head">
        <div class="eve-win-title">${t("settings.title")}</div>
        <div class="eve-win-sub">${t("settings.subtitle")}</div>
        ${windowHeadButtonsHTML()}
      </div>
      ${settingsContentHTML()}
    </div>`;
  document.body.appendChild(el);

  const bubble = document.createElement("div");
  bubble.id = "settings-tooltip-bubble";
  document.body.appendChild(bubble);

  attachSettingsListeners(el, bubble);
}
