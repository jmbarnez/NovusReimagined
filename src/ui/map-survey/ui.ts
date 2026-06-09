import { Client } from "../../state.js";
import { on } from "../../events.js";
import { ensurePanel, updatePanelControls, formatStatusLine } from "./scanner-panel.js";
import { updateMapTutorialStrip } from "./tutorial-strip.js";
import { getElement, setStyle, setText } from "../dom-helpers.js";

let mapTutorialListenersBound = false;

export function updateMapSurveyUi() {
  const show = Client.showMap && Client.showSystemMap;
  if (!show) {
    const panel = getElement("map-scanner-panel") as HTMLDivElement | null;
    if (panel) setStyle(panel, { display: "none" });
    updateMapTutorialStrip();
    return;
  }
  ensurePanel();
  const panel = getElement("map-scanner-panel") as HTMLDivElement | null;
  const status = panel?.querySelector(".map-scanner-status") as HTMLElement | null;
  if (!panel || !status) return;
  setStyle(panel, { display: "flex" });
  updatePanelControls();
  setText(status, formatStatusLine());
  updateMapTutorialStrip();
}

export function initMapSurvey() {
  // Styles loaded via map-overlay.css
  if (mapTutorialListenersBound) return;
  mapTutorialListenersBound = true;
  on("tutorial:step-change", () => updateMapTutorialStrip());
  on("tutorial:hangar-tour-change", () => updateMapTutorialStrip());
}
