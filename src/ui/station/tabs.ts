import { Client } from "../../state.js";
import { emit } from "../../events.js";
import { renderFabrication, renderIndustry } from "./industry.js";
import { stationState } from "./shared.js";

export type StationTabId = "hangar" | "market" | "industry" | "fabrication" | "contracts";

function resolveStationOverlay(): HTMLElement | null {
  return document.getElementById("station-overlay");
}

function resolveTabButton(root: HTMLElement, tab: StationTabId): HTMLButtonElement | null {
  return root.querySelector(`.st-tab[data-tab="${tab}"]`) as HTMLButtonElement | null;
}

function resolveTabPanel(root: HTMLElement, tab: StationTabId): HTMLElement | null {
  return root.querySelector(`#panel-${tab}`) as HTMLElement | null;
}

export function activateStationTab(tab: StationTabId, root: HTMLElement | null = resolveStationOverlay()): boolean {
  if (!root || !Client.stationOpen) return false;
  const button = resolveTabButton(root, tab);
  const panel = resolveTabPanel(root, tab);
  if (!button || button.disabled || !panel) return false;

  root.querySelectorAll(".st-tab").forEach((entry) => entry.classList.remove("active"));
  root.querySelectorAll(".panel").forEach((entry) => entry.classList.remove("active"));

  button.classList.add("active");
  panel.classList.add("active");
  stationState.activeTab = tab;

  if (tab === "industry") renderIndustry(panel);
  else if (tab === "fabrication") renderFabrication(panel);

  emit("tutorial:hangar-tour-change");
  return true;
}
