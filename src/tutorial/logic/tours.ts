import { Client } from "../../state.js";
import { getState } from "../../state-access.js";
import { emit } from "../../events.js";
import { getCurrentTutorialStep } from "../data/helpers.js";
import { snapshot } from "./snapshot.js";

/** Resolved tour info for the current step, or null if no active tour. */
function resolveTour() {
  const step = getCurrentTutorialStep(getState().player);
  if (!step?.tour) return null;
  const phaseKey = step.tour.phaseKey;
  const phase = typeof snapshot[phaseKey] === "number" ? snapshot[phaseKey] as number : 0;
  const maxPhase = step.tour.phases.length - 1;
  return { step, phaseKey, phase, maxPhase, phases: step.tour.phases, completeKey: step.tour.completeKey };
}

function isDockedForTour(stepId: string): boolean {
  if (stepId !== "hangar-high" && stepId !== "hangar-turrets" && stepId !== "industry") return true;
  if (!Client.stationOpen) return false;
  if (stepId === "hangar-high" || stepId === "hangar-turrets") return snapshot.hangarReviewComplete !== true;
  return snapshot.refineryGuideComplete !== true;
}

export function canAdvanceTour(): boolean {
  const tour = resolveTour();
  if (!tour) return false;
  if (!isDockedForTour(tour.step.id)) return false;
  return tour.phase < tour.maxPhase;
}

export function advanceTour(): void {
  const tour = resolveTour();
  if (!tour || tour.phase >= tour.maxPhase) return;
  snapshot[tour.phaseKey] = tour.phase + 1;
  if (tour.completeKey) {
    snapshot[tour.completeKey] = tour.phase + 1 >= tour.maxPhase;
  }
  emit(tour.step.id === "industry" ? "tutorial:refinery-tour-change" : "tutorial:hangar-tour-change");
}

// Legacy aliases kept for backward compat; they delegate to the generic impl.
export function canAdvanceHangarTour(): boolean {
  const step = getCurrentTutorialStep(getState().player);
  if (!step || (step.id !== "hangar-high" && step.id !== "hangar-turrets")) return false;
  return canAdvanceTour();
}

export function advanceHangarTutorialPanel(): void {
  const step = getCurrentTutorialStep(getState().player);
  if (!step || (step.id !== "hangar-high" && step.id !== "hangar-turrets")) return;
  advanceTour();
}

export function canAdvanceRefineryTour(): boolean {
  const step = getCurrentTutorialStep(getState().player);
  if (!step || step.id !== "industry" || !step.tour) return false;
  return canAdvanceTour();
}

export function advanceRefineryTutorialPanel(): void {
  const step = getCurrentTutorialStep(getState().player);
  if (!step || step.id !== "industry") return;
  advanceTour();
}
