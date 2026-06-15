import { Client } from "../../state.js";
import { getState } from "../../state-access.js";
import { logEvent } from "../../feedback.js";
import { t } from "../../utils/i18n.js";
import { setTutorialGatePulse, getCurrentTutorialStep, isStationHangarTabActive } from "../data/helpers.js";
import { TUTORIAL_LOCAL_REGIONS } from "../data/layout.js";
import { snapshot } from "./snapshot.js";
import { buildCtx, nowSec } from "./context.js";
import { advanceStep, completeTutorial } from "./lifecycle.js";
import { beginHangarReviewTour, markHangarStepComplete } from "./hangar.js";
import type { TutorialStep } from "../types.js";

// ── Step-specific tick handlers ─────────────────────────────────────────────

const STEP_HANDLERS: Record<string, (step: TutorialStep, now: number) => void | boolean> = {
  "piloting-choice"() {
    const moved = Client.keys["w"] || Client.keys["a"] || Client.keys["s"] || Client.keys["d"];
    if (moved || Client.waypoint !== null) snapshot.pilotingTried = true;
  },

  "boost-try"() {
    if (Client.keys["boost"]) snapshot.boostUsed = true;
  },

  "fly-academy"() {
    const visited: string[] = (snapshot.visitedZones as string[] | undefined) ?? [];
    for (const reg of TUTORIAL_LOCAL_REGIONS) {
      if (visited.includes(reg.id)) continue;
      const dx = getState().player.x - reg.x;
      const dy = getState().player.y - reg.y;
      if (dx * dx + dy * dy < reg.r * reg.r) {
        visited.push(reg.id);
        snapshot.visitedZones = visited;
        logEvent(t("system.enteringRegion", { name: reg.name }), "system");
      }
    }
  },

  "hangar-high"(_step, now) {
    if (!Client.stationOpen) {
      snapshot.hangarTabActive = false;
      markHangarStepComplete(false);
    } else if (isStationHangarTabActive()) {
      beginHangarReviewTour(now);
    }
  },

  "hangar-turrets"(_step, now) {
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
  },

  "industry"() {
    if (!Client.stationOpen) {
      snapshot.industryTabActive = false;
      return;
    }
    const active = document.getElementById("panel-industry")?.classList.contains("active") ?? false;
    snapshot.industryTabActive = active;
    if (active) snapshot.refineryGuideStarted = true;
  },
};

// ── Public entry point ─────────────────────────────────────────────────────

export function tickTutorial(_dt: number) {
  const player = getState().player;
  if (!player?.tutorial?.active) return;

  const step = getCurrentTutorialStep(player);
  if (!step) return;

  // Shared zone-reached latch (avoids creating a full TutorialCtx unless needed)
  if (step.zone) {
    const dx = player.x - step.zone.x;
    const dy = player.y - step.zone.y;
    if (dx * dx + dy * dy < step.zone.r * step.zone.r) {
      snapshot.zoneReached = true;
    }
  }

  // Gate pulse for specific steps
  if (step.id === "fly-gate" || step.id === "graduation") {
    setTutorialGatePulse(0.6 + 0.4 * Math.sin(nowSec() * 4));
  }

  // Auto-complete graduation when criteria are met
  if (step.id === "graduation") {
    const ctx = buildCtx();
    if (step.isComplete(ctx)) {
      completeTutorial(false);
      return;
    }
  }

  // Run step-specific handler if one exists
  const handler = STEP_HANDLERS[step.id];
  if (handler) handler(step, nowSec());

  // Optional per-step auto-advance for guided flows that should not pause on Next.
  if (step.autoAdvanceOnComplete && step.isComplete(buildCtx())) {
    advanceStep();
  }
}
