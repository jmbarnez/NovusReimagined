import { getCurrentTutorialStep } from "../../data/tutorial.js";
import { getState } from "../../state-access.js";
import { Client } from "../../state.js";
import { tutorialState } from "./state.js";
import { getActiveTutorialHighlight } from "./highlights.js";

export function ensureDimmerSegments(dimmer: HTMLElement): HTMLElement[] {
  const existing = Array.from(dimmer.querySelectorAll<HTMLElement>(".tutorial-dimmer-segment"));
  if (existing.length === 4) return existing;
  dimmer.innerHTML = "";
  const segments: HTMLElement[] = [];
  for (let i = 0; i < 4; i++) {
    const segment = document.createElement("div");
    segment.className = "tutorial-dimmer-segment";
    dimmer.appendChild(segment);
    segments.push(segment);
  }
  return segments;
}

export function syncDimmerCutout(dimmer: HTMLElement, target: HTMLElement | null, bounds: DOMRect): void {
  const segments = ensureDimmerSegments(dimmer);
  const pad = 20;
  if (!target) {
    segments[0].style.cssText = "left:0;top:0;width:100%;height:100%;";
    for (let i = 1; i < segments.length; i++) segments[i].style.cssText = "display:none;";
    return;
  }

  const rect = target.getBoundingClientRect();
  const left = Math.max(0, rect.left - bounds.left - pad);
  const top = Math.max(0, rect.top - bounds.top - pad);
  const right = Math.min(bounds.width, rect.right - bounds.left + pad);
  const bottom = Math.min(bounds.height, rect.bottom - bounds.top + pad);

  segments[0].style.cssText = `display:block;left:0;top:0;width:100%;height:${top}px;`;
  segments[1].style.cssText = `display:block;left:0;top:${bottom}px;width:100%;height:${Math.max(0, bounds.height - bottom)}px;`;
  segments[2].style.cssText = `display:block;left:0;top:${top}px;width:${left}px;height:${Math.max(0, bottom - top)}px;`;
  segments[3].style.cssText = `display:block;left:${right}px;top:${top}px;width:${Math.max(0, bounds.width - right)}px;height:${Math.max(0, bottom - top)}px;`;
}

export function syncDimmerVisibility() {
  let dimmer = tutorialState._hudDimmerEl;
  if (!dimmer) {
    dimmer = document.getElementById("hud-tour-dimmer");
  }
  if (!dimmer) {
    const hudOverlay = document.getElementById("hud-overlay");
    if (hudOverlay) {
      dimmer = document.createElement("div");
      dimmer.id = "hud-tour-dimmer";
      dimmer.className = "hidden";
      ensureDimmerSegments(dimmer);
      hudOverlay.appendChild(dimmer);
      tutorialState._hudDimmerEl = dimmer;
    }
  } else {
    tutorialState._hudDimmerEl = dimmer;
  }

  const step = getCurrentTutorialStep(getState().player);
  const showDimmer = tutorialState.visible && getState().player?.tutorial?.active && step?.id === "hud-tour" && !Client.showMap;
  if (showDimmer) {
    if (dimmer) {
      if (tutorialState._hudDimmerHideTimer != null) {
        window.clearTimeout(tutorialState._hudDimmerHideTimer);
        tutorialState._hudDimmerHideTimer = null;
      }
      dimmer.classList.remove("hidden");
      dimmer.style.display = "block";
      const target = getActiveTutorialHighlight();
      const cutoutKey = target ? `${target.id}|${target.className}` : "none";
      if (tutorialState._lastDimmerCutoutKey !== cutoutKey) {
        tutorialState._lastDimmerCutoutKey = cutoutKey;
        syncDimmerCutout(dimmer, target, dimmer.getBoundingClientRect());
      }
      tutorialState._hudDimmerVisible = true;
    }
  } else {
    if (dimmer && tutorialState._hudDimmerVisible) {
      dimmer.classList.add("hidden");
      tutorialState._hudDimmerVisible = false;
      tutorialState._lastDimmerCutoutKey = "";
      tutorialState._hudDimmerHideTimer = window.setTimeout(() => {
        if (dimmer && dimmer.classList.contains("hidden")) {
          dimmer.style.display = "none";
        }
        tutorialState._hudDimmerHideTimer = null;
      }, 250);
    }
  }
}
