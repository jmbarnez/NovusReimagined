import { Client } from "../../state.js";
import { saveSettings, HUD_THEMES, FONT_OPTIONS, CONTROL_SECTIONS, DEFAULT_KEYBINDS, type Keybinds, type MovementControlMode, type VideoPreset } from "../../data/settings.js";
import { RETICLE_OPTIONS } from "../../data/reticles.js";
import { refreshTheme } from "../hud-overlay.js";
import { renderReticleStyle } from "../../render/reticle.js";
import { sfxBlip, sfxConfirm } from "../../audio/procedural.js";
import { initBackgroundStars } from "../../render/background.js";
import { refreshBackground } from "../../render/pixi-background.js";
import { fmtKey } from "../../utils/format.js";
import { t } from "../../utils/i18n.js";
import { listeningFor, setListeningFor } from "./state.js";
import { refreshEntityFonts } from "../../render/enemy/index.js";
import { refreshCelestialFonts } from "../../render/celestial/index.js";
import { refreshWorldLabelTextStyle } from "../../render/world-label-card.js";
import { refreshHudFonts } from "../../render/pixi-hud-core.js";
import { refreshChatBubbleFonts } from "../../render/pixi-chat-bubbles.js";
import { refreshStationOverlayFonts } from "../../render/pixi-station-overlays.js";
import { refreshEffectFonts } from "../../render/fx/index.js";
import { refreshTargetArrowFonts } from "../../render/pixi-target-arrows.js";
import { refreshTutorialGateFonts } from "../../render/pixi-tutorial-gates.js";
import { refreshWarpScreenFonts } from "../../render/pixi-warp-screen.js";
import { refreshEffectsOverlayFonts } from "../../render/pixi-effects-overlay.js";
import { getElement, setHtml, setText, onClick } from "../dom-helpers.js";

