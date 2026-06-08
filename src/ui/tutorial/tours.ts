import { getCurrentTutorialStep } from "../../data/tutorial.js";
import { getTutorialSnapshot } from "../../tutorial/index.js";
import { getState } from "../../state-access.js";
import { Client } from "../../state.js";
import { syncHangarTutorialGuide, clearHangarTutorialGuide } from "./hangar-guide.js";
import { syncRefineryTutorialGuide, clearRefineryTutorialGuide } from "./refinery-guide.js";
import {
  getHangarTourPanel,
  getHudTourPanel,
  getRefineryTourPanel,
} from "../../data/tutorial.js";
import { tutorialState } from "./state.js";
import { isHangarGuidedStep } from "./highlights.js";

export function syncHangarGuideVisuals() {
  const step = getCurrentTutorialStep(getState().player);
  const snapshot = getTutorialSnapshot();
  if (isHangarGuidedStep(step) && Client.stationOpen && snapshot.hangarReviewComplete !== true) {
    syncHangarTutorialGuide(snapshot);
  } else {
    clearHangarTutorialGuide();
  }
}

export function syncRefineryGuideVisuals() {
  const step = getCurrentTutorialStep(getState().player);
  const snapshot = getTutorialSnapshot();
  if (step?.id === "industry" && Client.stationOpen) {
    syncRefineryTutorialGuide(snapshot);
  } else {
    clearRefineryTutorialGuide();
  }
}

export function syncTourCopy(step: NonNullable<ReturnType<typeof getCurrentTutorialStep>>) {
  const snapshot = getTutorialSnapshot();
  let tour = getHangarTourPanel(step, snapshot);
  if (step.id === "hud-tour") {
    tour = getHudTourPanel(step, snapshot);
  } else if (step.id === "industry") {
    tour = getRefineryTourPanel(step, snapshot);
  }
  if (tutorialState.tourLabelEl) {
    if (tour) {
      tutorialState.tourLabelEl.textContent = `${tour.label} (${tour.index}/${tour.total})`;
      tutorialState.tourLabelEl.style.display = "block";
    } else {
      tutorialState.tourLabelEl.textContent = "";
      tutorialState.tourLabelEl.style.display = "none";
    }
  }
  if (tutorialState.tourBodyEl) {
    if (tour && tour.body) {
      tutorialState.tourBodyEl.textContent = tour.body;
      tutorialState.tourBodyEl.style.display = "block";
    } else {
      tutorialState.tourBodyEl.textContent = "";
      tutorialState.tourBodyEl.style.display = "none";
    }
  }
}
