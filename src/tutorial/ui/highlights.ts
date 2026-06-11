import { getCurrentTutorialStep } from "../data/helpers.js";
import { getState } from "../../state-access.js";
import { tutorialState } from "./state.js";
import { query, toggleClass } from "../../ui/dom-helpers.js";

export function getActiveTutorialHighlight(): HTMLElement | null {
  return query(".tutorial-hangar-highlight, .hud-highlight");
}

export function getCardAnchorHighlight(step: ReturnType<typeof getCurrentTutorialStep>): HTMLElement | null {
  if (!step) return null;
  return getActiveTutorialHighlight();
}

export function setHudHighlight(target: Element | null): void {
  if (tutorialState._activeHudHighlightEl === target) return;
  if (tutorialState._activeHudHighlightEl) {
    toggleClass(tutorialState._activeHudHighlightEl, "hud-highlight", false);
  }
  tutorialState._activeHudHighlightEl = target;
  if (tutorialState._activeHudHighlightEl) {
    toggleClass(tutorialState._activeHudHighlightEl, "hud-highlight", true);
  }
}

export function clearHudHighlight(): void {
  setHudHighlight(null);
}

export function isHangarGuidedStep(step: ReturnType<typeof getCurrentTutorialStep>): boolean {
  return step?.id === "hangar-high" || step?.id === "hangar-turrets";
}
