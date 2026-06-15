import { getState } from "../../state-access.js";
import { hasCombatLoadout } from "../data/bypass.js";
import { getSnapshot, patchSnapshot } from "./snapshot.js";

export function beginHangarReviewTour(now: number): void {
  const snapshot = getSnapshot();
  if (!snapshot.hangarTabActive) {
    patchSnapshot({
      hangarTabActive: true,
      hangarReviewPhase: 0,
      hangarReviewPhaseAt: now,
    });
  }
  patchSnapshot({ hangarReviewStarted: true });
}

export function markHangarStepComplete(requireCombatLoadout: boolean): void {
  const snapshot = getSnapshot();
  if (!snapshot.hangarReviewStarted) return;
  if (requireCombatLoadout && !hasCombatLoadout(getState().player)) return;
  patchSnapshot({ hangarReviewComplete: true });
}

export function markHangarReviewComplete(): void {
  markHangarStepComplete(false);
}
