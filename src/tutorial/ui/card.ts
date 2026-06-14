import { getCurrentTutorialStep } from "../data/helpers.js";
import { getState } from "../../state-access.js";
import { Client } from "../../state.js";
import { viewportW, viewportH } from "../../render/viewport.js";
import { tutorialState } from "./state.js";
import { getCardAnchorHighlight } from "./spotlight.js";
import { getHudXpPopup } from "../../ui/hud-elements.js";
import { getBounds, setStyle, toggleClass } from "../../ui/dom-helpers.js";
import { isCurrentStepComplete } from "../logic/index.js";

export function positionCardForStep(): void {
  if (!tutorialState.root || !tutorialState.cardEl || !tutorialState.layerEl || tutorialState.cardEl.hidden) return;
  const step = getCurrentTutorialStep(getState().player);
  const layerRect = getBounds(tutorialState.layerEl);
  const target = step?.noCardAnchor ? null : getCardAnchorHighlight();
  const cardRect = getBounds(tutorialState.cardEl);
  const margin = 16;
  const safeW = Math.max(1, layerRect.width - cardRect.width - margin * 2);
  let x = margin + safeW / 2;
  let y = margin;

  if (target) {
    const rect = getBounds(target);
    const targetLeft = rect.left - layerRect.left;
    const targetRight = rect.right - layerRect.left;
    const targetTop = rect.top - layerRect.top;
    const targetBottom = rect.bottom - layerRect.top;
    const targetCenterX = targetLeft + rect.width / 2;
    const spaceAbove = targetTop - margin;
    const spaceBelow = layerRect.height - targetBottom - margin;
    const spaceLeft = targetLeft - margin;
    const spaceRight = layerRect.width - targetRight - margin;

    x = targetCenterX - cardRect.width / 2;
    if (spaceBelow >= cardRect.height || spaceBelow >= spaceAbove) {
      y = targetBottom + margin;
    } else {
      y = targetTop - cardRect.height - margin;
    }

    const overlapsTargetX = x < targetRight + margin && x + cardRect.width > targetLeft - margin;
    const overlapsTargetY = y < targetBottom + margin && y + cardRect.height > targetTop - margin;
    if (overlapsTargetX && overlapsTargetY) {
      if (spaceRight >= cardRect.width || spaceRight >= spaceLeft) {
        x = targetRight + margin;
      } else {
        x = targetLeft - cardRect.width - margin;
      }
    }
  }

  setStyle(tutorialState.root, {
    left: `${Math.max(margin, Math.min(x, layerRect.width - cardRect.width - margin))}px`,
    top: `${Math.max(margin, Math.min(y, layerRect.height - cardRect.height - margin))}px`,
    transform: "none",
  });
}

export function xpPopupObscuresTutorial(): boolean {
  const xp = getHudXpPopup();
  return !!(xp && (xp.classList.contains("visible") || xp.classList.contains("fading")));
}

export function shouldShowTutorialLayer(): boolean {
  if (Client.showMap) return false;
  if (tutorialState.showCompleteBannerActive) return true;
  if (!tutorialState.visible || !getState().player?.tutorial?.active) return false;
  if (xpPopupObscuresTutorial()) return false;
  const stepId = getCurrentTutorialStep(getState().player)?.id;
  const stationRelevantStep = stepId === "industry" || stepId === "hangar-high" || stepId === "hangar-turrets";
  if (Client.stationOpen && !stationRelevantStep && !isCurrentStepComplete()) return false;
  return true;
}

export function syncTutorialLayerBounds() {
  if (!tutorialState.layerEl) return;
  const show = shouldShowTutorialLayer();
  setStyle(tutorialState.layerEl, { display: show ? "block" : "none" });
  if (!show) return;
  toggleClass(tutorialState.layerEl, "tutorial-layer--over-station", Client.stationOpen);
  setStyle(tutorialState.layerEl, {
    left: "0px",
    top: "0px",
    width: `${viewportW()}px`,
    height: `${viewportH()}px`,
  });
}
