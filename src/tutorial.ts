import { Client } from "./state.js";
import { getState } from "./state-access.js";

import { PlayerAccess } from "./state-access.js";
import { queueFrameAction } from "./sim/input.js";
import { emit, on } from "./events.js";
import { savePlayer } from "./player/player-data.js";
import { warpTo, undockStation } from "./dock.js";
import { getNovusPrimeIdx } from "./world/galaxy-build.js";
import { ensureTutorialRegionsDiscovered } from "./map-discovery.js";
import { TUTORIAL_SPAWN, shouldRelocateTutorialStart } from "./data/tutorial-layout.js";
import { floatText } from "./utils/fx.js";
import { clearHangarTutorialGuide } from "./ui/tutorial-hangar-guide.js";
import { logEvent } from "./feedback.js";
import { TUTORIAL_LOCAL_REGIONS } from "./data/tutorial-layout.js";
import { resetTutorialTrackState } from "./physics/tutorial-track.js";
import {
  TUTORIAL_STEPS,
  TUTORIAL_STEP_COUNT,
  buildTutorialCtx,
  getCurrentTutorialStep,
  setTutorialGatePulse,
  isStationHangarTabActive,
  HANGAR_REVIEW_PHASE_COUNT,
  HANGAR_COMBAT_SWAP_PHASE_COUNT,
  REFINERY_GUIDE_PHASE_COUNT,
  hasTutorialCombatLoadout,
} from "./data/tutorial.js";
import {
  ensureTutorialMission,
  grantTutorialStepReward,
  finalizeTutorialMission,
} from "./data/tutorial-mission.js";
import { syncTutorialMissionProgress } from "./data/missions.js";

let snapshot: Record<string, unknown> = {};
let tutorialEventsBound = false;

function nowSec(): number {
  return Date.now() / 1000;
}

function beginHangarReviewTour(now: number): void {
  if (!snapshot.hangarTabActive) {
    snapshot.hangarTabActive = true;
    snapshot.hangarReviewPhase = 0;
    snapshot.hangarReviewPhaseAt = now;
  }
  snapshot.hangarReviewStarted = true;
}

function markHangarReviewComplete(): void {
  markHangarStepComplete(false);
}

function markHangarStepComplete(requireCombatLoadout: boolean): void {
  if (!snapshot.hangarReviewStarted) return;
  if (requireCombatLoadout && !hasTutorialCombatLoadout(getState().player)) return;
  snapshot.hangarReviewComplete = true;
}

function bindTutorialEvents(): void {
  if (tutorialEventsBound) return;
  tutorialEventsBound = true;
  on("station:open", () => {
    const stepId = getCurrentTutorialStep(getState().player)?.id;
    if (stepId !== "hangar-high" && stepId !== "hangar-turrets" && stepId !== "industry") return;
    requestAnimationFrame(() => {
      const now = nowSec();
      if (stepId === "industry") {
        snapshot.refineryGuideStarted = true;
        return;
      }
      if (!Client.stationOpen || !isStationHangarTabActive()) return;
      if (stepId === "hangar-turrets") {
        if (!snapshot.hangarTabActive) {
          snapshot.hangarTabActive = true;
          snapshot.hangarCombatPhase = 0;
          snapshot.hangarCombatPhaseAt = now;
        }
      } else {
        beginHangarReviewTour(now);
      }
      snapshot.hangarReviewStarted = true;
      emit("tutorial:hangar-tour-change");
    });
  });
  on("station:close", () => {
    const stepId = getCurrentTutorialStep(getState().player)?.id;
    if (stepId !== "hangar-high" && stepId !== "hangar-turrets" && stepId !== "industry") return;
    if (stepId === "industry") {
      snapshot.industryTabActive = false;
      return;
    }
    snapshot.hangarTabActive = false;
    clearHangarTutorialGuide();
    markHangarStepComplete(stepId === "hangar-turrets");
  });
}

function buildCtx() {
  return buildTutorialCtx(nowSec(), getState().player.tutorial.stepEnteredAt ?? nowSec(), snapshot, getState().player);
}

function syncTutorialStateToServer() {
  queueFrameAction({
    type: "syncTutorialStep",
    payload: { ...getState().player.tutorial },
  });
}

export function initTutorial() {
  if (!getState().player.tutorial.active) return;
  bindTutorialEvents();
  ensureTutorialRegionsDiscovered(getState().player);
  resetTutorialTrackState(getState().player);
  if (getState().player.sysIdx === 0 && getState().player.tutorial.step === 0 && shouldRelocateTutorialStart(getState().player.x, getState().player.y)) {
    PlayerAccess.updatePhysics({
      x: TUTORIAL_SPAWN.x,
      y: TUTORIAL_SPAWN.y,
      px: TUTORIAL_SPAWN.x,
      py: TUTORIAL_SPAWN.y,
    });
  }
  snapshot = {};
  if (!getState().player.tutorial.stepEnteredAt) {
    PlayerAccess.setTutorialStepEnteredAt(nowSec());
  }
  const step = TUTORIAL_STEPS[getState().player.tutorial.step];
  step?.onEnter?.(buildCtx());
  if (step?.id === "fly-gate" || step?.id === "graduation") setTutorialGatePulse(1);
  ensureTutorialMission();
  syncTutorialMissionProgress(getState().player);
  emit("tutorial:step-change", { step: getState().player.tutorial.step });
  syncTutorialStateToServer();
}

