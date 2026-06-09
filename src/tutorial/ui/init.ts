import { bringToFront } from "../../ui/hud/windows.js";
import { on } from "../../events.js";
import {
  skipTutorial,
  advanceStep,
  advanceTour,
} from "../logic/index.js";
import { t } from "../../utils/i18n.js";
import { tutorialState } from "./state.js";
import { renderStep } from "./render.js";
import { hideTutorialOverlay, showCompleteBanner } from "./overlay.js";
import { getElement, onClick, onKeydown } from "../../ui/dom-helpers.js";
import { buildTutorialDom } from "./dom.js";

export function initTutorialOverlay(active: boolean) {
  tutorialState.visible = active;
  if (!tutorialState.layerEl) {
    buildTutorialDom();
    if (!tutorialState.root) return;

    onClick(tutorialState.root, () => {
      if (tutorialState.layerEl) bringToFront(tutorialState.layerEl);
    });

    const skipBtn = tutorialState.root.querySelector(".tutorial-skip-btn");
    if (skipBtn) onClick(skipBtn, () => {
      if (tutorialState.confirmEl) tutorialState.confirmEl.hidden = false;
    });
    const confirmNoBtn = tutorialState.root.querySelector(".tutorial-confirm-no");
    if (confirmNoBtn) onClick(confirmNoBtn, () => {
      if (tutorialState.confirmEl) tutorialState.confirmEl.hidden = true;
    });
    const confirmYesBtn = tutorialState.root.querySelector(".tutorial-confirm-yes");
    if (confirmYesBtn) onClick(confirmYesBtn, () => {
      if (tutorialState.confirmEl) tutorialState.confirmEl.hidden = true;
      skipTutorial();
      hideTutorialOverlay();
    });
    if (tutorialState.tourNextBtn) onClick(tutorialState.tourNextBtn, () => {
      advanceTour();
      renderStep();
    });
    if (tutorialState.nextBtn) onClick(tutorialState.nextBtn, () => {
      advanceStep();
      renderStep();
    });

    onKeydown(document, (e) => {
      const ke = e as KeyboardEvent;
      if (ke.key === "Enter" && tutorialState.visible) {
        if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;
        if (tutorialState.nextBtn && !tutorialState.nextBtn.hidden) {
          tutorialState.nextBtn.click();
        } else if (tutorialState.tourNextBtn && !tutorialState.tourNextBtn.hidden) {
          tutorialState.tourNextBtn.click();
        }
      }
    });

    on("tutorial:step-change", () => renderStep());
    on("tutorial:step-complete", () => renderStep());
    on("ui:close-overlays", () => renderStep());
    on("tutorial:hangar-tour-change", () => renderStep());
    on("tutorial:refinery-tour-change", () => renderStep());
    on("tutorial:hud-tour-change", () => renderStep());
    on("tutorial:complete", () => showCompleteBanner());
    on("tutorial:skip", () => hideTutorialOverlay());
    on("station:open", () => renderStep());
    on("station:close", () => renderStep());
  }

  if (active) {
    renderStep();
  } else {
    hideTutorialOverlay();
  }
}
