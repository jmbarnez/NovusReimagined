import { getCurrentTutorialStep } from "../../data/tutorial.js";
import { getTutorialSnapshot } from "../../tutorial/index.js";
import { getState } from "../../state-access.js";
import { Client } from "../../state.js";
import { tutorialState } from "./state.js";
import { activateStationTab, type StationTabId } from "../station/tabs.js";
import { stationState } from "../station/shared.js";
import {
  setActiveHighlight,
  syncStationDimmerCutout,
  resetStationDimmer,
} from "./tutorial-dimmer.js";
import { setHudHighlight, clearHudHighlight } from "./highlights.js";
import { syncDimmerVisibility } from "./dimmer.js";

let _lastCacheKey = "";

function resolveTarget(selector: string): HTMLElement | null {
  if (selector === "#hud-missions" && Client.stationOpen) {
    return document.getElementById("hangar-missions-panel");
  }
  return document.querySelector<HTMLElement>(selector);
}

function isTabActive(tab: string): boolean {
  return document.getElementById(`panel-${tab}`)?.classList.contains("active") ?? false;
}

function buildCacheKey(stepId: string, phase: number, selector: string, tab: string | undefined): string {
  return `${stepId}|${phase}|${selector}|${tab ?? "none"}|${Client.stationOpen ? 1 : 0}|${isTabActive(tab ?? "") ? 1 : 0}`;
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
    document.getElementById("st-dimmer")?.classList.add("active");
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

  // Side effect: ensure industry rail tab is set for refinery tutorial
  if (step.id === "industry" && Client.stationOpen) {
    stationState.indRailTab = "queue";
  }

  // Determine target and context
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

      if (Client.stationOpen) {
        isStation = true;
        if (tab && !isTabActive(tab)) {
          activateStationTab(tab as StationTabId);
        }
        target = resolveTarget(selector);
      } else {
        // Not in station: fallback to step.highlight
        selector = step.highlight ?? "";
        target = selector ? resolveTarget(selector) : null;
      }
    }
  } else if (step.highlight) {
    selector = step.highlight;
    target = resolveTarget(selector);
    isStation = Client.stationOpen && !!document.getElementById("station-overlay")?.contains(target);
  }

  const cacheKey = buildCacheKey(step.id, phase, selector, tab);
  if (_lastCacheKey === cacheKey) return;
  _lastCacheKey = cacheKey;

  if (isStation || (Client.stationOpen && step.tour)) {
    syncStationVisuals(target);
    clearHudHighlight();
    // Ensure HUD dimmer is hidden when station visuals are active
    const hudDimmer = tutorialState._hudDimmerEl;
    if (hudDimmer) {
      hudDimmer.classList.add("hidden");
      hudDimmer.style.display = "none";
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
  if (_lastCacheKey === "") return;
  _lastCacheKey = "";
  setActiveHighlight(null);
  resetStationDimmer();
  clearHudHighlight();
  const hudDimmer = tutorialState._hudDimmerEl;
  if (hudDimmer) {
    hudDimmer.classList.add("hidden");
    hudDimmer.style.display = "none";
  }
  tutorialState._hudDimmerVisible = false;
  tutorialState._lastDimmerCutoutKey = "";
}
