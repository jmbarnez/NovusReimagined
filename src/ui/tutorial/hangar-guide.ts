import { Client } from "../../state.js";
import { getState } from "../../state-access.js";
import { getCurrentTutorialStep, isStationHangarTabActive } from "../../data/tutorial.js";
import { getHangarGuidePanel, type HangarGuideTarget } from "../../data/hangar-tutorial-guide.js";
import { activateStationTab } from "../station/tabs.js";
import {
  setActiveHighlight,
  syncStationDimmerCutout,
  resetStationDimmer,
} from "./tutorial-dimmer.js";

let _lastGuideKey = "";

function currentHangarPhase(stepId: string, snapshot: Record<string, unknown>): number {
  const key = stepId === "hangar-turrets" ? "hangarCombatPhase" : "hangarReviewPhase";
  return typeof snapshot[key] === "number" ? snapshot[key] as number : 0;
}

function resolveGuideTarget(target: HangarGuideTarget): HTMLElement | null {
  switch (target) {
    case "station-tab-hangar":
      return document.querySelector('.st-tab[data-tab="hangar"]');
    case "hangar-fitting":
      return document.getElementById("hangar-fitting-panel");
    case "hangar-stats":
      return document.getElementById("hangar-stats-panel");
    case "hangar-cargo":
      return document.getElementById("hangar-pane-cargo");
    case "hud-missions":
      if (Client.stationOpen) return document.getElementById("hangar-missions-panel");
      return document.getElementById("hud-missions");
    case "hangar-undock":
      return document.getElementById("st-undock");
    case "hangar-slot-high-0":
      return document.querySelector('[data-rack="high"][data-idx="0"]');
    case "hangar-slot-high-1":
      return document.querySelector('[data-rack="high"][data-idx="1"]');
    default:
      return null;
  }
}

function clearHighlights(): void {
  setActiveHighlight(null);
  _lastGuideKey = "";
  resetStationDimmer();
}

export function clearHangarTutorialGuide(): void {
  clearHighlights();
}

export function syncHangarTutorialGuide(snapshot: Record<string, unknown> = {}): void {
  if (!Client.stationOpen) {
    clearHighlights();
    return;
  }

  const step = getCurrentTutorialStep(getState().player);
  if (!step || (step.id !== "hangar-high" && step.id !== "hangar-turrets")) {
    clearHighlights();
    return;
  }

  if (snapshot.hangarReviewComplete === true) {
    clearHighlights();
    return;
  }

  const phase = currentHangarPhase(step.id, snapshot);
  const panel = getHangarGuidePanel(step.id, phase);
  if (!panel) {
    clearHighlights();
    return;
  }

  const guideKey = `${step.id}|${phase}|${panel.target}|${panel.stationTab ?? "none"}|${Client.stationOpen ? 1 : 0}|${isStationHangarTabActive() ? 1 : 0}`;
  if (_lastGuideKey === guideKey) return;
  _lastGuideKey = guideKey;

  document.getElementById("st-dimmer")?.classList.add("active");

  if (panel.stationTab && !isStationHangarTabActive()) {
    activateStationTab(panel.stationTab);
  }

  if (!isStationHangarTabActive()) {
    const tabEl = resolveGuideTarget("station-tab-hangar");
    setActiveHighlight(tabEl);
    syncStationDimmerCutout(tabEl as HTMLElement | null);
    return;
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
