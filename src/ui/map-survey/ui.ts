import { Client } from "../../state.js";
import { on } from "../../events.js";
import { ensurePanel, updatePanelControls, formatStatusLine } from "./scanner-panel.js";
import { updateMapTutorialStrip } from "./tutorial-strip.js";

let mapTutorialListenersBound = false;

export function updateMapSurveyUi() {
  const show = Client.showMap && Client.showSystemMap;
  if (!show) {
    const panel = document.getElementById("map-scanner-panel") as HTMLDivElement | null;
    if (panel) panel.style.display = "none";
    updateMapTutorialStrip();
    return;
  }
  ensurePanel();
  const panel = document.getElementById("map-scanner-panel") as HTMLDivElement | null;
  const status = panel?.querySelector(".map-scanner-status") as HTMLElement | null;
  if (!panel || !status) return;
  panel.style.display = "flex";
  updatePanelControls();
  status.textContent = formatStatusLine();
  updateMapTutorialStrip();
}

export function initMapSurvey() {
  // Styles loaded via map-overlay.css
  if (mapTutorialListenersBound) return;
  mapTutorialListenersBound = true;
  on("tutorial:step-change", () => updateMapTutorialStrip());
  on("tutorial:hangar-tour-change", () => updateMapTutorialStrip());
}
