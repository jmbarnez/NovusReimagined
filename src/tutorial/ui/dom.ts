import { t } from "../../utils/i18n.js";
import { tutorialState } from "./state.js";
import { getElement, createElement, append, setHtml } from "../../ui/dom-helpers.js";

export function buildTutorialDom(): HTMLElement | null {
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
