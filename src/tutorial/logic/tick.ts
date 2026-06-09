import { Client } from "../../state.js";
import { getState } from "../../state-access.js";
import { logEvent } from "../../feedback.js";
import { setTutorialGatePulse, getCurrentTutorialStep, isStationHangarTabActive } from "../data/helpers.js";
import { TUTORIAL_LOCAL_REGIONS } from "../data/layout.js";
import { snapshot } from "./snapshot.js";
import { buildCtx, nowSec } from "./context.js";
import { completeTutorial } from "./lifecycle.js";
import { beginHangarReviewTour, markHangarStepComplete } from "./hangar.js";

export function tickTutorial(_dt: number) {
  if (!getState().player?.tutorial?.active) return;

  const step = getCurrentTutorialStep(getState().player);
  if (!step) return;

  const ctx = buildCtx();
  const now = nowSec();

  if (step.zone && ctx.inZone(step.zone)) {
    snapshot.zoneReached = true;
  }

  if (step.id === "boost-try") {
    if (Client.keys["boost"]) {
      snapshot.boostUsed = true;
    }
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
      markHangarStepComplete(false);
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
