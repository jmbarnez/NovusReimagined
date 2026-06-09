import { getCurrentTutorialStep } from "../data/helpers.js";
import { getState } from "../../state-access.js";
import { Client } from "../../state.js";
import { tutorialState } from "./state.js";
import { getActiveTutorialHighlight } from "./highlights.js";
import { ensureDimmerSegments, syncDimmerCutout } from "./cutout.js";
import { getHudOverlay, getHudTourDimmer } from "../../ui/hud-elements.js";
import { createElement, append, getBounds, toggleClass, setStyle } from "../../ui/dom-helpers.js";

export function syncDimmerVisibility() {
  let dimmer = tutorialState._hudDimmerEl;
  if (!dimmer) {
    dimmer = getHudTourDimmer();
  }
  if (!dimmer) {
    const hudOverlay = getHudOverlay();
    if (hudOverlay) {
      dimmer = createElement("div", "hidden");
      dimmer.id = "hud-tour-dimmer";
      ensureDimmerSegments(dimmer);
      append(hudOverlay, dimmer);
      tutorialState._hudDimmerEl = dimmer;
    }
  } else {
    tutorialState._hudDimmerEl = dimmer;
  }

  const step = getCurrentTutorialStep(getState().player);
  const target = getActiveTutorialHighlight();
  const showDimmer = tutorialState.visible && getState().player?.tutorial?.active && target !== null && !Client.showMap && !step?.noDimmer;
  if (showDimmer) {
    if (dimmer) {
      if (tutorialState._hudDimmerHideTimer != null) {
        window.clearTimeout(tutorialState._hudDimmerHideTimer);
        tutorialState._hudDimmerHideTimer = null;
      }
      toggleClass(dimmer, "hidden", false);
      setStyle(dimmer, { display: "block" });
      const bounds = getBounds(dimmer);
      const cutoutKey = target ? `${target.id}|${target.className}|${bounds.width}|${bounds.height}` : "none";
      if (tutorialState._lastDimmerCutoutKey !== cutoutKey) {
        tutorialState._lastDimmerCutoutKey = cutoutKey;
        syncDimmerCutout(dimmer, target, bounds);
      }
      tutorialState._hudDimmerVisible = true;
    }
  } else {
    if (dimmer && tutorialState._hudDimmerVisible) {
      toggleClass(dimmer, "hidden", true);
      tutorialState._hudDimmerVisible = false;
      tutorialState._lastDimmerCutoutKey = "";
      tutorialState._hudDimmerHideTimer = window.setTimeout(() => {
        if (dimmer && dimmer.classList.contains("hidden")) {
          setStyle(dimmer, { display: "none" });
        }
        tutorialState._hudDimmerHideTimer = null;
      }, 250);
    }
  }
}
