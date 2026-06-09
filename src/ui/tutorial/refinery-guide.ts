import { Client } from "../../state.js";
import { getState } from "../../state-access.js";
import { getCurrentTutorialStep } from "../../data/tutorial.js";
import { getRefineryGuidePanel, type RefineryGuideTarget } from "../../data/refinery-tutorial-guide.js";
import { activateStationTab } from "../station/tabs.js";
import { stationState } from "../station/shared.js";
import {
  setActiveHighlight,
  syncStationDimmerCutout,
  resetStationDimmer,
} from "./tutorial-dimmer.js";

let _lastGuideKey = "";

function resolveGuideTarget(target: RefineryGuideTarget): HTMLElement | null {
  switch (target) {
    case "station-tab-industry":
      return document.querySelector('.st-tab[data-tab="industry"]');
    case "refinery-pipeline":
      return document.getElementById("refinery-pipeline");
    case "refinery-process-list":
      return document.getElementById("refinery-process-list");
    case "refinery-process-source":
      return document.getElementById("refinery-process-source");
    case "refinery-process-controls":
      return document.getElementById("refinery-process-controls");
    case "refinery-right-rail":
      return document.getElementById("refinery-right-rail");
    default:
      return null;
  }
}

function clearHighlights(): void {
  setActiveHighlight(null);
  _lastGuideKey = "";
  resetStationDimmer();
}

export function clearRefineryTutorialGuide(): void {
  clearHighlights();
}

export function syncRefineryTutorialGuide(snapshot: Record<string, unknown> = {}): void {
  if (!Client.stationOpen) {
    clearHighlights();
    return;
  }

  const step = getCurrentTutorialStep(getState().player);
  if (!step || step.id !== "industry") {
    clearHighlights();
    return;
  }
  if (snapshot.refineryGuideComplete === true) {
    clearHighlights();
    return;
  }

  const phase = typeof snapshot.refineryGuidePhase === "number" ? snapshot.refineryGuidePhase : 0;
  const panel = getRefineryGuidePanel(step.id, phase);
  if (!panel) {
    clearHighlights();
    return;
  }

  const panelActive = panel.stationTab ? !!document.getElementById(`panel-${panel.stationTab}`)?.classList.contains("active") : true;
  const guideKey = `${step.id}|${phase}|${panel.target}|${panel.stationTab ?? "none"}|${panelActive ? 1 : 0}`;
  if (_lastGuideKey === guideKey) return;
  _lastGuideKey = guideKey;

  stationState.indRailTab = "queue";

  document.getElementById("st-dimmer")?.classList.add("active");

  if (panel.stationTab && !document.getElementById(`panel-${panel.stationTab}`)?.classList.contains("active")) {
    activateStationTab(panel.stationTab);
  }

  const el = resolveGuideTarget(panel.target);
  if (!el) {
    setActiveHighlight(null);
    syncStationDimmerCutout(null);
    return;
  }

  const changedTarget = setActiveHighlight(el);
  syncStationDimmerCutout(el);
  if (changedTarget && typeof el.scrollIntoView === "function") {
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}
