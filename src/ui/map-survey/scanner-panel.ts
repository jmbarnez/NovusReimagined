import { getState } from "../../state-access.js";
import { Client } from "../../state.js";
import { C } from "../../config/index.js";
import { sfxBlip } from "../../audio/procedural.js";
import { queueFrameAction } from "../../sim/input.js";
import { logEvent } from "../../feedback.js";
import { t } from "../../utils/i18n.js";
import {
  getScanPulseRemainingMs,
  getActiveScannerIndex,
  getMapScannerDrainPerSec,
  getEffectiveSignatureRadius,
  mapScannerStrengthStepIndex,
  isMapScannerEmitting,
} from "../../scanning/index.js";
import { getElement, createElement, setHtml, setText, append, onInput, onClick } from "../dom-helpers.js";

const CONE_PRESETS = [180, 90, 45, 15] as const;

let panelEl: HTMLDivElement | null = null;
let statusEl: HTMLElement | null = null;
let strengthInput: HTMLInputElement | null = null;

function toggleScannerPower(): void {
  const next = !getState().player.mapScannerActive;
  if (next && getActiveScannerIndex(getState().player) === -1) {
    logEvent(t("map.survey.powerOn"), "system");
    return;
  }
  queueFrameAction({ type: "setMapScannerPower", payload: { active: next } }, { replaceByType: true });
  sfxBlip(next ? 720 : 480, 0.03);
}

export function ensurePanel() {
  if (panelEl) return;
  const steps = C.SCANNING.MAP_STRENGTH_STEPS;
  panelEl = createElement("div") as HTMLDivElement;
  panelEl.id = "map-scanner-panel";
  setHtml(panelEl, `
    <div class="map-scanner-row">
      <button type="button" data-action="power" class="map-scanner-power" title="${t("map.survey.power")}">${t("map.survey.power")}</button>
      <div class="map-scanner-dial">
        <span class="map-scanner-dial-label">${t("map.survey.strength")}</span>
        <input type="range" class="map-scanner-strength" min="0" max="${steps - 1}" step="1" value="2" />
      </div>
      <div class="map-survey-cones"></div>
      <button type="button" data-action="scan" class="map-survey-scan">${t("map.survey.scan")}</button>
    </div>
    <div class="map-scanner-status">${t("map.survey.off")}</div>
  `);
  append(getElement("hud-overlay") || document.body, panelEl);
  statusEl = panelEl.querySelector(".map-scanner-status");
  strengthInput = panelEl.querySelector(".map-scanner-strength");

  const coneWrap = panelEl.querySelector(".map-survey-cones")!;
  for (const deg of CONE_PRESETS) {
    const btn = createElement("button");
    (btn as HTMLButtonElement).type = "button";
    btn.dataset.cone = String(deg);
    setText(btn, `${deg}°`);
    append(coneWrap, btn);
  }

  if (strengthInput) onInput(strengthInput, () => {
    const step = Number(strengthInput!.value);
    const prev = mapScannerStrengthStepIndex(getState().player);
    const stepsDenom = Math.max(1, C.SCANNING.MAP_STRENGTH_STEPS - 1);
    const strength = Math.max(0, Math.min(1, step / stepsDenom));
    queueFrameAction({ type: "setMapScannerStrength", payload: { strength } }, { replaceByType: true });
    if (step !== prev) sfxBlip(640 + step * 120, 0.02);
  });

  onClick(panelEl, (ev) => {
    const target = (ev.target as HTMLElement).closest("button");
    if (!target || !panelEl) return;
    if (target.dataset.action === "power") {
      toggleScannerPower();
      return;
    }
    const cone = target.dataset.cone;
    if (cone) {
      queueFrameAction({
        type: "setMapScannerCone",
        payload: { coneDeg: Number(cone) as 180 | 90 | 45 | 15 },
      }, { replaceByType: true });
      return;
    }
    if (target.dataset.action === "scan") {
      queueFrameAction({
        type: "startScanPulse",
        payload: { angleDeg: Client.mapScannerAngleDeg },
      }, { replaceByType: true });
    }
  });
}

export function updatePanelControls() {
  if (!panelEl) return;
  panelEl.querySelectorAll("[data-cone]").forEach((btn) => {
    const el = btn as HTMLButtonElement;
    el.classList.toggle("active", Number(el.dataset.cone) === getState().player.scannerConeDeg);
  });
  const powerBtn = panelEl.querySelector(".map-scanner-power");
  powerBtn?.classList.toggle("active", getState().player.mapScannerActive);
  const scanBtn = panelEl.querySelector(".map-survey-scan") as HTMLButtonElement | null;
  const remaining = getScanPulseRemainingMs(Date.now(), getState().player);
  const powered = getState().player.mapScannerActive;
  if (scanBtn) scanBtn.disabled = remaining > 0 || !powered;
  if (strengthInput) {
    strengthInput.disabled = !powered;
    strengthInput.value = String(mapScannerStrengthStepIndex(getState().player));
  }
}

export function formatStatusLine(): string {
  const remaining = getScanPulseRemainingMs(Date.now(), getState().player);
  if (remaining > 0) {
    return `Scanning · ${Math.ceil(remaining / 1000)}s · ${getState().player.scannerConeDeg}°`;
  }
  if (!getState().player.mapScannerActive) {
    return `Off · hover aim · left-click waypoint · right-drag pan · ${getState().player.scannerConeDeg}°`;
  }
  const drain = getMapScannerDrainPerSec(getState().player).toFixed(1);
  const sig = getEffectiveSignatureRadius(getState().player);
  return `Live · ${drain}/s cap · sig ${sig}m · ${getState().player.scannerConeDeg}°`;
}
