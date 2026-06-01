import { Client } from "../state.js";
import { getState } from "../state-access.js";
import { getCurrentTutorialStep, isStationHangarTabActive } from "../data/tutorial.js";
import { getHangarGuidePanel, type HangarGuideTarget } from "../data/hangar-tutorial-guide.js";

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
      return document.getElementById("hud-missions");
    case "hangar-undock":
      return document.getElementById("st-undock");
    case "hangar-slot-high-0":
      return document.querySelector('[data-tutorial-slot="high-0"]');
    case "hangar-slot-high-1":
      return document.querySelector('[data-tutorial-slot="high-1"]');
    default:
      return null;
  }
}

function activateStationTab(tab: "hangar" | "contracts" | "market" | "industry"): void {
  const btn = document.querySelector(`.st-tab[data-tab="${tab}"]:not([disabled])`) as HTMLButtonElement | null;
  if (!btn) return;
  if (!btn.classList.contains("active")) btn.click();
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

export function clearHangarTutorialGuide(): void {
  clearHighlights();
}

export function syncHangarTutorialGuide(snapshot: Record<string, unknown> = {}): void {
  clearHighlights();
  if (!Client.stationOpen) return;

  const step = getCurrentTutorialStep(getState().player);
  if (!step || (step.id !== "hangar-high" && step.id !== "hangar-turrets")) return;

  if (snapshot.hangarReviewComplete === true) return;

  const phase = currentHangarPhase(step.id, snapshot);
  const panel = getHangarGuidePanel(step.id, phase);
  if (!panel) return;

  document.getElementById("st-dimmer")?.classList.add("active");

  if (panel.stationTab) activateStationTab(panel.stationTab);

  if (!isStationHangarTabActive()) {
    const tabEl = resolveGuideTarget("station-tab-hangar");
    tabEl?.classList.add(HIGHLIGHT_CLASS);
    syncStationDimmerCutout(tabEl);
    return;
  }

  const el = resolveGuideTarget(panel.target);
  if (!el) return;

  el.classList.add(HIGHLIGHT_CLASS);
  syncStationDimmerCutout(el);
  if (typeof el.scrollIntoView === "function") {
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}
