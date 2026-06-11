import { Client } from "../../state.js";
import { emit, on } from "../../events.js";
import { getState } from "../../state-access.js";
import { getCurrentTutorialStep, isStationHangarTabActive } from "../data/helpers.js";
import { snapshot, setTutorialEventsBound, tutorialEventsBound } from "./snapshot.js";
import { nowSec } from "./context.js";
import { beginHangarReviewTour, markHangarStepComplete } from "./hangar.js";
import { clearTutorialVisuals } from "../ui/visuals.js";

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
    markHangarStepComplete(stepId === "hangar-turrets");
    clearTutorialVisuals();
  });
}