export function renderSettings() {
  const settings = Client.settings;
  if (!settings) return;

  const sfxSlider = getElement("sfx-volume") as HTMLInputElement | null;
  if (sfxSlider) sfxSlider.value = String(settings.sfxVolume ?? 1.0);
  const musicSlider = getElement("music-volume") as HTMLInputElement | null;
  if (musicSlider) musicSlider.value = String(settings.musicVolume ?? 1.0);

  const renderSlider = getElement("render-scale") as HTMLInputElement | null;
  if (renderSlider) renderSlider.value = String(settings.renderScale ?? 2.5);
  const renderVal = getElement("render-scale-val") as HTMLElement | null;
  if (renderVal) setText(renderVal, (settings.renderScale ?? 2.5).toFixed(1) + "x");
  const fpsSelect = getElement("fps-limit") as HTMLSelectElement | null;
  if (fpsSelect) fpsSelect.value = String(settings.fpsLimit ?? 0);

  const bloomSlider = getElement("bloom-intensity") as HTMLInputElement | null;
  if (bloomSlider) bloomSlider.value = String(settings.bloomIntensity ?? 1.0);
  const bloomVal = getElement("bloom-intensity-val") as HTMLElement | null;
  if (bloomVal) setText(bloomVal, (settings.bloomIntensity ?? 1.0).toFixed(1) + "x");

  const vignetteToggle = getElement("vignette-toggle") as HTMLInputElement | null;
  if (vignetteToggle) vignetteToggle.checked = settings.vignetteEnabled ?? true;
  const dirLightToggle = getElement("dir-light-toggle") as HTMLInputElement | null;
  if (dirLightToggle) dirLightToggle.checked = settings.directionalLighting ?? true;
  const atmRimToggle = getElement("atm-rim-toggle") as HTMLInputElement | null;
  if (atmRimToggle) atmRimToggle.checked = settings.atmosphericRim ?? true;
  const colorGradeToggle = getElement("color-grade-toggle") as HTMLInputElement | null;
  if (colorGradeToggle) colorGradeToggle.checked = settings.colorGrading ?? true;
  const mipmappingToggle = getElement("mipmapping-toggle") as HTMLInputElement | null;
  if (mipmappingToggle) mipmappingToggle.checked = settings.mipmapping ?? true;
  const lensFlareToggle = getElement("lens-flare-toggle") as HTMLInputElement | null;
  if (lensFlareToggle) lensFlareToggle.checked = settings.lensFlare ?? true;
  const antialiasToggle = getElement("antialias-toggle") as HTMLInputElement | null;
  if (antialiasToggle) antialiasToggle.checked = settings.antialias ?? false;

  const uiScaleSlider = getElement("ui-scale") as HTMLInputElement | null;
  if (uiScaleSlider) uiScaleSlider.value = String(settings.uiScale ?? 1.0);
  const uiScaleVal = getElement("ui-scale-val") as HTMLElement | null;
  if (uiScaleVal) setText(uiScaleVal, (settings.uiScale ?? 1.0).toFixed(2) + "x");

  const fontScaleSlider = getElement("font-scale") as HTMLInputElement | null;
  if (fontScaleSlider) fontScaleSlider.value = String(settings.fontScale ?? 1.0);
  const fontScaleVal = getElement("font-scale-val") as HTMLElement | null;
  if (fontScaleVal) setText(fontScaleVal, (settings.fontScale ?? 1.0).toFixed(2) + "x");

  const langSelect = getElement("settings-language") as HTMLSelectElement | null;
  if (langSelect) langSelect.value = settings.language;

  const movementModeButtons = getElement("movement-mode-buttons") as HTMLElement | null;
  if (movementModeButtons) {
    const modes: { id: MovementControlMode; label: string; desc: string; icon: string }[] = [
      { id: "waypoint", label: t("settings.movementMode.waypoint"), desc: t("settings.movementMode.waypointDesc"), icon: "MOUSE" },
      { id: "direct", label: t("settings.movementMode.direct"), desc: t("settings.movementMode.directDesc"), icon: "KEYS" },
    ];
    setHtml(movementModeButtons, modes
      .map((mode) => `
        <button class="movement-mode-card${settings.movementControlMode === mode.id ? " active" : ""}" data-movement-mode="${mode.id}">
          <span class="movement-mode-icon" aria-hidden="true">${mode.icon}</span>
          <span class="movement-mode-copy">
            <span class="movement-mode-title">${mode.label}</span>
            <span class="movement-mode-desc">${mode.desc}</span>
          </span>
        </button>
      `)
      .join(""));
    movementModeButtons.querySelectorAll("[data-movement-mode]").forEach((btn) => {
      onClick(btn, () => {
        sfxBlip();
        const mode = (btn as HTMLElement).dataset.movementMode as MovementControlMode;
        settings.movementControlMode = mode;
        Client.waypoint = null;
        Client.navCommand = null;
        Client.mouse.rmb = false;
        Client.keys["w"] = false;
        Client.keys["a"] = false;
        Client.keys["s"] = false;
        Client.keys["d"] = false;
        saveSettings(settings);
        renderSettings();
      });
    });
  }

  const detailContainer = getElement("detail-buttons") as HTMLElement | null;
  if (detailContainer) {
    const detailOptions = [
      { id: "low", label: t("settings.detail.low"), dots: 3 },
      { id: "medium", label: t("settings.detail.med"), dots: 6 },
      { id: "high", label: t("settings.detail.high"), dots: 9 },
    ];
    setHtml(detailContainer, detailOptions.map((opt) => {
      const dotsHtml = Array.from({ length: opt.dots }).map(() => "<i></i>").join("");
      return `<button class="detail-card${settings.backgroundDetail === opt.id ? " active" : ""}" data-detail="${opt.id}">
        <span class="detail-card-stars ${opt.id}">${dotsHtml}</span>
        <span class="detail-card-label">${opt.label}</span>
      </button>`;
    }).join(""));
    detailContainer.querySelectorAll(".detail-card").forEach((btn) => {
      onClick(btn, () => {
        sfxConfirm();
        settings.backgroundDetail = (btn as HTMLElement).dataset.detail!;
        initBackgroundStars(settings.backgroundDetail);
        refreshBackground();
        saveSettings(settings);
        renderSettings();
      });
    });
  }

  const themeContainer = getElement("theme-buttons") as HTMLElement | null;
  if (themeContainer) {
    setHtml(themeContainer, Object.entries(HUD_THEMES).map(([id, theme]) =>
      `<button class="theme-swatch${settings.theme === id ? " active" : ""}" data-theme="${id}"
         style="--sw-bg:${theme.bgPanel};--sw-border:${theme.borderAccent};--sw-text:${theme.textMain};--sw-accent:${theme.accent}">
         <span class="sw-dots"><i style="background:${theme.accent}"></i><i style="background:${theme.shield}"></i><i style="background:${theme.positive}"></i><i style="background:${theme.danger}"></i></span>
         <span class="sw-name">${theme.name}</span>
       </button>`
    ).join(""));
    themeContainer.querySelectorAll(".theme-swatch").forEach((btn) => {
      onClick(btn, () => {
        sfxConfirm();
        settings.theme = (btn as HTMLElement).dataset.theme!;
        saveSettings(settings);
        refreshTheme();
        renderSettings();
      });
    });
  }

  const fontContainer = getElement("font-buttons") as HTMLElement | null;
  if (fontContainer) {
    setHtml(fontContainer, FONT_OPTIONS.map((f) =>
      `<button class="detail-btn${settings.fontFamily === f.id ? " active" : ""}" data-font="${f.id}" style="font-family:${f.stack}">${f.label}</button>`
    ).join(""));
    fontContainer.querySelectorAll(".detail-btn").forEach((btn) => {
      onClick(btn, () => {
        sfxConfirm();
        settings.fontFamily = (btn as HTMLElement).dataset.font!;
        saveSettings(settings);
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
        renderSettings();
      });
    });
  }

  const reticleContainer = getElement("reticle-buttons") as HTMLElement | null;
  if (reticleContainer) {
    setHtml(reticleContainer, RETICLE_OPTIONS.map((r) =>
      `<button class="reticle-btn${settings.reticleStyle === r.id ? " active" : ""}" data-reticle="${r.id}">
        <canvas class="reticle-preview" width="32" height="32" data-reticle-id="${r.id}"></canvas>
        <span class="reticle-label">${r.label}</span>
      </button>`
    ).join(""));

    const themeColors = HUD_THEMES[settings.theme] || HUD_THEMES.default;

    reticleContainer.querySelectorAll(".reticle-preview").forEach((canvas) => {
      const ctx = (canvas as HTMLCanvasElement).getContext("2d");
      if (!ctx) return;
      const style = (canvas as HTMLElement).dataset.reticleId!;
      ctx.clearRect(0, 0, 32, 32);
      renderReticleStyle(ctx, style, 16, 16, 9, themeColors.textMain, 1.5);
    });

    reticleContainer.querySelectorAll(".reticle-btn").forEach((btn) => {
      onClick(btn, () => {
        sfxConfirm();
        settings.reticleStyle = (btn as HTMLElement).dataset.reticle!;
        saveSettings(settings);
        renderSettings();
      });
    });
  }

  const presetContainer = getElement("preset-buttons") as HTMLElement | null;
  if (presetContainer) {
    const presets: { id: string; label: string }[] = [
      { id: "performance", label: "Performance" },
      { id: "balanced", label: "Balanced" },
      { id: "cinematic", label: "Cinematic" },
      { id: "custom", label: "Custom" },
    ];
    setHtml(presetContainer, presets.map((p) =>
      `<button class="detail-btn${settings.videoPreset === p.id ? " active" : ""}" data-preset="${p.id}">${p.label}</button>`
    ).join(""));
    presetContainer.querySelectorAll(".detail-btn").forEach((btn) => {
      onClick(btn, () => {
        sfxConfirm();
        const preset = (btn as HTMLElement).dataset.preset! as VideoPreset;
        settings.videoPreset = preset;
        if (preset === "performance") {
          settings.renderScale = 1.5;
          settings.backgroundDetail = "low";
          settings.bloomIntensity = 0.5;
          settings.vignetteEnabled = false;
          settings.directionalLighting = false;
          settings.atmosphericRim = false;
          settings.colorGrading = false;
          settings.mipmapping = true;
          settings.lensFlare = false;
        } else if (preset === "balanced") {
          settings.renderScale = 2.2;
          settings.backgroundDetail = "high";
          settings.bloomIntensity = 1.0;
          settings.vignetteEnabled = true;
          settings.directionalLighting = true;
          settings.atmosphericRim = true;
          settings.colorGrading = true;
          settings.mipmapping = true;
          settings.lensFlare = true;
          settings.antialias = false;
        } else if (preset === "cinematic") {
          settings.renderScale = 2.5;
          settings.backgroundDetail = "high";
          settings.bloomIntensity = 1.5;
          settings.vignetteEnabled = true;
          settings.directionalLighting = true;
          settings.atmosphericRim = true;
          settings.colorGrading = true;
          settings.mipmapping = true;
          settings.lensFlare = true;
          settings.antialias = true;
        }
        saveSettings(settings);
        renderSettings();
      });
    });
  }

  const list = getElement("keybind-list") as HTMLElement | null;
  if (list) {
    setHtml(list, CONTROL_SECTIONS.map((section) => {
      const rows = section.actions.map(({ action, labelKey, descriptionKey }) => {
        const bound = settings.keybinds[action] || DEFAULT_KEYBINDS[action];
        const isListening = listeningFor === action;
        return `<div class="kb-row">
          <div class="kb-label-block">
            <span class="kb-label">${t(labelKey)}</span>
            ${descriptionKey ? `<span class="kb-desc">${t(descriptionKey)}</span>` : ""}
          </div>
          <button class="kb-key${isListening ? " listening" : ""}" data-action="${action}">
            ${isListening ? t("settings.pressKey") : fmtKey(bound)}
          </button>
        </div>`;
      }).join("");
      return `<section class="kb-section" data-section="${section.id}">
        <div class="kb-section-heading">
          <h4>${t(section.titleKey)}</h4>
          ${section.descriptionKey ? `<p>${t(section.descriptionKey)}</p>` : ""}
        </div>
        <div class="kb-section-body">${rows}</div>
      </section>`;
    }).join(""));
    list.querySelectorAll(".kb-key").forEach((btn) => {
      onClick(btn, () => {
        sfxBlip();
        setListeningFor((btn as HTMLElement).dataset.action!);
        renderSettings();
      });
    });
  }
}
