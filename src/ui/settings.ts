import "./styles/settings.css";
import { G, Client } from "../state.js";
import { loadSettings, saveSettings, DEFAULT_SETTINGS, DEFAULT_KEYBINDS, KEYBIND_LABELS, HUD_THEMES, type Keybinds } from "../data/settings.js";
import { closeBridge, renderBridgeUI } from "../dock.js";
import { sfxBlip, sfxConfirm, setSfxVolume } from "../audio/procedural.js";
import { setMusicVolume } from "../audio/music.js";
import { initBackgroundStars } from "../render/background.js";
import { refreshBackground } from "../render/pixi-background.js";
import { resize } from "../canvas.js";
import { resizePixi } from "../pixi.js";
import { fmtKey } from "../utils/format.js";
import { on } from "../events.js";

import { clearEnemyTextureCaches } from "../render/pixi-entities.js";
import { clearShipTextureCaches, rebuildPlayerSprites } from "../render/pixi-player.js";

export let listeningFor: string | null = null;

export function initSettings() {
  Client.settings = loadSettings();
  Client.settingsOpen = false;
  setSfxVolume(Client.settings.sfxVolume);
  setMusicVolume(Client.settings.musicVolume);
}

export function openSettings() {
  if (Client.stationOpen) return;
  ensureSettingsUI();
  Client.settingsOpen = true;
  (document.getElementById("settings-overlay") as HTMLElement).style.display = "flex";
  renderSettings();
}

export function closeSettings() {
  Client.settingsOpen = false;
  listeningFor = null;
  const el = document.getElementById("settings-overlay");
  if (el) el.style.display = "none";
}

export function toggleSettings() {
  if (Client.settingsOpen) closeSettings();
  else openSettings();
}

