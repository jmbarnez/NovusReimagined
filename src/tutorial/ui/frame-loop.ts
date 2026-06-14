import { getState } from "../../state-access.js";
import { tutorialState, TUTORIAL_OVERLAY_MIN_UPDATE_MS, TUTORIAL_CARD_POSITION_MIN_UPDATE_MS } from "./state.js";
import { shouldShowTutorialLayer, syncTutorialLayerBounds, positionCardForStep } from "./card.js";
import { updateReadyState, updateNavProgress, updateObjectiveText } from "./render.js";
import { syncTutorialVisuals, clearTutorialVisuals } from "./visuals.js";
import { clearHudDimmer } from "./spotlight.js";
import { getCurrentTutorialStep } from "../data/helpers.js";
import { getTutorialSnapshot, isCurrentStepComplete } from "../logic/index.js";
import { setStyle } from "../../ui/dom-helpers.js";

let _lastOverlayUpdateMs = 0;
let _lastCardPositionMs = 0;

export function updateTutorialOverlay(_Wc: number, _Hc: number, _now: number) {
  if (!tutorialState.visible || !getState().player?.tutorial?.active) {
    clearTutorialVisuals();
    clearHudDimmer();
    if (tutorialState.root) setStyle(tutorialState.root, { display: "none" });
    _lastOverlayUpdateMs = _now;
    return;
  }

  if (_now - _lastOverlayUpdateMs < TUTORIAL_OVERLAY_MIN_UPDATE_MS - 0.5) {
    return;
  }
  _lastOverlayUpdateMs = _now;

  syncTutorialLayerBounds();

  const show = shouldShowTutorialLayer();
  if (!show) {
    if (tutorialState.root) setStyle(tutorialState.root, { display: "none" });
    clearTutorialVisuals();
    return;
  }

  if (tutorialState.root) setStyle(tutorialState.root, { display: "block" });
  syncTutorialVisuals();

  const step = getCurrentTutorialStep(getState().player);
  const snapshot = getTutorialSnapshot();
  updateObjectiveText(step, snapshot);
  updateNavProgress(step);
  updateReadyState(step, isCurrentStepComplete());

  if (_now - _lastCardPositionMs >= TUTORIAL_CARD_POSITION_MIN_UPDATE_MS - 0.5) {
    _lastCardPositionMs = _now;
    positionCardForStep();
  }
}
