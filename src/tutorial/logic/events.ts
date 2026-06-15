import { Client } from "../../state.js";
import { emit, on } from "../../events.js";
import { getState } from "../../state-access.js";
import { getCurrentTutorialStep, isStationHangarTabActive } from "../data/helpers.js";
import { getSnapshot, isTutorialEventsBound, patchSnapshot, setTutorialEventsBound } from "./snapshot.js";
import { nowSec } from "./context.js";
import { beginHangarReviewTour, markHangarStepComplete } from "./hangar.js";
import { clearTutorialVisuals } from "../ui/visuals.js";

export function bindTutorialEvents(): void {
  if (isTutorialEventsBound()) return;
  setTutorialEventsBound(true);
  on("station:open", () => {
    const step = getCurrentTutorialStep(getState().player);
    const stepId = step?.id;
    if (!step?.stationTourGroup) return;
    requestAnimationFrame(() => {
      const now = nowSec();
      if (step.stationTourGroup === "industry") {
        patchSnapshot({ refineryGuideStarted: true });
        return;
      }
      if (!Client.stationOpen || !isStationHangarTabActive()) return;
      const snapshot = getSnapshot();
      if (stepId === "hangar-turrets") {
        if (!snapshot.hangarTabActive) {
          patchSnapshot({
            hangarTabActive: true,
            hangarCombatPhase: 0,
            hangarCombatPhaseAt: now,
          });
        }
      } else {
        beginHangarReviewTour(now);
      }
      patchSnapshot({ hangarReviewStarted: true });
      emit("tutorial:hangar-tour-change");
    });
  });
  on("station:close", () => {
    const step = getCurrentTutorialStep(getState().player);
    const stepId = step?.id;
    if (!step?.stationTourGroup) return;
    if (step.stationTourGroup === "industry") {
      patchSnapshot({ industryTabActive: false });
      return;
    }
    patchSnapshot({ hangarTabActive: false });
    markHangarStepComplete(stepId === "hangar-turrets");
    clearTutorialVisuals();
  });
}
