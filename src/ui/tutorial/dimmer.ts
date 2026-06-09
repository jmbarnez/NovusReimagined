import { getCurrentTutorialStep } from "../../data/tutorial.js";
import { getState } from "../../state-access.js";
import { Client } from "../../state.js";
import { tutorialState } from "./state.js";
import { getActiveTutorialHighlight } from "./highlights.js";
import { ensureDimmerSegments, syncDimmerCutout } from "./tutorial-dimmer.js";

export function syncDimmerVisibility() {
  let dimmer = tutorialState._hudDimmerEl;
  if (!dimmer) {
    dimmer = document.getElementById("hud-tour-dimmer");
  }
  if (!dimmer) {
    const hudOverlay = document.getElementById("hud-overlay");
    if (hudOverlay) {
      dimmer = document.createElement("div");
      dimmer.id = "hud-tour-dimmer";
      dimmer.className = "hidden";
      ensureDimmerSegments(dimmer);
      hudOverlay.appendChild(dimmer);
      tutorialState._hudDimmerEl = dimmer;
    }
  } else {
    tutorialState._hudDimmerEl = dimmer;
  }

  const step = getCurrentTutorialStep(getState().player);
  const target = getActiveTutorialHighlight();
  const showDimmer = tutorialState.visible && getState().player?.tutorial?.active && target !== null && !Client.showMap;
  if (showDimmer) {
    if (dimmer) {
      if (tutorialState._hudDimmerHideTimer != null) {
        window.clearTimeout(tutorialState._hudDimmerHideTimer);
        tutorialState._hudDimmerHideTimer = null;
      }
      dimmer.classList.remove("hidden");
      dimmer.style.display = "block";
      const cutoutKey = target ? `${target.id}|${target.className}` : "none";
      if (tutorialState._lastDimmerCutoutKey !== cutoutKey) {
        tutorialState._lastDimmerCutoutKey = cutoutKey;
        syncDimmerCutout(dimmer, target, dimmer.getBoundingClientRect());
      }
      tutorialState._hudDimmerVisible = true;
    }
  } else {
    if (dimmer && tutorialState._hudDimmerVisible) {
      dimmer.classList.add("hidden");
      tutorialState._hudDimmerVisible = false;
      tutorialState._lastDimmerCutoutKey = "";
      tutorialState._hudDimmerHideTimer = window.setTimeout(() => {
        if (dimmer && dimmer.classList.contains("hidden")) {
          dimmer.style.display = "none";
        }
        tutorialState._hudDimmerHideTimer = null;
      }, 250);
    }
  }
}
