import { Client } from "../../state.js";
import { getState } from "../../state-access.js";
import { getCurrentTutorialStep, getTutorialNavProgress, getTutorialNavRemainingM, getTutorialStepObjective } from "../../data/tutorial.js";
import { getElement, createElement, setHtml, setText, setStyle, append } from "../dom-helpers.js";

let mapTutorialStripEl: HTMLDivElement | null = null;

export function ensureMapTutorialStrip() {
  if (mapTutorialStripEl) return;
  mapTutorialStripEl = createElement("div") as HTMLDivElement;
  mapTutorialStripEl.id = "map-tutorial-strip";
  setHtml(mapTutorialStripEl, `
    <div class="map-tutorial-strip-title"></div>
    <div class="map-tutorial-strip-objective"></div>
    <div class="tutorial-nav-progress">
      <div class="tutorial-nav-progress-track"><div class="tutorial-nav-progress-fill"></div></div>
      <span class="tutorial-nav-progress-label"></span>
    </div>
  `);
  append(getElement("hud-overlay") || document.body, mapTutorialStripEl);
}

export function updateMapTutorialStrip() {
  const show = Client.showMap && Client.showSystemMap && getState().player?.tutorial?.active;
  if (!show) {
    if (mapTutorialStripEl) setStyle(mapTutorialStripEl, { display: "none" });
    return;
  }
  const step = getCurrentTutorialStep(getState().player);
  if (!step?.nav) {
    if (mapTutorialStripEl) setStyle(mapTutorialStripEl, { display: "none" });
    return;
  }
  ensureMapTutorialStrip();
  if (!mapTutorialStripEl) return;
  setStyle(mapTutorialStripEl, { display: "block" });
  const titleEl = mapTutorialStripEl.querySelector(".map-tutorial-strip-title") as HTMLElement | null;
  const objEl = mapTutorialStripEl.querySelector(".map-tutorial-strip-objective") as HTMLElement | null;
  const fillEl = mapTutorialStripEl.querySelector(".tutorial-nav-progress-fill") as HTMLElement | null;
  const labelEl = mapTutorialStripEl.querySelector(".tutorial-nav-progress-label") as HTMLElement | null;
  if (titleEl) setText(titleEl, step.title);
  if (objEl) setHtml(objEl, getTutorialStepObjective(step));
  const progress = getTutorialNavProgress(step, getState().player) ?? 0;
  const remaining = getTutorialNavRemainingM(step, getState().player);
  if (fillEl) setStyle(fillEl, { width: `${Math.round(progress * 100)}%` });
  if (labelEl) {
    setText(labelEl, remaining != null
      ? `${(remaining / 1000).toFixed(1)} km to ${step.nav.label}`
      : "");
  }
}
