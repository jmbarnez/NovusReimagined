import { getCurrentTutorialStep } from "../../data/tutorial.js";
import { getTutorialSnapshot } from "../../tutorial/index.js";
import { getState } from "../../state-access.js";
import { Client } from "../../state.js";
import { tutorialState } from "./state.js";
import { activateStationTab, type StationTabId } from "../station/tabs.js";
import { stationState } from "../station/shared.js";
import { syncDimmerVisibility } from "./dimmer.js";
import {
  setActiveHighlight,
  syncStationDimmerCutout,
  resetStationDimmer,
} from "./tutorial-dimmer.js";
import { setHudHighlight, clearHudHighlight } from "./highlights.js";
import { getElement, query, setStyle, toggleClass } from "../dom-helpers.js";

function resolveTarget(selector: string): HTMLElement | null {
  return query(selector);
}

function isTabActive(tab: string): boolean {
  return getElement(`panel-${tab}`)?.classList.contains("active") ?? false;
}

function getTourPhase(step: { tour?: { phaseKey: string; phases: unknown[] } }, snapshot: Record<string, unknown>): number {
  if (!step.tour) return 0;
  const phase = typeof snapshot[step.tour.phaseKey] === "number" ? snapshot[step.tour.phaseKey] as number : 0;
  return Math.max(0, Math.min(phase, step.tour.phases.length - 1));
}

function isTourComplete(step: { tour?: { completeKey: string } }, snapshot: Record<string, unknown>): boolean {
  if (!step.tour) return false;
  return snapshot[step.tour.completeKey] === true;
}

function syncStationVisuals(target: HTMLElement | null): void {
  if (target) {
    const stDimmer = getElement("st-dimmer");
    if (stDimmer) toggleClass(stDimmer, "active", true);
    setActiveHighlight(target);
    syncStationDimmerCutout(target);
  } else {
    setActiveHighlight(null);
    resetStationDimmer();
  }
}

function syncHudVisuals(target: HTMLElement | null): void {
  setHudHighlight(target);
  syncDimmerVisibility();
}

export function syncTutorialVisuals(overrideSnapshot?: Record<string, unknown>): void {
  if (!tutorialState.visible || !getState().player?.tutorial?.active) {
    clearTutorialVisuals();
    return;
  }

  const step = getCurrentTutorialStep(getState().player);
  if (!step) {
    clearTutorialVisuals();
    return;
  }

  const snapshot = overrideSnapshot ?? getTutorialSnapshot();

  if (step.id === "industry" && Client.stationOpen) {
    stationState.indRailTab = "queue";
  }

  let target: HTMLElement | null = null;
  let selector = "";
  let tab: string | undefined;
  let isStation = false;
  let phase = 0;

  if (step.tour && !isTourComplete(step, snapshot)) {
    phase = getTourPhase(step, snapshot);
    const panel = step.tour.phases[phase];
    if (panel) {
      selector = panel.target;
      tab = panel.tab;
      target = resolveTarget(selector);
      isStation = Client.stationOpen && !!tab;
      if (isStation && tab && !isTabActive(tab)) {
        activateStationTab(tab as StationTabId);
      }
    }
  } else if (step.highlight) {
    selector = step.highlight;
    target = resolveTarget(selector);
    isStation = Client.stationOpen && !!getElement("station-overlay")?.contains(target);
  }

  if (isStation) {
    syncStationVisuals(target);
    clearHudHighlight();
    const hudDimmer = tutorialState._hudDimmerEl;
    if (hudDimmer) {
      toggleClass(hudDimmer, "hidden", true);
      setStyle(hudDimmer, { display: "none" });
    }
    tutorialState._hudDimmerVisible = false;
    tutorialState._lastDimmerCutoutKey = "";
  } else {
    syncHudVisuals(target);
    resetStationDimmer();
  }

  if (target && typeof target.scrollIntoView === "function") {
    target.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}

export function clearTutorialVisuals(): void {
  setActiveHighlight(null);
  resetStationDimmer();
  clearHudHighlight();
  const hudDimmer = tutorialState._hudDimmerEl;
  if (hudDimmer) {
    toggleClass(hudDimmer, "hidden", true);
    setStyle(hudDimmer, { display: "none" });
  }
  tutorialState._hudDimmerVisible = false;
  tutorialState._lastDimmerCutoutKey = "";
}
