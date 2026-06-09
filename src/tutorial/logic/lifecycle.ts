import { Client } from "../../state.js";
import { getState } from "../../state-access.js";
import { PlayerAccess } from "../../state-access.js";
import { emit } from "../../events.js";
import { savePlayer } from "../../player/player-data.js";
import { queueFrameAction } from "../../sim/input.js";
import { warpTo, undockStation } from "../../docking/index.js";
import { getNovusPrimeIdx } from "../../world/galaxy-build.js";
import { ensureTutorialRegionsDiscovered } from "../../world/map-discovery.js";
import { resetTutorialTrackState } from "../../physics/tutorial-track.js";
import { floatText } from "../../utils/fx.js";
import { logEvent } from "../../feedback.js";
import { t } from "../../utils/i18n.js";
import { TUTORIAL_SPAWN, shouldRelocateTutorialStart } from "../data/layout.js";
import {
  TUTORIAL_STEPS,
  TUTORIAL_STEP_COUNT,
  getCurrentTutorialStep,
  setTutorialGatePulse,
} from "../data/index.js";
import {
  ensureTutorialMission,
  grantTutorialStepReward,
  finalizeTutorialMission,
} from "../data/mission.js";
import { syncTutorialMissionProgress } from "../../data/missions.js";
import { snapshot, setSnapshot } from "./snapshot.js";
import { buildCtx, nowSec } from "./context.js";
import { syncTutorialStateToServer } from "./sync.js";
import { bindTutorialEvents } from "./events.js";

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
  setSnapshot({});
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

export function goBackStep() {
  const stepIdx = getState().player.tutorial.step;
  if (stepIdx <= 0) return;

  const leavingGraduation = TUTORIAL_STEPS[stepIdx]?.id === "graduation"
    || TUTORIAL_STEPS[stepIdx]?.id === "fly-gate";
  const prevIdx = stepIdx - 1;

  PlayerAccess.setTutorialStep(prevIdx);
  PlayerAccess.setTutorialStepEnteredAt(nowSec());
  setSnapshot({});
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
      logEvent(t("system.holdPosition"), "system");
      floatText(getState().player.x, getState().player.y - 38, t("system.returnToObjective"), "#cc8844");
    }
    return;
  }

  const stepIdx = getState().player.tutorial.step;
  const step = TUTORIAL_STEPS[stepIdx];
  if (!step) return;

  logEvent(t("system.stepComplete", { title: step.title }), "system");
  floatText(getState().player.x, getState().player.y - 40, t("system.stepCompleteFloat", { title: step.title }), "#88ccff");

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
  setSnapshot({});
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
    floatText(getState().player.x, getState().player.y - 55, t("system.trainingCompleteFloat"), "#66aaff");
    logEvent(t("system.trainingCompleteLog"), "system");
  }
  emit(fromSkip ? "tutorial:skip" : "tutorial:complete", { sysIdx: primeIdx });
  savePlayer();
  syncTutorialStateToServer();
}

export function skipTutorial() {
  const primeIdx = getNovusPrimeIdx();
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
  logEvent(t("system.skipRequestedLog"), "system");
  floatText(getState().player.x, getState().player.y - 55, t("system.skipRequestedFloat"), "#66aaff");
}