export function isCurrentStepComplete(): boolean {
  if (!getState().player?.tutorial?.active) return false;
  const step = getCurrentTutorialStep(getState().player);
  if (!step) return false;
  return step.isComplete(buildCtx());
}

export function getTutorialSnapshot(): Record<string, unknown> {
  return snapshot;
}

function hangarTourPhaseKey(stepId: string): string {
  return stepId === "hangar-turrets" ? "hangarCombatPhase" : "hangarReviewPhase";
}

function hangarTourMaxPhase(stepId: string): number {
  return stepId === "hangar-turrets"
    ? HANGAR_COMBAT_SWAP_PHASE_COUNT - 1
    : HANGAR_REVIEW_PHASE_COUNT - 1;
}

export function canAdvanceHangarTour(): boolean {
  const step = getCurrentTutorialStep(getState().player);
  if (!step || (step.id !== "hangar-high" && step.id !== "hangar-turrets")) return false;
  if (!Client.stationOpen || snapshot.hangarReviewComplete === true) return false;
  const phaseKey = hangarTourPhaseKey(step.id);
  const phase = typeof snapshot[phaseKey] === "number" ? snapshot[phaseKey] as number : 0;
  return phase < hangarTourMaxPhase(step.id);
}

export function advanceHangarTutorialPanel(): void {
  const step = getCurrentTutorialStep(getState().player);
  if (!step || !canAdvanceHangarTour()) return;
  const phaseKey = hangarTourPhaseKey(step.id);
  const phase = typeof snapshot[phaseKey] === "number" ? snapshot[phaseKey] as number : 0;
  snapshot[phaseKey] = phase + 1;
  emit("tutorial:hangar-tour-change");
}

export function canAdvanceHudTour(): boolean {
  const step = getCurrentTutorialStep(getState().player);
  if (!step || step.id !== "hud-tour") return false;
  const phase = typeof snapshot.hudTourPhase === "number" ? snapshot.hudTourPhase : 0;
  return phase < 5;
}

export function advanceHudTour(): void {
  const step = getCurrentTutorialStep(getState().player);
  if (!step || !canAdvanceHudTour()) return;
  const phase = typeof snapshot.hudTourPhase === "number" ? snapshot.hudTourPhase : 0;
  snapshot.hudTourPhase = phase + 1;
  if (snapshot.hudTourPhase === 5) {
    snapshot.hudTourComplete = true;
  }
  emit("tutorial:hud-tour-change");
}

export function canAdvanceRefineryTour(): boolean {
  const step = getCurrentTutorialStep(getState().player);
  if (!step || step.id !== "industry") return false;
  if (!Client.stationOpen || snapshot.refineryGuideComplete === true) return false;
  const phase = typeof snapshot.refineryGuidePhase === "number" ? snapshot.refineryGuidePhase : 0;
  return phase < REFINERY_GUIDE_PHASE_COUNT - 1;
}

export function advanceRefineryTutorialPanel(): void {
  const step = getCurrentTutorialStep(getState().player);
  if (!step || !canAdvanceRefineryTour()) return;
  const phase = typeof snapshot.refineryGuidePhase === "number" ? snapshot.refineryGuidePhase : 0;
  snapshot.refineryGuidePhase = phase + 1;
  emit("tutorial:refinery-tour-change");
}

export function tickTutorial(_dt: number) {
  if (!getState().player?.tutorial?.active) return;

  const step = getCurrentTutorialStep(getState().player);
  if (!step) return;

  const ctx = buildCtx();
  const now = nowSec();

  if (step.zone && ctx.inZone(step.zone)) {
    snapshot.zoneReached = true;
  }

  if (step.id === "fly-academy") {
    const visited = (snapshot.visitedZones as string[] | undefined) ?? [];
    for (const reg of TUTORIAL_LOCAL_REGIONS) {
      if (visited.includes(reg.id)) continue;
      if (ctx.inZone({ x: reg.x, y: reg.y, r: reg.r })) {
        visited.push(reg.id);
        snapshot.visitedZones = visited;
        logEvent(`Entering ${reg.name}`, "system");
      }
    }
  }

  if (step.id === "fly-gate" || step.id === "graduation") {
    setTutorialGatePulse(0.6 + 0.4 * Math.sin(now * 4));
  }

  if (step.id === "graduation" && step.isComplete(ctx)) {
    completeTutorial(false);
    return;
  }

  if (step.id === "hangar-high") {
    if (!Client.stationOpen) {
      snapshot.hangarTabActive = false;
      markHangarReviewComplete();
    } else if (isStationHangarTabActive()) {
      beginHangarReviewTour(now);
    }
  }

  if (step.id === "hangar-turrets") {
    if (!Client.stationOpen) {
      snapshot.hangarTabActive = false;
      markHangarStepComplete(true);
    } else if (isStationHangarTabActive()) {
      if (!snapshot.hangarTabActive) {
        snapshot.hangarTabActive = true;
        snapshot.hangarCombatPhase = 0;
        snapshot.hangarCombatPhaseAt = now;
      }
      snapshot.hangarReviewStarted = true;
    }
  }

  if (step.id === "industry") {
    if (!Client.stationOpen) {
      snapshot.industryTabActive = false;
    } else {
      const industryTabActive = document.getElementById("panel-industry")?.classList.contains("active") ?? false;
      snapshot.industryTabActive = industryTabActive;
      if (industryTabActive) {
        snapshot.refineryGuideStarted = true;
      }
    }
  }
}

