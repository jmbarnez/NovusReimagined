import { Client } from "../../state.js";
import { getState } from "../../state-access.js";
import { logEvent } from "../../feedback.js";
import { t } from "../../utils/i18n.js";
import { setTutorialGatePulse, getCurrentTutorialStep, isStationHangarTabActive } from "../data/helpers.js";
import { TUTORIAL_LOCAL_REGIONS } from "../data/layout.js";
import { getSnapshot, patchSnapshot } from "./snapshot.js";
import { buildCtx, nowSec } from "./context.js";
import { advanceStep, completeTutorial } from "./lifecycle.js";
import { beginHangarReviewTour, markHangarStepComplete } from "./hangar.js";
import type { TutorialStep } from "../types.js";

// ── Step-specific tick handlers ─────────────────────────────────────────────

const STEP_HANDLERS: Record<string, (step: TutorialStep, now: number) => void | boolean> = {
  "piloting-choice"() {
    const moved = Client.keys["w"] || Client.keys["a"] || Client.keys["s"] || Client.keys["d"];
    if (moved || Client.waypoint !== null) patchSnapshot({ pilotingTried: true });
  },

  "boost-try"() {
    if (Client.keys["boost"]) patchSnapshot({ boostUsed: true });
  },

  "fly-academy"() {
    const snapshot = getSnapshot();
    const visited: string[] = (snapshot.visitedZones as string[] | undefined) ?? [];
    for (const reg of TUTORIAL_LOCAL_REGIONS) {
      if (visited.includes(reg.id)) continue;
      const dx = getState().player.x - reg.x;
      const dy = getState().player.y - reg.y;
      if (dx * dx + dy * dy < reg.r * reg.r) {
        visited.push(reg.id);
        patchSnapshot({ visitedZones: visited });
        logEvent(t("system.enteringRegion", { name: reg.name }), "system");
      }
    }
  },

  "hangar-high"(_step, now) {
    if (!Client.stationOpen) {
      patchSnapshot({ hangarTabActive: false });
      markHangarStepComplete(false);
    } else if (isStationHangarTabActive()) {
      beginHangarReviewTour(now);
    }
  },

  "hangar-turrets"(_step, now) {
    const snapshot = getSnapshot();
    if (!Client.stationOpen) {
      patchSnapshot({ hangarTabActive: false });
      markHangarStepComplete(true);
    } else if (isStationHangarTabActive()) {
      if (!snapshot.hangarTabActive) {
        patchSnapshot({
          hangarTabActive: true,
          hangarCombatPhase: 0,
          hangarCombatPhaseAt: now,
        });
      }
      patchSnapshot({ hangarReviewStarted: true });
    }
  },

  "industry"() {
    if (!Client.stationOpen) {
      patchSnapshot({ industryTabActive: false });
      return;
    }
    const active = document.getElementById("panel-industry")?.classList.contains("active") ?? false;
    patchSnapshot({ industryTabActive: active });
    if (active) patchSnapshot({ refineryGuideStarted: true });
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
      patchSnapshot({ zoneReached: true });
    }
  }

  // Gate pulse for specific steps
  if (step.gatePulse) {
    setTutorialGatePulse(0.6 + 0.4 * Math.sin(nowSec() * 4));
  }

  // Auto-complete designated terminal steps when criteria are met.
  if (step.completesTutorialOnComplete) {
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
