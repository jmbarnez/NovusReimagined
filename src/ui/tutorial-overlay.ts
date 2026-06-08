import "./styles/hud-tutorial.css";
import { Client } from "../state.js";
import { bringToFront } from "./hud/windows.js";
import { getState } from "../state-access.js";

import { viewportW, viewportH } from "../render/viewport.js";
import { on } from "../events.js";
import {
  TUTORIAL_STEP_COUNT,
  getCurrentTutorialStep,
  getTutorialNavProgress,
  getTutorialNavRemainingM,
  getTutorialStepObjective,
  getHangarTourPanel,
  getHudTourPanel,
  getRefineryTourPanel,
} from "../data/tutorial.js";
import {
  skipTutorial,
  getTutorialSnapshot,
  isCurrentStepComplete,
  advanceStep,
  canAdvanceHangarTour,
  advanceHangarTutorialPanel,
  canAdvanceRefineryTour,
  advanceRefineryTutorialPanel,
  canAdvanceHudTour,
  advanceHudTour,
} from "../tutorial.js";
import { syncHangarTutorialGuide, clearHangarTutorialGuide } from "./tutorial-hangar-guide.js";
import { syncRefineryTutorialGuide, clearRefineryTutorialGuide } from "./tutorial-refinery-guide.js";
import { t } from "../utils/i18n.js";

let layerEl: HTMLElement | null = null;
let root: HTMLElement | null = null;
let cardEl: HTMLElement | null = null;
let titleEl: HTMLElement | null = null;
let objectiveEl: HTMLElement | null = null;
let tourLabelEl: HTMLElement | null = null;
let statusEl: HTMLElement | null = null;
let counterEl: HTMLElement | null = null;
let tourNextBtn: HTMLButtonElement | null = null;
let nextBtn: HTMLButtonElement | null = null;
let navProgressEl: HTMLElement | null = null;
let navProgressFillEl: HTMLElement | null = null;
let navProgressLabelEl: HTMLElement | null = null;
let confirmEl: HTMLElement | null = null;
let completeEl: HTMLElement | null = null;
let visible = false;
let showCompleteBannerActive = false;
let lastReady = false;
let _activeHudHighlightEl: Element | null = null;
let _hudDimmerEl: HTMLElement | null = null;
let _hudDimmerVisible = false;
let _hudDimmerHideTimer: number | null = null;
let _lastDimmerCutoutKey = "";
let _lastTutorialOverlayUpdateMs = 0;
const TUTORIAL_OVERLAY_MIN_UPDATE_MS = 1000 / 60;

function getActiveTutorialHighlight(): HTMLElement | null {
  return document.querySelector(".tutorial-hangar-highlight, .hud-highlight");
}

