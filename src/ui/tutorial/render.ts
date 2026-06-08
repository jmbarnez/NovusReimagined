import { getCurrentTutorialStep, getTutorialNavProgress, getTutorialNavRemainingM, getTutorialStepObjective, TUTORIAL_STEP_COUNT } from "../../data/tutorial.js";
import { getTutorialSnapshot, isCurrentStepComplete, canAdvanceHangarTour, canAdvanceRefineryTour, canAdvanceHudTour } from "../../tutorial/index.js";
import { getState } from "../../state-access.js";
import { t } from "../../utils/i18n.js";
import { tutorialState } from "./state.js";
import { shouldShowTutorialLayer, syncTutorialLayerBounds, positionCardForStep } from "./card.js";
import { syncDimmerVisibility } from "./dimmer.js";
import { syncHudHighlights } from "./highlights.js";
import { syncHangarGuideVisuals, syncRefineryGuideVisuals, syncTourCopy } from "./tours.js";

export function updateReadyState() {
  if (!tutorialState.cardEl || !shouldShowTutorialLayer()) return;
  const step = getCurrentTutorialStep(getState().player);
  const ready = isCurrentStepComplete();
  const tourAdvance = canAdvanceHangarTour() || canAdvanceRefineryTour() || canAdvanceHudTour();
  tutorialState.cardEl.classList.toggle("tutorial-card--ready", ready);
  if (tutorialState.tourNextBtn) {
    tutorialState.tourNextBtn.hidden = !tourAdvance;
  }
  if (tutorialState.nextBtn) {
    tutorialState.nextBtn.hidden = !ready;
    tutorialState.nextBtn.textContent = step?.id === "graduation" ? t("tutorial.graduate") : t("tutorial.next");
  }
  if (tutorialState.statusEl) {
    tutorialState.statusEl.hidden = !ready;
    tutorialState.statusEl.textContent = ready ? t("tutorial.objectiveComplete") : "";
  }
  if (ready && !tutorialState.lastReady) {
    tutorialState.cardEl.classList.remove("tutorial-flash");
    void tutorialState.cardEl.offsetWidth;
    tutorialState.cardEl.classList.add("tutorial-flash");
  }
  tutorialState.lastReady = ready;
}

export function updateNavProgress() {
  if (!shouldShowTutorialLayer()) return;
  const step = getCurrentTutorialStep(getState().player);
  if (!tutorialState.navProgressEl) return;
  if (!step?.nav) {
    tutorialState.navProgressEl.hidden = true;
    return;
  }
  tutorialState.navProgressEl.hidden = false;
  const progress = getTutorialNavProgress(step, getState().player) ?? 0;
  const remaining = getTutorialNavRemainingM(step, getState().player);
  if (tutorialState.navProgressFillEl) tutorialState.navProgressFillEl.style.width = `${Math.round(progress * 100)}%`;
  if (tutorialState.navProgressLabelEl) {
    tutorialState.navProgressLabelEl.textContent = remaining != null
      ? t("tutorial.navProgress", { distance: (remaining / 1000).toFixed(1), label: step.nav.label })
      : "";
  }
}

export function updateObjectiveText() {
  if (!tutorialState.objectiveEl || !shouldShowTutorialLayer()) return;
  const step = getCurrentTutorialStep(getState().player);
  if (!step) return;
  const snapshot = getTutorialSnapshot();
  const html = getTutorialStepObjective(step, snapshot);
  if (tutorialState.objectiveEl.innerHTML !== html) {
    tutorialState.objectiveEl.innerHTML = html;
  }
}

export function renderStep() {
  syncTutorialLayerBounds();
  if (!tutorialState.root) return;

  const step = getCurrentTutorialStep(getState().player);
  if (!step) {
    tutorialState.root.style.display = "none";
    syncHangarGuideVisuals();
    syncRefineryGuideVisuals();
    syncDimmerVisibility();
    return;
  }

  const snapshot = getTutorialSnapshot();

  if (tutorialState.cardEl) tutorialState.cardEl.hidden = false;
  if (tutorialState.completeEl) tutorialState.completeEl.hidden = true;
  if (tutorialState.confirmEl) tutorialState.confirmEl.hidden = true;
  if (tutorialState.counterEl) tutorialState.counterEl.textContent = t("tutorial.stepCounter", { n: getState().player.tutorial.step + 1, total: TUTORIAL_STEP_COUNT });
  if (tutorialState.titleEl) tutorialState.titleEl.textContent = step.title;
  if (tutorialState.objectiveEl) tutorialState.objectiveEl.innerHTML = getTutorialStepObjective(step, snapshot);
  syncTourCopy(step);
  tutorialState.lastReady = false;

  if (!shouldShowTutorialLayer()) {
    tutorialState.root.style.display = "none";
    syncHangarGuideVisuals();
    syncRefineryGuideVisuals();
    syncDimmerVisibility();
    return;
  }

  tutorialState.root.style.display = "block";
  syncHangarGuideVisuals();
  syncRefineryGuideVisuals();
  syncHudHighlights();
  syncDimmerVisibility();
  updateReadyState();
  updateNavProgress();
  positionCardForStep();
}
