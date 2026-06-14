import { tutorialState } from "./state.js";
import { clearTutorialVisuals } from "./visuals.js";
import { syncTutorialLayerBounds } from "./card.js";
import { remove, setStyle } from "../../ui/dom-helpers.js";

export function hideTutorialOverlay() {
  tutorialState.visible = false;
  tutorialState.showCompleteBannerActive = false;
  clearTutorialVisuals();
  if (tutorialState.layerEl) setStyle(tutorialState.layerEl, { display: "none" });
  if (tutorialState.root) setStyle(tutorialState.root, { display: "none" });
}

export function showCompleteBanner() {
  tutorialState.visible = false;
  tutorialState.showCompleteBannerActive = true;
  clearTutorialVisuals();
  syncTutorialLayerBounds();
  if (tutorialState.root) {
    setStyle(tutorialState.root, { display: "block" });
    if (tutorialState.cardEl) tutorialState.cardEl.hidden = true;
    if (tutorialState.confirmEl) tutorialState.confirmEl.hidden = true;
  }
  if (tutorialState.completeEl) {
    tutorialState.completeEl.hidden = false;
    setTimeout(() => {
      if (tutorialState.completeEl) tutorialState.completeEl.hidden = true;
      hideTutorialOverlay();
    }, 3500);
  }
}

export function destroyTutorialOverlay() {
  clearTutorialVisuals();
  if (tutorialState.root) remove(tutorialState.root);
  tutorialState.root = null;
  tutorialState.layerEl = null;
}
