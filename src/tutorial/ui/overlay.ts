import { getState } from "../../state-access.js";
import { tutorialState, TUTORIAL_OVERLAY_MIN_UPDATE_MS, TUTORIAL_CARD_POSITION_MIN_UPDATE_MS } from "./state.js";
import { shouldShowTutorialLayer, syncTutorialLayerBounds, positionCardForStep } from "./card.js";
import { updateReadyState, updateNavProgress, updateObjectiveText } from "./render.js";
import { syncTutorialVisuals, clearTutorialVisuals } from "./visuals.js";
import { getHudTourDimmer } from "../../ui/hud-elements.js";
import { toggleClass, setStyle, remove } from "../../ui/dom-helpers.js";

export function hideTutorialOverlay() {
  tutorialState.visible = false;
  tutorialState.showCompleteBannerActive = false;
  clearTutorialVisuals();
  const dimmer = getHudTourDimmer();
  if (dimmer) {
    toggleClass(dimmer, "hidden", true);
    setStyle(dimmer, { display: "none" });
  }
  tutorialState._overlayHiddenCleaned = false;
  tutorialState._overlayInactiveCleaned = true;
  if (tutorialState.layerEl) setStyle(tutorialState.layerEl, { display: "none" });
  if (tutorialState.root) setStyle(tutorialState.root, { display: "none" });
}

export function showCompleteBanner() {
  tutorialState.visible = false;
  tutorialState.showCompleteBannerActive = true;
  syncTutorialVisuals();
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
  const dimmer = getHudTourDimmer();
  if (dimmer) remove(dimmer);
  if (tutorialState.root) remove(tutorialState.root);
  tutorialState.root = null;
  tutorialState.layerEl = null;
}

export function updateTutorialOverlay(_Wc: number, _Hc: number, _now: number) {
  if (!tutorialState.visible || !getState().player?.tutorial?.active) {
    if (tutorialState._overlayInactiveCleaned) return;
    clearTutorialVisuals();
    const dimmer = getHudTourDimmer();
    if (dimmer) {
      toggleClass(dimmer, "hidden", true);
      setStyle(dimmer, { display: "none" });
    }
    if (tutorialState.root) setStyle(tutorialState.root, { display: "none" });
    tutorialState._overlayInactiveCleaned = true;
    tutorialState._overlayHiddenCleaned = false;
    return;
  }
  tutorialState._overlayInactiveCleaned = false;
  if (_now - tutorialState._lastTutorialOverlayUpdateMs < TUTORIAL_OVERLAY_MIN_UPDATE_MS - 0.5) {
    return;
  }
  tutorialState._lastTutorialOverlayUpdateMs = _now;
  syncTutorialLayerBounds();
  const show = shouldShowTutorialLayer();
  if (!show) {
    if (!tutorialState._overlayHiddenCleaned) {
      if (tutorialState.root) setStyle(tutorialState.root, { display: "none" });
      clearTutorialVisuals();
      tutorialState._overlayHiddenCleaned = true;
    }
    return;
  }
  tutorialState._overlayHiddenCleaned = false;
  if (tutorialState.root) setStyle(tutorialState.root, { display: "block" });
  syncTutorialVisuals();
  updateObjectiveText();
  updateNavProgress();
  updateReadyState();
  if (_now - tutorialState._lastCardPositionUpdateMs >= TUTORIAL_CARD_POSITION_MIN_UPDATE_MS - 0.5) {
    tutorialState._lastCardPositionUpdateMs = _now;
    positionCardForStep();
  }
}