function getCardAnchorHighlight(step: ReturnType<typeof getCurrentTutorialStep>): HTMLElement | null {
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

function setHudHighlight(target: Element | null): void {
  if (_activeHudHighlightEl === target) return;
  if (_activeHudHighlightEl) {
    _activeHudHighlightEl.classList.remove("hud-highlight");
  }
  _activeHudHighlightEl = target;
  if (_activeHudHighlightEl) {
    _activeHudHighlightEl.classList.add("hud-highlight");
  }
}

function clearHudHighlight(): void {
  setHudHighlight(null);
}

function ensureDimmerSegments(dimmer: HTMLElement): HTMLElement[] {
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

function syncDimmerCutout(dimmer: HTMLElement, target: HTMLElement | null, bounds: DOMRect): void {
  const segments = ensureDimmerSegments(dimmer);
  const pad = 8;
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

function positionCardForStep(): void {
  if (!root || !cardEl || !layerEl || cardEl.hidden) return;
  const step = getCurrentTutorialStep(getState().player);
  const layerRect = layerEl.getBoundingClientRect();
  const target = getCardAnchorHighlight(step);
  const cardRect = cardEl.getBoundingClientRect();
  const margin = 16;
  const safeW = Math.max(1, layerRect.width - cardRect.width - margin * 2);
  let x = margin + safeW / 2;
  let y = margin;

  if (target) {
    const rect = target.getBoundingClientRect();
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

  root.style.left = `${Math.max(margin, Math.min(x, layerRect.width - cardRect.width - margin))}px`;
  root.style.top = `${Math.max(margin, Math.min(y, layerRect.height - cardRect.height - margin))}px`;
  root.style.transform = "none";
}

function xpPopupObscuresTutorial(): boolean {
  const xp = document.getElementById("hud-xp-popup");
  return !!(xp && (xp.classList.contains("visible") || xp.classList.contains("fading")));
}

/** Tutorial step card over the playable world — hidden on map or when XP toast covers it. */
function shouldShowTutorialLayer(): boolean {
  if (Client.showMap) return false;
  if (showCompleteBannerActive) return true;
  if (!visible || !getState().player?.tutorial?.active) return false;
  if (xpPopupObscuresTutorial()) return false;
  const stepId = getCurrentTutorialStep(getState().player)?.id;
  const stationRelevantStep = stepId === "industry" || stepId === "hangar-high" || stepId === "hangar-turrets";
  if (Client.stationOpen && !stationRelevantStep) return false;
  return true;
}

function isHangarGuidedStep(step: ReturnType<typeof getCurrentTutorialStep>): boolean {
  return step?.id === "hangar-high" || step?.id === "hangar-turrets";
}

function syncTutorialLayerBounds() {
  if (!layerEl) return;
  const show = shouldShowTutorialLayer();
  layerEl.style.display = show ? "block" : "none";
  if (!show) return;
  layerEl.classList.toggle("tutorial-layer--over-station", Client.stationOpen);
  layerEl.style.left = "0px";
  layerEl.style.top = "0px";
  layerEl.style.width = `${viewportW()}px`;
  layerEl.style.height = `${viewportH()}px`;
}

function syncDimmerVisibility() {
  let dimmer = _hudDimmerEl;
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
      _hudDimmerEl = dimmer;
    }
  } else {
    _hudDimmerEl = dimmer;
  }

  const step = getCurrentTutorialStep(getState().player);
  const showDimmer = visible && getState().player?.tutorial?.active && step?.id === "hud-tour" && !Client.showMap;
  if (showDimmer) {
    if (dimmer) {
      if (_hudDimmerHideTimer != null) {
        window.clearTimeout(_hudDimmerHideTimer);
        _hudDimmerHideTimer = null;
      }
      dimmer.classList.remove("hidden");
      dimmer.style.display = "block";
      const target = getActiveTutorialHighlight();
      const cutoutKey = target ? `${target.id}|${target.className}` : "none";
      if (_lastDimmerCutoutKey !== cutoutKey) {
        _lastDimmerCutoutKey = cutoutKey;
        syncDimmerCutout(dimmer, target, dimmer.getBoundingClientRect());
      }
      _hudDimmerVisible = true;
    }
  } else {
    if (dimmer && _hudDimmerVisible) {
      dimmer.classList.add("hidden");
      _hudDimmerVisible = false;
      _lastDimmerCutoutKey = "";
      _hudDimmerHideTimer = window.setTimeout(() => {
        if (dimmer && dimmer.classList.contains("hidden")) {
          dimmer.style.display = "none";
        }
        _hudDimmerHideTimer = null;
      }, 250);
    }
  }
}

function syncHangarGuideVisuals() {
  const step = getCurrentTutorialStep(getState().player);
  const snapshot = getTutorialSnapshot();
  if (isHangarGuidedStep(step) && Client.stationOpen && snapshot.hangarReviewComplete !== true) {
    syncHangarTutorialGuide(snapshot);
  } else {
    clearHangarTutorialGuide();
  }
}

function syncRefineryGuideVisuals() {
  const step = getCurrentTutorialStep(getState().player);
  const snapshot = getTutorialSnapshot();
  if (step?.id === "industry" && Client.stationOpen) {
    syncRefineryTutorialGuide(snapshot);
  } else {
    clearRefineryTutorialGuide();
  }
}

function syncHudHighlights() {
  if (!visible || !getState().player?.tutorial?.active || Client.showMap) {
    clearHudHighlight();
    return;
  }

  const step = getCurrentTutorialStep(getState().player);
  if (!step) {
    clearHudHighlight();
    return;
  }

  const snapshot = getTutorialSnapshot();
  let highlightTarget: Element | null = null;

  if (step.id === "hud-tour") {
    const phase = typeof snapshot.hudTourPhase === "number" ? snapshot.hudTourPhase : 0;
    const scannerDock = document.getElementById("hud-scanner-dock");
    const logPanel = document.getElementById("hud-log-panel");

    if (phase === 0) {
      highlightTarget = document.getElementById("hud-status-bars");
    } else if (phase === 1) {
      highlightTarget = document.getElementById("hud-slots");
    } else if (phase === 2) {
      highlightTarget = document.getElementById("hud-lock-rail");
    } else if (phase === 3) {
      highlightTarget = scannerDock;
    } else if (phase === 4) {
      highlightTarget = logPanel;
    } else if (phase === 5) {
      highlightTarget = document.getElementById("hud-missions");
    }
  } else if (step.id === "fly-academy") {
    highlightTarget = document.getElementById("hud-missions");
  } else if (step.id === "targeting") {
    const scannerDock = document.getElementById("hud-scanner-dock");
    highlightTarget = scannerDock;
  } else if (step.id === "mining") {
    highlightTarget = document.getElementById("hud-slots");
  } else if (step.id === "hangar-high" || step.id === "industry" || step.id === "hangar-turrets") {
    if (!Client.stationOpen) {
      highlightTarget = document.getElementById("hud-dock-prompt");
    }
  } else if (step.id === "gunnery") {
    highlightTarget = document.getElementById("hud-slots");
  } else if (step.id === "graduation") {
    highlightTarget = document.getElementById("hud-dock-prompt");
  }

  setHudHighlight(highlightTarget);
}

function updateReadyState() {
  if (!cardEl || !shouldShowTutorialLayer()) return;
  const step = getCurrentTutorialStep(getState().player);
  const ready = isCurrentStepComplete();
  const tourAdvance = canAdvanceHangarTour() || canAdvanceRefineryTour() || canAdvanceHudTour();
  cardEl.classList.toggle("tutorial-card--ready", ready);
  if (tourNextBtn) {
    tourNextBtn.hidden = !tourAdvance;
  }
  if (nextBtn) {
    nextBtn.hidden = !ready;
    nextBtn.textContent = step?.id === "graduation" ? t("tutorial.graduate") : t("tutorial.next");
  }
  if (statusEl) {
    statusEl.hidden = !ready;
    statusEl.textContent = ready ? t("tutorial.objectiveComplete") : "";
  }
  if (ready && !lastReady) {
    cardEl.classList.remove("tutorial-flash");
    void cardEl.offsetWidth;
    cardEl.classList.add("tutorial-flash");
  }
  lastReady = ready;
}

function updateNavProgress() {
  if (!shouldShowTutorialLayer()) return;
  const step = getCurrentTutorialStep(getState().player);
  if (!navProgressEl) return;
  if (!step?.nav) {
    navProgressEl.hidden = true;
    return;
  }
  navProgressEl.hidden = false;
  const progress = getTutorialNavProgress(step, getState().player) ?? 0;
  const remaining = getTutorialNavRemainingM(step, getState().player);
  if (navProgressFillEl) navProgressFillEl.style.width = `${Math.round(progress * 100)}%`;
  if (navProgressLabelEl) {
    navProgressLabelEl.textContent = remaining != null
      ? t("tutorial.navProgress", { distance: (remaining / 1000).toFixed(1), label: step.nav.label })
      : "";
  }
}

function renderStep() {
  syncTutorialLayerBounds();
  if (!root) return;

  const step = getCurrentTutorialStep(getState().player);
  if (!step) {
    root.style.display = "none";
    clearHangarTutorialGuide();
    clearRefineryTutorialGuide();
    syncDimmerVisibility();
    return;
  }

  const snapshot = getTutorialSnapshot();

  // Always refresh copy — step can change while the map or XP toast hides this layer.
  if (cardEl) cardEl.hidden = false;
  if (completeEl) completeEl.hidden = true;
  if (confirmEl) confirmEl.hidden = true;
  if (counterEl) counterEl.textContent = t("tutorial.stepCounter", { n: getState().player.tutorial.step + 1, total: TUTORIAL_STEP_COUNT });
  if (titleEl) titleEl.textContent = step.title;
  if (objectiveEl) objectiveEl.innerHTML = getTutorialStepObjective(step, snapshot);
  syncTourCopy(step);
  lastReady = false;

  if (!shouldShowTutorialLayer()) {
    root.style.display = "none";
    clearHangarTutorialGuide();
    clearRefineryTutorialGuide();
    syncDimmerVisibility();
    return;
  }

  root.style.display = "block";
  syncHangarGuideVisuals();
  syncRefineryGuideVisuals();
  syncHudHighlights();
  syncDimmerVisibility();
  updateReadyState();
  updateNavProgress();
  positionCardForStep();
}

function syncTourCopy(step: NonNullable<ReturnType<typeof getCurrentTutorialStep>>) {
  const snapshot = getTutorialSnapshot();
  let tour = getHangarTourPanel(step, snapshot);
  if (step.id === "hud-tour") {
    tour = getHudTourPanel(step, snapshot);
  } else if (step.id === "industry") {
    tour = getRefineryTourPanel(step, snapshot);
  }
  if (tourLabelEl) {
    if (tour) {
      tourLabelEl.textContent = `${tour.label} (${tour.index}/${tour.total})`;
      tourLabelEl.style.display = "block";
    } else {
      tourLabelEl.textContent = "";
      tourLabelEl.style.display = "none";
    }
  }
}

function updateObjectiveText() {
  if (!objectiveEl || !shouldShowTutorialLayer()) return;
  const step = getCurrentTutorialStep(getState().player);
  if (!step) return;
  const snapshot = getTutorialSnapshot();
  const html = getTutorialStepObjective(step, snapshot);
  if (objectiveEl.innerHTML !== html) {
    objectiveEl.innerHTML = html;
  }
}


export function initTutorialOverlay(active: boolean) {
  visible = active;
  if (!layerEl) {
    layerEl = document.getElementById("world-tutorial-layer");
    if (!layerEl) return;

    root = document.createElement("div");
    root.id = "hud-tutorial";
    root.innerHTML = `
      <div class="tutorial-card">
        <div class="tutorial-header">
          <span class="tutorial-counter"></span>
          <button type="button" class="tutorial-skip-btn">${t("tutorial.skip")}</button>
        </div>
        <div class="tutorial-title"></div>
        <div class="tutorial-objective"></div>
        <div class="tutorial-tour-label"></div>
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
    `;
    layerEl.appendChild(root);

    cardEl = root.querySelector(".tutorial-card");
    counterEl = root.querySelector(".tutorial-counter");
    titleEl = root.querySelector(".tutorial-title");
    objectiveEl = root.querySelector(".tutorial-objective");
    tourLabelEl = root.querySelector(".tutorial-tour-label");
    navProgressEl = root.querySelector(".tutorial-nav-progress");
    navProgressFillEl = root.querySelector(".tutorial-nav-progress-fill");
    navProgressLabelEl = root.querySelector(".tutorial-nav-progress-label");
    statusEl = root.querySelector(".tutorial-status");
    tourNextBtn = root.querySelector(".tutorial-tour-next-btn");
    nextBtn = root.querySelector(".tutorial-next-btn");
    confirmEl = root.querySelector(".tutorial-confirm");
    completeEl = root.querySelector(".tutorial-complete");

    root.addEventListener("mousedown", () => {
      if (layerEl) bringToFront(layerEl);
    });

    root.querySelector(".tutorial-skip-btn")?.addEventListener("click", () => {
      if (confirmEl) confirmEl.hidden = false;
    });
    root.querySelector(".tutorial-confirm-no")?.addEventListener("click", () => {
      if (confirmEl) confirmEl.hidden = true;
    });
    root.querySelector(".tutorial-confirm-yes")?.addEventListener("click", () => {
      if (confirmEl) confirmEl.hidden = true;
      skipTutorial();
      hideTutorialOverlay();
    });
    tourNextBtn?.addEventListener("click", () => {
      const step = getCurrentTutorialStep(getState().player);
      if (step?.id === "hud-tour") {
        advanceHudTour();
        renderStep();
        return;
      }
      if (step?.id === "industry") {
        advanceRefineryTutorialPanel();
        renderStep();
        return;
      }
      advanceHangarTutorialPanel();
      renderStep();
    });
    nextBtn?.addEventListener("click", () => {
      advanceStep();
      renderStep();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && visible) {
        if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;
        if (nextBtn && !nextBtn.hidden) {
          nextBtn.click();
        } else if (tourNextBtn && !tourNextBtn.hidden) {
          tourNextBtn.click();
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

function showCompleteBanner() {
  visible = false;
  showCompleteBannerActive = true;
  clearHangarTutorialGuide();
  clearRefineryTutorialGuide();
  syncTutorialLayerBounds();
  if (root) {
    root.style.display = "block";
    if (cardEl) cardEl.hidden = true;
    if (confirmEl) confirmEl.hidden = true;
  }
  if (completeEl) {
    completeEl.hidden = false;
    setTimeout(() => {
      if (completeEl) completeEl.hidden = true;
      hideTutorialOverlay();
    }, 3500);
  }
}

export function hideTutorialOverlay() {
  visible = false;
  showCompleteBannerActive = false;
  clearHangarTutorialGuide();
  clearRefineryTutorialGuide();
  clearHudHighlight();
  const dimmer = document.getElementById("hud-tour-dimmer");
  if (dimmer) {
    dimmer.classList.add("hidden");
    dimmer.style.display = "none";
  }
  _hudDimmerVisible = false;
  _lastDimmerCutoutKey = "";
  if (layerEl) layerEl.style.display = "none";
  if (root) root.style.display = "none";
}

export function updateTutorialOverlay(_Wc: number, _Hc: number, _now: number) {
  if (!visible || !getState().player?.tutorial?.active) {
    clearRefineryTutorialGuide();
    clearHudHighlight();
    const dimmer = document.getElementById("hud-tour-dimmer");
    if (dimmer) {
      dimmer.classList.add("hidden");
      dimmer.style.display = "none";
    }
    _hudDimmerVisible = false;
    _lastDimmerCutoutKey = "";
    if (root) root.style.display = "none";
    return;
  }
  if (_now - _lastTutorialOverlayUpdateMs < TUTORIAL_OVERLAY_MIN_UPDATE_MS - 0.5) {
    return;
  }
  _lastTutorialOverlayUpdateMs = _now;
  syncTutorialLayerBounds();
  const show = shouldShowTutorialLayer();
  if (!show) {
    if (root) root.style.display = "none";
    clearRefineryTutorialGuide();
    clearHudHighlight();
    return;
  }
  if (root) root.style.display = "block";
  syncHangarGuideVisuals();
  syncRefineryGuideVisuals();
  updateObjectiveText();
  syncHudHighlights();
  syncDimmerVisibility();
  updateNavProgress();
  updateReadyState();
  positionCardForStep();
}

export function destroyTutorialOverlay() {
  clearHangarTutorialGuide();
  clearRefineryTutorialGuide();
  clearHudHighlight();
  document.getElementById("hud-tour-dimmer")?.remove();
  root?.remove();
  root = null;
  layerEl = null;
}
