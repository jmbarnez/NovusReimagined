import { Client } from "../../state.js";
import { getCurrentTutorialStep, getTutorialNavProgress, getTutorialNavRemainingM, getTutorialStepObjective, hasActiveTourPanel, TUTORIAL_STEP_COUNT } from "../data/helpers.js";
import { getTutorialSnapshot, isCurrentStepComplete, canAdvanceTour } from "../logic/index.js";
import { getState } from "../../state-access.js";
import { t } from "../../utils/i18n.js";
import { tutorialState } from "./state.js";
import { shouldShowTutorialLayer, syncTutorialLayerBounds, positionCardForStep } from "./card.js";
import { getTourPanel } from "../data/helpers.js";
import { syncTutorialVisuals } from "./visuals.js";
import { setText, setHtml, setStyle, toggleClass } from "../../ui/dom-helpers.js";

function syncTourCopy(step: NonNullable<ReturnType<typeof getCurrentTutorialStep>>, snapshot: Record<string, unknown>) {
  const phaseKey = step.tour?.phaseKey;
  const phase = phaseKey && typeof snapshot[phaseKey] === "number" ? snapshot[phaseKey] as number : 0;
  const panel = step.tour?.phases?.[phase] as { tab?: string } | undefined;
  if (!step.tour || !panel || (panel.tab && !Client.stationOpen)) {
    if (tutorialState.tourLabelEl) {
      setText(tutorialState.tourLabelEl, "");
      setStyle(tutorialState.tourLabelEl, { display: "none" });
    }
    if (tutorialState.tourBodyEl) {
      setText(tutorialState.tourBodyEl, "");
      setStyle(tutorialState.tourBodyEl, { display: "none" });
    }
    return;
  }
  const tour = getTourPanel(step, snapshot);
  if (tutorialState.tourLabelEl) {
    if (tour) {
      setText(tutorialState.tourLabelEl, `${tour.label} (${tour.index}/${tour.total})`);
      setStyle(tutorialState.tourLabelEl, { display: "block" });
    } else {
      setText(tutorialState.tourLabelEl, "");
      setStyle(tutorialState.tourLabelEl, { display: "none" });
    }
  }
  if (tutorialState.tourBodyEl) {
    if (tour && tour.body) {
      setHtml(tutorialState.tourBodyEl, tour.body);
      setStyle(tutorialState.tourBodyEl, { display: "block" });
    } else {
      setText(tutorialState.tourBodyEl, "");
      setStyle(tutorialState.tourBodyEl, { display: "none" });
    }
  }
}

export function updateReadyState(step: NonNullable<ReturnType<typeof getCurrentTutorialStep>> | null, ready: boolean) {
  if (!tutorialState.cardEl || !shouldShowTutorialLayer()) return;
  const tourAdvance = canAdvanceTour();
  toggleClass(tutorialState.cardEl, "tutorial-card--ready", ready);
  if (tutorialState.tourNextBtn) {
    tutorialState.tourNextBtn.hidden = !tourAdvance;
  }
  if (tutorialState.nextBtn) {
    tutorialState.nextBtn.hidden = !ready;
    setText(tutorialState.nextBtn, step?.id === "graduation" ? t("tutorial.graduate") : t("tutorial.next"));
  }
  if (tutorialState.statusEl) {
    tutorialState.statusEl.hidden = !ready;
    setText(tutorialState.statusEl, ready ? t("tutorial.objectiveComplete") : "");
  }
  if (ready && !tutorialState.lastReady) {
    tutorialState.cardEl.classList.remove("tutorial-flash");
    void tutorialState.cardEl.offsetWidth;
    tutorialState.cardEl.classList.add("tutorial-flash");
  }
  tutorialState.lastReady = ready;
}

export function updateNavProgress(step: NonNullable<ReturnType<typeof getCurrentTutorialStep>> | null) {
  if (!shouldShowTutorialLayer() || !tutorialState.navProgressEl) return;
  if (!step?.nav) {
    tutorialState.navProgressEl.hidden = true;
    return;
  }
  tutorialState.navProgressEl.hidden = false;
  const player = getState().player;
  const progress = getTutorialNavProgress(step, player) ?? 0;
  const remaining = getTutorialNavRemainingM(step, player);
  if (tutorialState.navProgressFillEl) setStyle(tutorialState.navProgressFillEl, { width: `${Math.round(progress * 100)}%` });
  if (tutorialState.navProgressLabelEl) {
    setText(tutorialState.navProgressLabelEl, remaining != null
      ? t("tutorial.navProgress", { distance: (remaining / 1000).toFixed(1), label: step.nav.label })
      : "");
  }
}

export function updateObjectiveText(step: NonNullable<ReturnType<typeof getCurrentTutorialStep>> | null, snapshot: Record<string, unknown>) {
  if (!tutorialState.objectiveEl || !shouldShowTutorialLayer() || !step) return;
  if (hasActiveTourPanel(step, snapshot)) {
    setStyle(tutorialState.objectiveEl, { display: "none" });
    return;
  }
  setHtml(tutorialState.objectiveEl, getTutorialStepObjective(step, snapshot));
  setStyle(tutorialState.objectiveEl, { display: "block" });
}

export function renderStep() {
  syncTutorialLayerBounds();
  if (!tutorialState.root) return;

  const step = getCurrentTutorialStep(getState().player);
  if (!step) {
    setStyle(tutorialState.root, { display: "none" });
    syncTutorialVisuals();
    return;
  }

  const snapshot = getTutorialSnapshot();

  if (tutorialState.cardEl) tutorialState.cardEl.hidden = false;
  if (tutorialState.completeEl) tutorialState.completeEl.hidden = true;
  if (tutorialState.confirmEl) tutorialState.confirmEl.hidden = true;
  if (tutorialState.counterEl) setText(tutorialState.counterEl, t("tutorial.stepCounter", { n: getState().player.tutorial.step + 1, total: TUTORIAL_STEP_COUNT }));
  if (tutorialState.titleEl) setText(tutorialState.titleEl, step.title);
  if (tutorialState.objectiveEl) {
    if (hasActiveTourPanel(step, snapshot)) {
      setStyle(tutorialState.objectiveEl, { display: "none" });
    } else {
      setHtml(tutorialState.objectiveEl, getTutorialStepObjective(step, snapshot));
      setStyle(tutorialState.objectiveEl, { display: "block" });
    }
  }
  syncTourCopy(step, snapshot);
  tutorialState.lastReady = false;

  if (!shouldShowTutorialLayer()) {
    setStyle(tutorialState.root, { display: "none" });
    syncTutorialVisuals();
    return;
  }

  setStyle(tutorialState.root, { display: "block" });
  syncTutorialVisuals();
  const ready = isCurrentStepComplete();
  updateReadyState(step, ready);
  updateNavProgress(step);
  updateObjectiveText(step, snapshot);
  positionCardForStep();
}
