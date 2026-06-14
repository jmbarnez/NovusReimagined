import { Client } from "../../state.js";
import { getState } from "../../state-access.js";
import { emit } from "../../events.js";
import { getCurrentTutorialStep } from "../data/helpers.js";
import { snapshot } from "./snapshot.js";

function hangarTourPhaseKey(stepId: string): string {
  return stepId === "hangar-turrets" ? "hangarCombatPhase" : "hangarReviewPhase";
}

export function canAdvanceRefineryTour(): boolean {
  const step = getCurrentTutorialStep(getState().player);
  if (!step || step.id !== "industry" || !step.tour) return false;
  if (!Client.stationOpen || snapshot.refineryGuideComplete === true) return false;
  const phase = typeof snapshot.refineryGuidePhase === "number" ? snapshot.refineryGuidePhase : 0;
  return phase < step.tour.phases.length - 1;
}

export function advanceRefineryTutorialPanel(): void {
  const step = getCurrentTutorialStep(getState().player);
  if (!step || !canAdvanceRefineryTour()) return;
  const phase = typeof snapshot.refineryGuidePhase === "number" ? snapshot.refineryGuidePhase : 0;
  snapshot.refineryGuidePhase = phase + 1;
  emit("tutorial:refinery-tour-change");
}

export function canAdvanceTour(): boolean {
  const step = getCurrentTutorialStep(getState().player);
  if (!step?.tour) return false;

  if (step.id === "hangar-high" || step.id === "hangar-turrets") {
    if (!Client.stationOpen || snapshot.hangarReviewComplete === true) return false;
  }

  if (step.id === "industry") {
    if (!Client.stationOpen || snapshot.refineryGuideComplete === true) return false;
  }

  const phaseKey = step.tour.phaseKey;
  const phase = typeof snapshot[phaseKey] === "number" ? snapshot[phaseKey] as number : 0;
  return phase < step.tour.phases.length - 1;
}

export function advanceTour(): void {
  const step = getCurrentTutorialStep(getState().player);
  if (!step?.tour || !canAdvanceTour()) return;
  const phaseKey = step.tour.phaseKey;
  const phase = typeof snapshot[phaseKey] === "number" ? snapshot[phaseKey] as number : 0;
  snapshot[phaseKey] = phase + 1;
  if (step.tour.completeKey) {
    snapshot[step.tour.completeKey] = phase + 1 >= step.tour.phases.length;
  }
  if (step.id === "industry") emit("tutorial:refinery-tour-change");
  else emit("tutorial:hangar-tour-change");
}

export function canAdvanceHangarTour(): boolean {
  const step = getCurrentTutorialStep(getState().player);
  if (!step || (step.id !== "hangar-high" && step.id !== "hangar-turrets")) return false;
  if (!Client.stationOpen || snapshot.hangarReviewComplete === true) return false;
  const phaseKey = hangarTourPhaseKey(step.id);
  const phase = typeof snapshot[phaseKey] === "number" ? snapshot[phaseKey] as number : 0;
  const maxPhase = step.tour ? step.tour.phases.length - 1 : 0;
  return phase < maxPhase;
}

export function advanceHangarTutorialPanel(): void {
  const step = getCurrentTutorialStep(getState().player);
  if (!step || !canAdvanceHangarTour()) return;
  const phaseKey = hangarTourPhaseKey(step.id);
  const phase = typeof snapshot[phaseKey] === "number" ? snapshot[phaseKey] as number : 0;
  snapshot[phaseKey] = phase + 1;
  emit("tutorial:hangar-tour-change");
}
