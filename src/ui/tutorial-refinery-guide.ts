import { Client } from "../state.js";
import { getState } from "../state-access.js";
import { getCurrentTutorialStep } from "../data/tutorial.js";
import { getRefineryGuidePanel, type RefineryGuideTarget } from "../data/refinery-tutorial-guide.js";
import { activateStationTab } from "./station/tabs.js";
import { stationState } from "./station/shared.js";

const HIGHLIGHT_CLASS = "tutorial-hangar-highlight";

function ensureDimmerSegments(dimmer: HTMLElement): HTMLElement[] {
  const existing = Array.from(dimmer.querySelectorAll<HTMLElement>(".tutorial-dimmer-segment"));
  if (existing.length === 4) return existing;
  dimmer.innerHTML = "";
  const segments: HTMLElement[] = [];
  for (let i = 0; i < 4; i++) {
    const segment = document.createElement("div");
    segment.className = "tutorial-dimmer-segment";
    dimmer.appendChild(segment);
    segments.push(segment);
  }
  return segments;
}

function resetDimmerSegments(dimmer: HTMLElement): void {
  for (const segment of ensureDimmerSegments(dimmer)) {
    segment.removeAttribute("style");
  }
}

function syncStationDimmerCutout(target: HTMLElement | null): void {
  const dimmer = document.getElementById("st-dimmer");
  if (!dimmer) return;
  const segments = ensureDimmerSegments(dimmer);
  const stationRect = dimmer.getBoundingClientRect();
  if (!target) {
    segments[0].style.cssText = "left:0;top:0;width:100%;height:100%;";
    for (let i = 1; i < segments.length; i++) segments[i].style.cssText = "display:none;";
    return;
  }

  const pad = 8;
  const rect = target.getBoundingClientRect();
  const left = Math.max(0, rect.left - stationRect.left - pad);
  const top = Math.max(0, rect.top - stationRect.top - pad);
  const right = Math.min(stationRect.width, rect.right - stationRect.left + pad);
  const bottom = Math.min(stationRect.height, rect.bottom - stationRect.top + pad);

  segments[0].style.cssText = `display:block;left:0;top:0;width:100%;height:${top}px;`;
  segments[1].style.cssText = `display:block;left:0;top:${bottom}px;width:100%;height:${Math.max(0, stationRect.height - bottom)}px;`;
  segments[2].style.cssText = `display:block;left:0;top:${top}px;width:${left}px;height:${Math.max(0, bottom - top)}px;`;
  segments[3].style.cssText = `display:block;left:${right}px;top:${top}px;width:${Math.max(0, stationRect.width - right)}px;height:${Math.max(0, bottom - top)}px;`;
}

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
  document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((el) => {
    el.classList.remove(HIGHLIGHT_CLASS);
  });
  const dimmer = document.getElementById("st-dimmer");
  if (!dimmer) return;
  dimmer.classList.remove("active");
  resetDimmerSegments(dimmer);
}

export function clearRefineryTutorialGuide(): void {
  clearHighlights();
}

export function syncRefineryTutorialGuide(snapshot: Record<string, unknown> = {}): void {
  clearHighlights();
  if (!Client.stationOpen) return;

  const step = getCurrentTutorialStep(getState().player);
  if (!step || step.id !== "industry") return;
  if (snapshot.refineryGuideComplete === true) return;

  const phase = typeof snapshot.refineryGuidePhase === "number" ? snapshot.refineryGuidePhase : 0;
  const panel = getRefineryGuidePanel(step.id, phase);
  if (!panel) return;

  stationState.indRailTab = "queue";

  document.getElementById("st-dimmer")?.classList.add("active");

  if (panel.stationTab && !document.getElementById(`panel-${panel.stationTab}`)?.classList.contains("active")) {
    activateStationTab(panel.stationTab);
  }

  const el = resolveGuideTarget(panel.target);
  if (!el) return;

  el.classList.add(HIGHLIGHT_CLASS);
  syncStationDimmerCutout(el);
  if (typeof el.scrollIntoView === "function") {
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}
