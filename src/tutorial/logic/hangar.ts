import { getState } from "../../state-access.js";
import { hasCombatLoadout } from "../data/bypass.js";
import { snapshot } from "./snapshot.js";

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
  if (requireCombatLoadout && !hasCombatLoadout(getState().player)) return;
  snapshot.hangarReviewComplete = true;
}

export function markHangarReviewComplete(): void {
  markHangarStepComplete(false);
}
