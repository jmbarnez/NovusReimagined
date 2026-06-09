import { Client } from "../state.js";
import { emit, on } from "../events.js";
import { getState } from "../state-access.js";
import { getCurrentTutorialStep, isStationHangarTabActive } from "../data/tutorial.js";
import { clearTutorialVisuals } from "../ui/tutorial/visuals.js";
import {
  beginHangarReviewTour,
  markHangarStepComplete,
} from "./hangar-tour.js";
import {
  nowSec,
  snapshot,
  setTutorialEventsBound,
  tutorialEventsBound,
} from "./shared.js";

export function bindTutorialEvents(): void {
  if (tutorialEventsBound) return;
  setTutorialEventsBound(true);
  on("station:open", () => {
    const stepId = getCurrentTutorialStep(getState().player)?.id;
    if (stepId !== "hangar-high" && stepId !== "hangar-turrets" && stepId !== "industry") return;
    requestAnimationFrame(() => {
      const now = nowSec();
      if (stepId === "industry") {
        snapshot.refineryGuideStarted = true;
        return;
      }
      if (!Client.stationOpen || !isStationHangarTabActive()) return;
      if (stepId === "hangar-turrets") {
        if (!snapshot.hangarTabActive) {
          snapshot.hangarTabActive = true;
          snapshot.hangarCombatPhase = 0;
          snapshot.hangarCombatPhaseAt = now;
        }
      } else {
        beginHangarReviewTour(now);
      }
      snapshot.hangarReviewStarted = true;
      emit("tutorial:hangar-tour-change");
    });
  });
  on("station:close", () => {
    const stepId = getCurrentTutorialStep(getState().player)?.id;
    if (stepId !== "hangar-high" && stepId !== "hangar-turrets" && stepId !== "industry") return;
    if (stepId === "industry") {
      snapshot.industryTabActive = false;
      return;
    }
    snapshot.hangarTabActive = false;
    clearTutorialVisuals();
    markHangarStepComplete(stepId === "hangar-turrets");
  });
}
