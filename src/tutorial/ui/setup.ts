import "../../ui/styles/hud-tutorial.css";
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
import { hideTutorialOverlay, showCompleteBanner } from "./lifecycle.js";
import { getElement, createElement, append, setHtml, onClick, onKeydown, onMouseDown } from "../../ui/dom-helpers.js";

const RENDER_REFRESH_EVENTS = [
  "tutorial:step-change",
  "tutorial:step-complete",
  "ui:close-overlays",
  "tutorial:hangar-tour-change",
  "tutorial:refinery-tour-change",
  "station:open",
  "station:close",
] as const;

function buildTutorialDom(): HTMLElement | null {
  tutorialState.layerEl = getElement("world-tutorial-layer");
  if (!tutorialState.layerEl) return null;

  tutorialState.root = createElement("div");
  tutorialState.root.id = "hud-tutorial";
  setHtml(tutorialState.root, `
    <div class="tutorial-card">
      <div class="tutorial-header">
        <span class="tutorial-counter"></span>
        <button type="button" class="tutorial-skip-btn">${t("tutorial.skip")}</button>
      </div>
      <div class="tutorial-title"></div>
      <div class="tutorial-objective"></div>
      <div class="tutorial-tour-label"></div>
      <div class="tutorial-tour-body"></div>
      <div class="tutorial-nav-progress" hidden>
        <div class="tutorial-nav-progress-track"><div class="tutorial-nav-progress-fill"></div></div>
        <span class="tutorial-nav-progress-label"></span>
      </div>
      <div class="tutorial-status" hidden>${t("tutorial.objectiveComplete")}</div>
      <div class="tutorial-nav">
        <button type="button" class="tutorial-tour-next-btn" hidden>${t("tutorial.next")}</button>
        <button type="button" class="tutorial-next-btn" hidden>${t("tutorial.next")}</button>
      </div>
    </div>
    <div class="tutorial-confirm" hidden>
      <div class="tutorial-confirm-card">
        <p>${t("tutorial.confirmSkip")}</p>
        <div class="tutorial-confirm-actions">
          <button type="button" class="tutorial-confirm-yes">${t("tutorial.yesSkip")}</button>
          <button type="button" class="tutorial-confirm-no">${t("tutorial.continue")}</button>
        </div>
      </div>
    </div>
    <div class="tutorial-complete" hidden>
      <div class="tutorial-complete-card">
        <div class="tutorial-complete-title">${t("tutorial.welcomeTitle")}</div>
        <div class="tutorial-complete-sub">${t("tutorial.welcomeSub")}</div>
      </div>
    </div>
  `);
  append(tutorialState.layerEl, tutorialState.root);

  tutorialState.cardEl = tutorialState.root.querySelector(".tutorial-card");
  tutorialState.counterEl = tutorialState.root.querySelector(".tutorial-counter");
  tutorialState.titleEl = tutorialState.root.querySelector(".tutorial-title");
  tutorialState.objectiveEl = tutorialState.root.querySelector(".tutorial-objective");
  tutorialState.tourLabelEl = tutorialState.root.querySelector(".tutorial-tour-label");
  tutorialState.tourBodyEl = tutorialState.root.querySelector(".tutorial-tour-body");
  tutorialState.navProgressEl = tutorialState.root.querySelector(".tutorial-nav-progress");
  tutorialState.navProgressFillEl = tutorialState.root.querySelector(".tutorial-nav-progress-fill");
  tutorialState.navProgressLabelEl = tutorialState.root.querySelector(".tutorial-nav-progress-label");
  tutorialState.statusEl = tutorialState.root.querySelector(".tutorial-status");
  tutorialState.tourNextBtn = tutorialState.root.querySelector(".tutorial-tour-next-btn");
  tutorialState.nextBtn = tutorialState.root.querySelector(".tutorial-next-btn");
  tutorialState.confirmEl = tutorialState.root.querySelector(".tutorial-confirm");
  tutorialState.completeEl = tutorialState.root.querySelector(".tutorial-complete");

  return tutorialState.root;
}

function bindSkipControls(root: HTMLElement): void {
  const skipBtn = root.querySelector(".tutorial-skip-btn");
  if (skipBtn) onClick(skipBtn, () => {
    if (tutorialState.confirmEl) tutorialState.confirmEl.hidden = false;
  });

  const confirmNoBtn = root.querySelector(".tutorial-confirm-no");
  if (confirmNoBtn) onClick(confirmNoBtn, () => {
    if (tutorialState.confirmEl) tutorialState.confirmEl.hidden = true;
  });

  const confirmYesBtn = root.querySelector(".tutorial-confirm-yes");
  if (confirmYesBtn) onClick(confirmYesBtn, () => {
    if (tutorialState.confirmEl) tutorialState.confirmEl.hidden = true;
    skipTutorial();
    hideTutorialOverlay();
  });
}

function bindAdvanceControls(): void {
  if (tutorialState.tourNextBtn) onClick(tutorialState.tourNextBtn, () => {
    advanceTour();
    renderStep();
  });

  if (tutorialState.nextBtn) onClick(tutorialState.nextBtn, () => {
    advanceStep();
    renderStep();
  });
}

function bindEnterShortcut(): void {
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
}

function bindRenderRefreshEvents(): void {
  for (const eventName of RENDER_REFRESH_EVENTS) {
    on(eventName, () => renderStep());
  }
}

function bindTutorialEvents(): void {
  if (!tutorialState.root) return;

  onClick(tutorialState.root, () => {
    if (tutorialState.layerEl) bringToFront(tutorialState.layerEl);
  });

  // Prevent mousedown from bubbling to the global input handler so clicking
  // tutorial buttons (Next, Skip, etc.) does not fire the selected weapon.
  onMouseDown(tutorialState.root, (e) => {
    e.stopPropagation();
  });

  bindSkipControls(tutorialState.root);
  bindAdvanceControls();
  bindEnterShortcut();
  bindRenderRefreshEvents();

  on("tutorial:complete", () => showCompleteBanner());
  on("tutorial:skip", () => hideTutorialOverlay());
}

export function initTutorialOverlay(active: boolean) {
  tutorialState.visible = active;
  if (!tutorialState.layerEl) {
    buildTutorialDom();
    if (!tutorialState.root) return;
    bindTutorialEvents();
  }

  if (active) {
    renderStep();
  } else {
    hideTutorialOverlay();
  }
}
