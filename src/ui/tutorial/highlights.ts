import { getCurrentTutorialStep } from "../../data/tutorial.js";
import { getTutorialSnapshot } from "../../tutorial/index.js";
import { getState } from "../../state-access.js";
import { Client } from "../../state.js";
import { tutorialState } from "./state.js";
import {
  getHudScannerDock,
  getHudLogPanel,
  getHudStatusBars,
  getHudSlots,
  getHudLockRail,
  getHudMissions,
  getHudDockPrompt,
} from "../hud-elements.js";

export function getActiveTutorialHighlight(): HTMLElement | null {
  return document.querySelector(".tutorial-hangar-highlight, .hud-highlight");
}

export function getCardAnchorHighlight(step: ReturnType<typeof getCurrentTutorialStep>): HTMLElement | null {
  if (!step) return null;
  const highlighted = getActiveTutorialHighlight();
  if (!highlighted) return null;
  if (highlighted.classList.contains("tutorial-hangar-highlight")) return highlighted;
  if (highlighted.classList.contains("hud-highlight")) {
    const hudAnchoredSteps = new Set(["hud-tour"]);
    return hudAnchoredSteps.has(step.id) ? highlighted : null;
  }
  return null;
}

export function setHudHighlight(target: Element | null): void {
  if (tutorialState._activeHudHighlightEl === target) return;
  if (tutorialState._activeHudHighlightEl) {
    tutorialState._activeHudHighlightEl.classList.remove("hud-highlight");
  }
  tutorialState._activeHudHighlightEl = target;
  if (tutorialState._activeHudHighlightEl) {
    tutorialState._activeHudHighlightEl.classList.add("hud-highlight");
  }
}

export function clearHudHighlight(): void {
  setHudHighlight(null);
}

export function isHangarGuidedStep(step: ReturnType<typeof getCurrentTutorialStep>): boolean {
  return step?.id === "hangar-high" || step?.id === "hangar-turrets";
}

export function syncHudHighlights() {
  if (!tutorialState.visible || !getState().player?.tutorial?.active || Client.showMap) {
    clearHudHighlight();
    return;
  }

  const step = getCurrentTutorialStep(getState().player);
  if (!step) {
    clearHudHighlight();
    return;
  }

  const snapshot = getTutorialSnapshot();
  if (step.id === "hud-tour" && snapshot.hudTourComplete === true) {
    clearHudHighlight();
    return;
  }
  let highlightTarget: Element | null = null;

  if (step.id === "hud-tour") {
    const phase = typeof snapshot.hudTourPhase === "number" ? snapshot.hudTourPhase : 0;
    const scannerDock = getHudScannerDock();
    const logPanel = getHudLogPanel();

    if (phase === 0) {
      highlightTarget = getHudStatusBars();
    } else if (phase === 1) {
      highlightTarget = getHudSlots();
    } else if (phase === 2) {
      highlightTarget = getHudLockRail();
    } else if (phase === 3) {
      highlightTarget = scannerDock;
    } else if (phase === 4) {
      highlightTarget = logPanel;
    } else if (phase === 5) {
      highlightTarget = getHudMissions();
    }
  } else if (step.id === "fly-academy") {
    highlightTarget = getHudMissions();
  } else if (step.id === "targeting") {
    highlightTarget = getHudScannerDock();
  } else if (step.id === "mining") {
    highlightTarget = getHudSlots();
  } else if (step.id === "hangar-high" || step.id === "industry" || step.id === "hangar-turrets") {
    if (!Client.stationOpen) {
      highlightTarget = getHudDockPrompt();
    }
  } else if (step.id === "gunnery") {
    highlightTarget = getHudSlots();
  } else if (step.id === "graduation") {
    highlightTarget = getHudDockPrompt();
  }

  setHudHighlight(highlightTarget);
}