function ensureSettingsUI() {
  if (document.getElementById("settings-overlay")) return;
  const el = document.createElement("div");
  el.id = "settings-overlay";
  el.innerHTML = `
    <div id="settings-panel" class="eve-window">
      <div class="eve-win-head">
        <div class="eve-win-title">SETTINGS</div>
        <div class="eve-win-sub">Configuration</div>
        <button id="settings-close" class="eve-win-btn">×</button>
      </div>
      <div class="eve-win-body">
        <div id="settings-body">
        <h3 class="accent-audio">Audio</h3>
        <div class="settings-row">
          <label>SFX Volume</label>
          <input type="range" id="sfx-volume" min="0" max="1" step="0.05" value="1">
          <span class="settings-tip-icon" data-tip-impact="NONE" data-tip-desc="Volume of all in-game sound effects: weapons, impacts, UI clicks.">ⓘ</span>
        </div>
        <div class="settings-row">
          <label>Music</label>
          <input type="range" id="music-volume" min="0" max="1" step="0.05" value="1">
          <span class="settings-tip-icon" data-tip-impact="NONE" data-tip-desc="Volume of background ambient music tracks.">ⓘ</span>
        </div>
        <h3 class="accent-video">Video</h3>
        <div class="settings-row">
          <label>Render Scale</label>
          <input type="range" id="render-scale" min="0.5" max="2.5" step="0.1" value="2.5">
          <span id="render-scale-val" class="settings-val">2.5x</span>
          <span class="settings-tip-icon" data-tip-impact="HIGH" data-tip-desc="Canvas resolution multiplier. 2.5× renders at 6× the pixel count of 1.0×. Lower values greatly improve performance on weaker hardware.">ⓘ</span>
        </div>
        <div class="settings-row">
          <label>Background</label>
          <div id="detail-buttons" style="display:flex;gap:6px;"></div>
          <span class="settings-tip-icon" data-tip-impact="MEDIUM" data-tip-desc="Controls star field density. High adds multiple parallax layers and more star detail.">ⓘ</span>
        </div>
        <div class="settings-row">
          <label>Nebulae</label>
          <div id="nebula-buttons" style="display:flex;gap:6px;"></div>
          <span class="settings-tip-icon" data-tip-impact="MEDIUM" data-tip-desc="Controls procedural nebula cloud density and variety. Off disables all nebulae. High generates dense, varied cloud formations with multiple parallax layers.">ⓘ</span>
        </div>
        <div class="settings-row settings-toggle-row">
          <label>Bloom</label>
          <input type="checkbox" id="bloom-toggle" class="toggle-switch" checked>
          <span class="settings-tip-icon" data-tip-impact="MEDIUM" data-tip-desc="Additive glow composited over bright objects. Requires an extra canvas blit and blur filter every frame.">ⓘ</span>
        </div>
        <div class="settings-row settings-toggle-row">
          <label>Vignette</label>
          <input type="checkbox" id="vignette-toggle" class="toggle-switch" checked>
          <span class="settings-tip-icon" data-tip-impact="LOW" data-tip-desc="Darkens screen edges for atmospheric depth. One radial gradient fillRect per frame.">ⓘ</span>
        </div>
        <div class="settings-row settings-toggle-row">
          <label>Directional Lighting</label>
          <input type="checkbox" id="dir-light-toggle" class="toggle-switch" checked>
          <span class="settings-tip-icon" data-tip-impact="LOW" data-tip-desc="Shadow gradient on each object based on its angle to the star. One extra gradient fill per visible entity per frame.">ⓘ</span>
        </div>
        <div class="settings-row settings-toggle-row">
          <label>Atmospheric Rim</label>
          <input type="checkbox" id="atm-rim-toggle" class="toggle-switch" checked>
          <span class="settings-tip-icon" data-tip-impact="LOW" data-tip-desc="Colored scattering halo on the dark limb of each planet. One annular gradient per planet per frame.">ⓘ</span>
        </div>
        <div class="settings-row settings-toggle-row">
          <label>Ambient Falloff</label>
          <input type="checkbox" id="amb-falloff-toggle" class="toggle-switch" checked>
          <span class="settings-tip-icon" data-tip-impact="LOW" data-tip-desc="Screen-space radial brightening near the star's position. Single fullscreen gradient blit per frame.">ⓘ</span>
        </div>
        <div class="settings-row settings-toggle-row">
          <label>Color Grading</label>
          <input type="checkbox" id="color-grade-toggle" class="toggle-switch" checked>
          <span class="settings-tip-icon" data-tip-impact="LOW" data-tip-desc="Per-system colour tint that shifts warm/cool based on star class. Applies a PixiJS ColorMatrixFilter.">ⓘ</span>
        </div>
        <div class="settings-row settings-toggle-row">
          <label>Lens Flare</label>
          <input type="checkbox" id="lens-flare-toggle" class="toggle-switch" checked>
          <span class="settings-tip-icon" data-tip-impact="LOW" data-tip-desc="Optical artifact rings and streak along the star-to-screen-center axis. About 8 small gradient fills per frame.">ⓘ</span>
        </div>
        <div class="settings-row settings-toggle-row">
          <label>Mipmapping</label>
          <input type="checkbox" id="mipmapping-toggle" class="toggle-switch" checked>
          <span class="settings-tip-icon" data-tip-impact="NONE" data-tip-desc="Smooths textures when zoomed out to prevent edge shimmering, at the cost of some sharpness.">ⓘ</span>
        </div>
        <div class="settings-row settings-toggle-row">
          <label>FPS Counter</label>
          <input type="checkbox" id="fps-counter-toggle" class="toggle-switch">
          <span class="settings-tip-icon" data-tip-impact="NONE" data-tip-desc="Shows a live frame-rate counter in the top-left corner. Color-coded green / yellow / red.">ⓘ</span>
        </div>
        <h3 class="accent-camera">Camera</h3>
        <div class="settings-row">
          <label>Smoothing</label>
          <input type="range" id="camera-smoothing" min="0.02" max="0.20" step="0.01" value="0.08">
          <span id="camera-smoothing-val" class="settings-val">0.08</span>
          <span class="settings-tip-icon" data-tip-impact="NONE" data-tip-desc="Lerp factor for camera follow. Lower = more lag and smoothness. Higher = snappier tracking. No rendering cost.">ⓘ</span>
        </div>
        <h3 class="accent-theme">HUD Theme</h3>
        <div id="theme-buttons" class="settings-row"></div>
        <h3 class="accent-controls">Controls</h3>
        <div id="keybind-list"></div>
        </div>
      </div>
      <div class="eve-win-foot" id="settings-footer">
        <button id="settings-exit" class="btn-exit">EXIT GAME</button>
        <button id="settings-reset">RESET TO DEFAULTS</button>
      </div>
    </div>`;
  document.body.appendChild(el);

  const bubble = document.createElement("div");
  bubble.id = "settings-tooltip-bubble";
  document.body.appendChild(bubble);
  const impactClass: Record<string, string> = { NONE: "tip-impact-none", LOW: "tip-impact-low", MEDIUM: "tip-impact-medium", HIGH: "tip-impact-high" };
  el.addEventListener("mouseover", (e) => {
    const icon = (e.target as HTMLElement).closest(".settings-tip-icon") as HTMLElement | null;
    if (!icon) return;
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
  el.addEventListener("mouseleave", () => { bubble.style.display = "none"; });

  on("ui:close-overlays", () => {
    el.style.display = "none";
    bubble.style.display = "none";
    Client.settingsOpen = false;
  });
  el.querySelector("#settings-close")!.addEventListener("click", () => { sfxBlip(); closeSettings(); });
  el.querySelector("#settings-reset")!.addEventListener("click", () => { sfxBlip(); resetSettings(); });
  el.querySelector("#settings-exit")!.addEventListener("click", () => {
    sfxBlip();
    if (confirm("Exit game and return to title? (Any unsaved progress will be lost)")) {
      window.location.reload(); 
    }
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
  el.querySelector("#bloom-toggle")!.addEventListener("change", (e) => {
    Client.settings.bloomEnabled = (e.target as HTMLInputElement).checked;
    saveSettings(Client.settings);
  });
  el.querySelector("#vignette-toggle")!.addEventListener("change", (e) => {
    Client.settings.vignetteEnabled = (e.target as HTMLInputElement).checked;
    saveSettings(Client.settings);
  });
  el.querySelector("#dir-light-toggle")!.addEventListener("change", (e) => {
    Client.settings.directionalLighting = (e.target as HTMLInputElement).checked;
    saveSettings(Client.settings);
  });
  el.querySelector("#atm-rim-toggle")!.addEventListener("change", (e) => {
    Client.settings.atmosphericRim = (e.target as HTMLInputElement).checked;
    saveSettings(Client.settings);
  });
  el.querySelector("#amb-falloff-toggle")!.addEventListener("change", (e) => {
    Client.settings.ambientFalloff = (e.target as HTMLInputElement).checked;
    saveSettings(Client.settings);
  });
  el.querySelector("#color-grade-toggle")!.addEventListener("change", (e) => {
    Client.settings.colorGrading = (e.target as HTMLInputElement).checked;
    saveSettings(Client.settings);
  });
  el.querySelector("#lens-flare-toggle")!.addEventListener("change", (e) => {
    Client.settings.lensFlare = (e.target as HTMLInputElement).checked;
    saveSettings(Client.settings);
  });
  el.querySelector("#mipmapping-toggle")!.addEventListener("change", (e) => {
    Client.settings.mipmapping = (e.target as HTMLInputElement).checked;
    saveSettings(Client.settings);
    clearShipTextureCaches();
    clearEnemyTextureCaches();
    rebuildPlayerSprites();
  });
  el.querySelector("#fps-counter-toggle")!.addEventListener("change", (e) => {
    Client.settings.fpsCounter = (e.target as HTMLInputElement).checked;
    saveSettings(Client.settings);
  });
  el.querySelector("#camera-smoothing")!.addEventListener("input", (e) => {
    const v = parseFloat((e.target as HTMLInputElement).value);
    Client.settings.cameraSmoothing = v;
    (document.getElementById("camera-smoothing-val") as HTMLElement).textContent = v.toFixed(2);
    saveSettings(Client.settings);
  });

  window.addEventListener("keydown", (e) => {
    if (!Client.settingsOpen || !listeningFor) return;
    e.preventDefault();
    if (e.code === "Escape") {
      listeningFor = null;
      renderSettings();
      return;
    }
    (Client.settings.keybinds as unknown as Record<string, string>)[listeningFor!] = e.code;
    saveSettings(Client.settings);
    listeningFor = null;
    renderSettings();
  });
}

function renderSettings() {
  const settings = Client.settings;

  const sfxSlider = document.getElementById("sfx-volume") as HTMLInputElement | null;
  if (sfxSlider) sfxSlider.value = String(settings.sfxVolume ?? 1.0);
  const musicSlider = document.getElementById("music-volume") as HTMLInputElement | null;
  if (musicSlider) musicSlider.value = String(settings.musicVolume ?? 1.0);

  const renderSlider = document.getElementById("render-scale") as HTMLInputElement | null;
  if (renderSlider) renderSlider.value = String(settings.renderScale ?? 2.5);
  const renderVal = document.getElementById("render-scale-val") as HTMLElement | null;
  if (renderVal) renderVal.textContent = (settings.renderScale ?? 2.5).toFixed(1) + "x";

  const bloomToggle = document.getElementById("bloom-toggle") as HTMLInputElement | null;
  if (bloomToggle) bloomToggle.checked = settings.bloomEnabled ?? true;
  const vignetteToggle = document.getElementById("vignette-toggle") as HTMLInputElement | null;
  if (vignetteToggle) vignetteToggle.checked = settings.vignetteEnabled ?? true;
  const dirLightToggle = document.getElementById("dir-light-toggle") as HTMLInputElement | null;
  if (dirLightToggle) dirLightToggle.checked = settings.directionalLighting ?? true;
  const atmRimToggle = document.getElementById("atm-rim-toggle") as HTMLInputElement | null;
  if (atmRimToggle) atmRimToggle.checked = settings.atmosphericRim ?? true;
  const ambFalloffToggle = document.getElementById("amb-falloff-toggle") as HTMLInputElement | null;
  if (ambFalloffToggle) ambFalloffToggle.checked = settings.ambientFalloff ?? true;
  const colorGradeToggle = document.getElementById("color-grade-toggle") as HTMLInputElement | null;
  if (colorGradeToggle) colorGradeToggle.checked = settings.colorGrading ?? true;
  const lensFlareToggle = document.getElementById("lens-flare-toggle") as HTMLInputElement | null;
  if (lensFlareToggle) lensFlareToggle.checked = settings.lensFlare ?? true;
  const mipmappingToggle = document.getElementById("mipmapping-toggle") as HTMLInputElement | null;
  if (mipmappingToggle) mipmappingToggle.checked = settings.mipmapping ?? true;
  const fpsCounterToggle = document.getElementById("fps-counter-toggle") as HTMLInputElement | null;
  if (fpsCounterToggle) fpsCounterToggle.checked = settings.fpsCounter ?? false;

  const camSlider = document.getElementById("camera-smoothing") as HTMLInputElement | null;
  if (camSlider) camSlider.value = String(settings.cameraSmoothing ?? 0.08);
  const camVal = document.getElementById("camera-smoothing-val") as HTMLElement | null;
  if (camVal) camVal.textContent = (settings.cameraSmoothing ?? 0.08).toFixed(2);

  const detailContainer = document.getElementById("detail-buttons") as HTMLElement;
  const detailOptions = [
    { id: "low", label: "Low" },
    { id: "medium", label: "Med" },
    { id: "high", label: "High" },
  ];
  detailContainer.innerHTML = detailOptions.map((opt) =>
    `<button class="detail-btn${settings.backgroundDetail === opt.id ? " active" : ""}" data-detail="${opt.id}">${opt.label}</button>`
  ).join("");
  detailContainer.querySelectorAll(".detail-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      sfxConfirm();
      settings.backgroundDetail = (btn as HTMLElement).dataset.detail!;
      initBackgroundStars(settings.backgroundDetail);
      saveSettings(settings);
      renderSettings();
    });
  });

  const nebulaContainer = document.getElementById("nebula-buttons") as HTMLElement;
  const nebulaOptions = [
    { id: "off", label: "Off" },
    { id: "low", label: "Low" },
    { id: "medium", label: "Med" },
    { id: "high", label: "High" },
  ];
  nebulaContainer.innerHTML = nebulaOptions.map((opt) =>
    `<button class="detail-btn${settings.nebulaDensity === opt.id ? " active" : ""}" data-nebula="${opt.id}">${opt.label}</button>`
  ).join("");
  nebulaContainer.querySelectorAll(".detail-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      sfxConfirm();
      settings.nebulaDensity = (btn as HTMLElement).dataset.nebula!;
      for (const sys of G.GALAXY) {
        if (sys) sys._nebulaBlobs = undefined;
      }
      refreshBackground();
      saveSettings(settings);
      renderSettings();
    });
  });

  const themeContainer = document.getElementById("theme-buttons") as HTMLElement;
  themeContainer.innerHTML = Object.entries(HUD_THEMES).map(([id, theme]) =>
    `<button class="theme-btn${settings.theme === id ? " active" : ""}" data-theme="${id}">${(theme as any).name}</button>`
  ).join("");
  themeContainer.querySelectorAll(".theme-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      sfxConfirm();
      settings.theme = (btn as HTMLElement).dataset.theme!;
      saveSettings(settings);
      renderSettings();
    });
  });

  const list = document.getElementById("keybind-list") as HTMLElement;
  list.innerHTML = Object.entries(KEYBIND_LABELS).map(([action, label]) => {
    const bound = settings.keybinds[action as keyof Keybinds] || DEFAULT_KEYBINDS[action as keyof Keybinds];
    const isListening = listeningFor === action;
    return `<div class="kb-row">
      <span class="kb-label">${label}</span>
      <button class="kb-key${isListening ? " listening" : ""}" data-action="${action}">
        ${isListening ? "Press key..." : fmtKey(bound)}
      </button>
    </div>`;
  }).join("");
  list.querySelectorAll(".kb-key").forEach((btn) => {
    btn.addEventListener("click", () => {
      sfxBlip();
      listeningFor = (btn as HTMLElement).dataset.action!;
      renderSettings();
    });
  });
}

function resetSettings() {
  const defs = DEFAULT_SETTINGS;
  Client.settings = { ...defs, keybinds: { ...defs.keybinds } };
  setSfxVolume(Client.settings.sfxVolume);
  setMusicVolume(Client.settings.musicVolume);
  initBackgroundStars(Client.settings.backgroundDetail);
  for (const sys of G.GALAXY) {
    if (sys) sys._nebulaBlobs = undefined;
  }
  resize();
  resizePixi();
  refreshBackground();
  saveSettings(Client.settings);
  listeningFor = null;
  renderSettings();
}