export function goBackStep() {
  const stepIdx = getState().player.tutorial.step;
  if (stepIdx <= 0) return;

  const leavingGraduation = TUTORIAL_STEPS[stepIdx]?.id === "graduation"
    || TUTORIAL_STEPS[stepIdx]?.id === "fly-gate";
  const prevIdx = stepIdx - 1;

  PlayerAccess.setTutorialStep(prevIdx);
  PlayerAccess.setTutorialStepEnteredAt(nowSec());
  snapshot = {};
  resetTutorialTrackState(getState().player);
  const prev = TUTORIAL_STEPS[prevIdx];
  prev.onEnter?.(buildCtx());

  if (prev.id === "fly-gate" || prev.id === "graduation") setTutorialGatePulse(1);
  else if (leavingGraduation) setTutorialGatePulse(0);

  emit("tutorial:step-change", { step: prevIdx });
  syncTutorialMissionProgress(getState().player);
  savePlayer();
  syncTutorialStateToServer();
}

export function advanceStep() {
  if (!isCurrentStepComplete()) {
    const step = getCurrentTutorialStep(getState().player);
    if (step?.zone) {
      logEvent("Hold position at the objective to continue", "system");
      floatText(getState().player.x, getState().player.y - 38, "Return to objective area", "#cc8844");
    }
    return;
  }

  const stepIdx = getState().player.tutorial.step;
  const step = TUTORIAL_STEPS[stepIdx];
  if (!step) return;

  logEvent(`Step complete: ${step.title}`, "system");
  floatText(getState().player.x, getState().player.y - 40, `${step.title} — complete`, "#88ccff");

  grantTutorialStepReward(step.id);
  step.onComplete?.(buildCtx());
  emit("tutorial:step-complete", { step: stepIdx, id: step.id });

  const nextIdx = stepIdx + 1;
  if (nextIdx >= TUTORIAL_STEP_COUNT) {
    completeTutorial(false);
    return;
  }

  PlayerAccess.setTutorialStep(nextIdx);
  PlayerAccess.setTutorialStepEnteredAt(nowSec());
  snapshot = {};
  resetTutorialTrackState(getState().player);
  const next = TUTORIAL_STEPS[nextIdx];
  next.onEnter?.(buildCtx());
  if (next.id === "fly-gate" || next.id === "graduation") setTutorialGatePulse(1);
  syncTutorialMissionProgress(getState().player);
  emit("tutorial:step-change", { step: nextIdx });
  savePlayer();
  syncTutorialStateToServer();
}

export function completeTutorial(fromSkip: boolean) {
  const primeIdx = getNovusPrimeIdx();
  finalizeTutorialMission(fromSkip);
  PlayerAccess.setTutorialComplete();
  if (fromSkip) PlayerAccess.setTutorialSkipped();
  if (primeIdx >= 0) PlayerAccess.setHomeSysIdx(primeIdx);
  setTutorialGatePulse(0);
  resetTutorialTrackState(getState().player);
  if (!fromSkip) {
    floatText(getState().player.x, getState().player.y - 55, "Training complete — Welcome to Novus Prime", "#66aaff");
    logEvent("Training complete. Welcome to Novus Prime.", "system");
  }
  emit(fromSkip ? "tutorial:skip" : "tutorial:complete", { sysIdx: primeIdx });
  savePlayer();
  syncTutorialStateToServer();
}

export function skipTutorial() {
  const primeIdx = getNovusPrimeIdx();
  // Mark tutorial as completed/skipped immediately so the state is persisted
  // even if the player exits before the next server tick processes the warp.
  finalizeTutorialMission(true);
  PlayerAccess.setTutorialComplete();
  PlayerAccess.setTutorialSkipped();
  if (primeIdx >= 0) PlayerAccess.setHomeSysIdx(primeIdx);
  setTutorialGatePulse(0);
  resetTutorialTrackState(getState().player);
  emit("tutorial:skip", { sysIdx: primeIdx });
  savePlayer();

  if (primeIdx < 0) {
    return;
  }

  queueFrameAction({ type: "skipTutorial", payload: { primeIdx } });
  logEvent("Tutorial skip requested. Awaiting server confirmation.", "system");
  floatText(getState().player.x, getState().player.y - 55, "Skip request uplinked", "#66aaff");
}

