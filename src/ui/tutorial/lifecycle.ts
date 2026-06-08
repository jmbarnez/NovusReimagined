import { getState } from "../../state-access.js";
import { clearHangarTutorialGuide } from "./hangar-guide.js";
import { clearRefineryTutorialGuide } from "./refinery-guide.js";
import { tutorialState, TUTORIAL_OVERLAY_MIN_UPDATE_MS, TUTORIAL_CARD_POSITION_MIN_UPDATE_MS } from "./state.js";
import { shouldShowTutorialLayer, syncTutorialLayerBounds, positionCardForStep } from "./card.js";
import { syncDimmerVisibility } from "./dimmer.js";
import { clearHudHighlight, syncHudHighlights } from "./highlights.js";
import { updateReadyState, updateNavProgress, updateObjectiveText } from "./render.js";
import { syncHangarGuideVisuals, syncRefineryGuideVisuals } from "./tours.js";

export function hideTutorialOverlay() {
  tutorialState.visible = false;
  tutorialState.showCompleteBannerActive = false;
  clearHangarTutorialGuide();
  clearRefineryTutorialGuide();
  clearHudHighlight();
  const dimmer = document.getElementById("hud-tour-dimmer");
  if (dimmer) {
    dimmer.classList.add("hidden");
    dimmer.style.display = "none";
  }
  tutorialState._hudDimmerVisible = false;
  tutorialState._lastDimmerCutoutKey = "";
  tutorialState._overlayHiddenCleaned = false;
  tutorialState._overlayInactiveCleaned = true;
  if (tutorialState.layerEl) tutorialState.layerEl.style.display = "none";
  if (tutorialState.root) tutorialState.root.style.display = "none";
}

export function showCompleteBanner() {
  tutorialState.visible = false;
  tutorialState.showCompleteBannerActive = true;
  syncHangarGuideVisuals();
  syncRefineryGuideVisuals();
  syncTutorialLayerBounds();
  if (tutorialState.root) {
    tutorialState.root.style.display = "block";
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
  clearHangarTutorialGuide();
  clearRefineryTutorialGuide();
  clearHudHighlight();
  document.getElementById("hud-tour-dimmer")?.remove();
  tutorialState.root?.remove();
  tutorialState.root = null;
  tutorialState.layerEl = null;
}

export function updateTutorialOverlay(_Wc: number, _Hc: number, _now: number) {
  if (!tutorialState.visible || !getState().player?.tutorial?.active) {
    if (tutorialState._overlayInactiveCleaned) return;
    clearHangarTutorialGuide();
    clearRefineryTutorialGuide();
    clearHudHighlight();
    const dimmer = document.getElementById("hud-tour-dimmer");
    if (dimmer) {
      dimmer.classList.add("hidden");
      dimmer.style.display = "none";
    }
    tutorialState._hudDimmerVisible = false;
    tutorialState._lastDimmerCutoutKey = "";
    if (tutorialState.root) tutorialState.root.style.display = "none";
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
      if (tutorialState.root) tutorialState.root.style.display = "none";
      clearHangarTutorialGuide();
      clearRefineryTutorialGuide();
      clearHudHighlight();
      tutorialState._overlayHiddenCleaned = true;
    }
    return;
  }
  tutorialState._overlayHiddenCleaned = false;
  if (tutorialState.root) tutorialState.root.style.display = "block";
  syncHangarGuideVisuals();
  syncRefineryGuideVisuals();
  updateObjectiveText();
  syncHudHighlights();
  syncDimmerVisibility();
  updateNavProgress();
  updateReadyState();
  if (_now - tutorialState._lastCardPositionUpdateMs >= TUTORIAL_CARD_POSITION_MIN_UPDATE_MS - 0.5) {
    tutorialState._lastCardPositionUpdateMs = _now;
    positionCardForStep();
  }
}
