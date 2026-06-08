import { Client } from "../../state.js";
import { getState } from "../../state-access.js";
import { getCurrentTutorialStep, getTutorialNavProgress, getTutorialNavRemainingM, getTutorialStepObjective } from "../../data/tutorial.js";

let mapTutorialStripEl: HTMLDivElement | null = null;

export function ensureMapTutorialStrip() {
  if (mapTutorialStripEl) return;
  mapTutorialStripEl = document.createElement("div");
  mapTutorialStripEl.id = "map-tutorial-strip";
  mapTutorialStripEl.innerHTML = `
    <div class="map-tutorial-strip-title"></div>
    <div class="map-tutorial-strip-objective"></div>
    <div class="tutorial-nav-progress">
      <div class="tutorial-nav-progress-track"><div class="tutorial-nav-progress-fill"></div></div>
      <span class="tutorial-nav-progress-label"></span>
    </div>
  `;
  (document.getElementById("hud-overlay") || document.body).appendChild(mapTutorialStripEl);
}

export function updateMapTutorialStrip() {
  const show = Client.showMap && Client.showSystemMap && getState().player?.tutorial?.active;
  if (!show) {
    if (mapTutorialStripEl) mapTutorialStripEl.style.display = "none";
    return;
  }
  const step = getCurrentTutorialStep(getState().player);
  if (!step?.nav) {
    if (mapTutorialStripEl) mapTutorialStripEl.style.display = "none";
    return;
  }
  ensureMapTutorialStrip();
  if (!mapTutorialStripEl) return;
  mapTutorialStripEl.style.display = "block";
  const titleEl = mapTutorialStripEl.querySelector(".map-tutorial-strip-title");
  const objEl = mapTutorialStripEl.querySelector(".map-tutorial-strip-objective");
  const fillEl = mapTutorialStripEl.querySelector(".tutorial-nav-progress-fill") as HTMLElement | null;
  const labelEl = mapTutorialStripEl.querySelector(".tutorial-nav-progress-label");
  if (titleEl) titleEl.textContent = step.title;
  if (objEl) objEl.innerHTML = getTutorialStepObjective(step);
  const progress = getTutorialNavProgress(step, getState().player) ?? 0;
  const remaining = getTutorialNavRemainingM(step, getState().player);
  if (fillEl) fillEl.style.width = `${Math.round(progress * 100)}%`;
  if (labelEl) {
    labelEl.textContent = remaining != null
      ? `${(remaining / 1000).toFixed(1)} km to ${step.nav.label}`
      : "";
  }
}
