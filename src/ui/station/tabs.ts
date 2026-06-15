import { Client } from "../../state.js";
import { emit } from "../../events.js";
import { getCurrentTutorialStep } from "../../data/tutorial.js";
import { getTutorialSnapshot } from "../../tutorial/index.js";
import { renderFabrication, renderIndustry } from "./industry.js";
import { stationState } from "./shared.js";
import { getElement, toggleClass } from "../dom-helpers.js";
import { getState } from "../../state-access.js";

export type StationTabId = "hangar" | "market" | "industry" | "fabrication" | "contracts";

function resolveStationOverlay(): HTMLElement | null {
  return getElement("station-overlay");
}

function resolveTabButton(root: HTMLElement, tab: StationTabId): HTMLButtonElement | null {
  return root.querySelector(`.st-tab[data-tab="${tab}"]`) as HTMLButtonElement | null;
}

function resolveTabPanel(root: HTMLElement, tab: StationTabId): HTMLElement | null {
  return root.querySelector(`#panel-${tab}`) as HTMLElement | null;
}

function isTabLockedByTutorial(tab: StationTabId): boolean {
  const step = getCurrentTutorialStep(getState().player);
  if (!step?.tour || !Client.stationOpen) return false;
  const snapshot = getTutorialSnapshot();
  const phase = typeof snapshot[step.tour.phaseKey] === "number" ? snapshot[step.tour.phaseKey] as number : 0;
  const panel = step.tour.phases[phase];
  if (!panel?.tab) return false;
  if (snapshot[step.tour.completeKey] === true) return false;
  return panel.tab !== tab;
}

export function activateStationTab(tab: StationTabId, root: HTMLElement | null = resolveStationOverlay()): boolean {
  if (!root || !Client.stationOpen) return false;
  if (isTabLockedByTutorial(tab)) return false;
  const button = resolveTabButton(root, tab);
  const panel = resolveTabPanel(root, tab);
  if (!button || button.disabled || !panel) return false;

  root.querySelectorAll(".st-tab").forEach((entry) => toggleClass(entry, "active", false));
  root.querySelectorAll(".panel").forEach((entry) => toggleClass(entry, "active", false));

  toggleClass(button, "active", true);
  toggleClass(panel, "active", true);
  stationState.activeTab = tab;

  if (tab === "industry") renderIndustry(panel);
  else if (tab === "fabrication") renderFabrication(panel);

  emit("tutorial:hangar-tour-change");
  return true;
}
