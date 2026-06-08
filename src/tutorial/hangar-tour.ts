import { Client } from "../state.js";
import { emit } from "../events.js";
import { getState } from "../state-access.js";
import {
  getCurrentTutorialStep,
  HANGAR_COMBAT_SWAP_PHASE_COUNT,
  HANGAR_REVIEW_PHASE_COUNT,
  hasTutorialCombatLoadout,
} from "../data/tutorial.js";
import { snapshot } from "./shared.js";

function hangarTourPhaseKey(stepId: string): string {
  return stepId === "hangar-turrets" ? "hangarCombatPhase" : "hangarReviewPhase";
}

function hangarTourMaxPhase(stepId: string): number {
  return stepId === "hangar-turrets"
    ? HANGAR_COMBAT_SWAP_PHASE_COUNT - 1
    : HANGAR_REVIEW_PHASE_COUNT - 1;
}

export function beginHangarReviewTour(now: number): void {
  if (!snapshot.hangarTabActive) {
    snapshot.hangarTabActive = true;
    snapshot.hangarReviewPhase = 0;
    snapshot.hangarReviewPhaseAt = now;
  }
  snapshot.hangarReviewStarted = true;
}

export function markHangarStepComplete(requireCombatLoadout: boolean): void {
  if (!snapshot.hangarReviewStarted) return;
  if (requireCombatLoadout && !hasTutorialCombatLoadout(getState().player)) return;
  snapshot.hangarReviewComplete = true;
}

export function markHangarReviewComplete(): void {
  markHangarStepComplete(false);
}

export function canAdvanceHangarTour(): boolean {
  const step = getCurrentTutorialStep(getState().player);
  if (!step || (step.id !== "hangar-high" && step.id !== "hangar-turrets")) return false;
  if (!Client.stationOpen || snapshot.hangarReviewComplete === true) return false;
  const phaseKey = hangarTourPhaseKey(step.id);
  const phase = typeof snapshot[phaseKey] === "number" ? snapshot[phaseKey] as number : 0;
  return phase < hangarTourMaxPhase(step.id);
}

export function advanceHangarTutorialPanel(): void {
  const step = getCurrentTutorialStep(getState().player);
  if (!step || !canAdvanceHangarTour()) return;
  const phaseKey = hangarTourPhaseKey(step.id);
  const phase = typeof snapshot[phaseKey] === "number" ? snapshot[phaseKey] as number : 0;
  snapshot[phaseKey] = phase + 1;
  emit("tutorial:hangar-tour-change");
}
