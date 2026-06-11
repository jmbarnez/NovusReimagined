import { Client } from "../../state.js";
import { getCurrentTutorialStep, getTourPanel } from "../../data/tutorial.js";
import { getTutorialSnapshot } from "../../tutorial/index.js";
import { tutorialState } from "./state.js";
import { setText, setStyle } from "../dom-helpers.js";

export function syncTourCopy(step: NonNullable<ReturnType<typeof getCurrentTutorialStep>>) {
  const snapshot = getTutorialSnapshot();
  // Station tours only show while docked and incomplete
  const tourComplete = step.tour?.completeKey ? snapshot[step.tour.completeKey] === true : false;
  if (step.tour && (!Client.stationOpen || tourComplete)) {
    if (tutorialState.tourLabelEl) {
      setText(tutorialState.tourLabelEl, "");
      setStyle(tutorialState.tourLabelEl, { display: "none" });
    }
    if (tutorialState.tourBodyEl) {
      setText(tutorialState.tourBodyEl, "");
      setStyle(tutorialState.tourBodyEl, { display: "none" });
    }
    return;
  }
  const tour = getTourPanel(step, snapshot);
  if (tutorialState.tourLabelEl) {
    if (tour) {
      setText(tutorialState.tourLabelEl, `${tour.label} (${tour.index}/${tour.total})`);
      setStyle(tutorialState.tourLabelEl, { display: "block" });
    } else {
      setText(tutorialState.tourLabelEl, "");
      setStyle(tutorialState.tourLabelEl, { display: "none" });
    }
  }
  if (tutorialState.tourBodyEl) {
    if (tour && tour.body) {
      setText(tutorialState.tourBodyEl, tour.body);
      setStyle(tutorialState.tourBodyEl, { display: "block" });
    } else {
      setText(tutorialState.tourBodyEl, "");
      setStyle(tutorialState.tourBodyEl, { display: "none" });
    }
  }
}
