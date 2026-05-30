import { Client } from "../state.js";
import { getState } from "../state-access.js";
import { getCurrentTutorialStep, isStationHangarTabActive } from "../data/tutorial.js";
import { getHangarGuidePanel, type HangarGuideTarget } from "../data/hangar-tutorial-guide.js";

const HIGHLIGHT_CLASS = "tutorial-hangar-highlight";
const DIM_CLASS = "station-hangar-tour-dim";

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
      return document.getElementById("hangar-cargo-section");
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
  document.getElementById("st-ui")?.classList.remove(DIM_CLASS);
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

  document.getElementById("st-ui")?.classList.add(DIM_CLASS);

  if (panel.stationTab) activateStationTab(panel.stationTab);

  if (!isStationHangarTabActive()) {
    const tabEl = resolveGuideTarget("station-tab-hangar");
    tabEl?.classList.add(HIGHLIGHT_CLASS);
    return;
  }

  const el = resolveGuideTarget(panel.target);
  if (!el) return;

  el.classList.add(HIGHLIGHT_CLASS);
  el.scrollIntoView({ block: "nearest", behavior: "smooth" });
}
