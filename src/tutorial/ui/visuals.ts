import { getCurrentTutorialStep } from "../data/helpers.js";
import { getTutorialSnapshot, isCurrentStepComplete } from "../logic/index.js";
import { getState } from "../../state-access.js";
import { Client } from "../../state.js";
import { tutorialState } from "./state.js";
import { activateStationTab, type StationTabId } from "../../ui/station/tabs.js";
import { stationState } from "../../ui/station/shared.js";
import {
  setActiveHighlight,
  syncStationDimmerCutout,
  resetStationDimmer,
  setHudHighlight,
  clearHudHighlight,
  syncHudDimmerVisibility,
  clearHudDimmer,
} from "./spotlight.js";
import { getElement, query } from "../../ui/dom-helpers.js";

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
    if (stDimmer) stDimmer.classList.add("active");
    setActiveHighlight(target);
    syncStationDimmerCutout(target);
  } else {
    setActiveHighlight(null);
    resetStationDimmer();
  }
}

function syncHudVisuals(target: HTMLElement | null, showDimmer: boolean): void {
  setHudHighlight(target);
  syncHudDimmerVisibility(target, showDimmer);
}

export function syncTutorialVisuals(overrideSnapshot?: Record<string, unknown>): void {
  const player = getState().player;
  if (!tutorialState.visible || !player?.tutorial?.active) {
    clearTutorialVisuals();
    return;
  }

  const step = getCurrentTutorialStep(player);
  if (!step) {
    clearTutorialVisuals();
    return;
  }

  // Once a step is complete, keep the card but remove spotlight dimmers/highlights
  // so players can move freely (e.g. after undocking from hangar tour).
  if (isCurrentStepComplete()) {
    clearTutorialVisuals();
    return;
  }

  const snapshot = overrideSnapshot ?? getTutorialSnapshot();

  if (step.id === "industry" && Client.stationOpen && stationState.indRailTab !== "queue") {
    stationState.indRailTab = "queue";
  }

  let target: HTMLElement | null = null;
  let tab: string | undefined;
  let isStation = false;

  if (step.tour && !isTourComplete(step, snapshot)) {
    const phase = getTourPhase(step, snapshot);
    const panel = step.tour.phases[phase];
    if (panel) {
      tab = panel.tab;
      target = resolveTarget(panel.target);
      isStation = Client.stationOpen && !!tab;
      if (isStation && tab && !isTabActive(tab)) {
        activateStationTab(tab as StationTabId);
      }
    }
  } else if (step.highlight) {
    target = resolveTarget(step.highlight);
    isStation = Client.stationOpen && !!getElement("station-overlay")?.contains(target);
  }

  const showDimmer = target !== null && !step.noDimmer;

  if (isStation) {
    syncStationVisuals(target);
    clearHudHighlight();
    clearHudDimmer();
  } else {
    syncHudVisuals(target, showDimmer);
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
  clearHudDimmer();
}
