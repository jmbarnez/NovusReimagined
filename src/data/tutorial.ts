import { Client, type Player } from "../state.js";
import { dst } from "../utils/math.js";
import { getNovusPrimeIdx } from "../world/galaxy-build.js";
import type { Gate } from "../types/world.js";
import {
  getTutorialTrackById,
  trackTotalArcLength,
  trackArcLengthProgress,
} from "./tutorial-layout.js";
import {
  getHangarGuidePanel,
  HANGAR_REVIEW_PHASE_COUNT,
  HANGAR_COMBAT_SWAP_PHASE_COUNT,
  getHangarReviewHint,
  getHangarCombatSwapHint,
} from "./hangar-tutorial-guide.js";
import { tutorialKey } from "./tutorial-controls.js";
import { t } from "../utils/i18n.js";
import {
  type TutorialZone,
  type TutorialCtx,
  type TutorialNavTarget,
  type TutorialStep,
  totalOre,
  hasLockOnAsteroid,
  hasCombatLoadout,
} from "./tutorial-bypass.js";
import { TUTORIAL_STEPS, isZoneStepComplete } from "./tutorial-steps.js";

export {
  HANGAR_REVIEW_PHASE_COUNT,
  HANGAR_COMBAT_SWAP_PHASE_COUNT,
  getHangarReviewHint,
  getHangarCombatSwapHint,
  getHangarGuidePanel,
};
export { TUTORIAL_TRAINING_SITE_ID } from "./tutorial-site.js";
export {
  type TutorialZone,
  type TutorialCtx,
  type TutorialNavTarget,
  type TutorialStep,
  totalOre,
  hasLockOnAsteroid,
  hasCombatLoadout as hasTutorialCombatLoadout,
} from "./tutorial-bypass.js";
export { TUTORIAL_STEPS, isZoneStepComplete } from "./tutorial-steps.js";

export const TUTORIAL_STEP_COUNT = TUTORIAL_STEPS.length;

export function getTutorialStepObjective(step: TutorialStep, snapshot: Record<string, unknown> = {}): string {
  return typeof step.objective === "function" ? step.objective(snapshot) : step.objective;
}

export const HUD_TOUR_PANELS = [
  {
    label: t("tutorial.hudTour.vitals.label"),
    body: t("tutorial.hudTour.vitals.body"),
  },
  {
    label: t("tutorial.hudTour.modules.label"),
    body: t("tutorial.hudTour.modules.body"),
  },
  {
    label: t("tutorial.hudTour.lockRail.label"),
    body: t("tutorial.hudTour.lockRail.body"),
  },
  {
    label: t("tutorial.hudTour.overview.label"),
    body: t("tutorial.hudTour.overview.body"),
  },
  {
    label: t("tutorial.hudTour.comms.label"),
    body: t("tutorial.hudTour.comms.body"),
  },
  {
    label: t("tutorial.hudTour.missions.label"),
    body: t("tutorial.hudTour.missions.body"),
  }
];

export function getHudTourPanel(
  step: TutorialStep | null,
  snapshot: Record<string, unknown> = {},
): { label: string; body: string; index: number; total: number } | null {
  if (!step || step.id !== "hud-tour") return null;
  const phase = typeof snapshot.hudTourPhase === "number" ? snapshot.hudTourPhase : 0;
  const panel = HUD_TOUR_PANELS[phase];
  if (!panel) return null;
  return {
    label: panel.label,
    body: panel.body,
    index: phase + 1,
    total: HUD_TOUR_PANELS.length,
  };
}

export function tutorialHangarHint(task: string): string {
  return t("tutorial.step.hangarHigh.objective", { dockKey: tutorialKey("dock") });
}

export function getHangarTourPanel(
  step: TutorialStep | null,
  snapshot: Record<string, unknown> = {},
): { label: string; body: string; index: number; total: number } | null {
  if (!step || (step.id !== "hangar-high" && step.id !== "hangar-turrets")) return null;
  if (!Client.stationOpen || snapshot.hangarReviewComplete === true) return null;
  const phaseKey = step.id === "hangar-turrets" ? "hangarCombatPhase" : "hangarReviewPhase";
  const phase = typeof snapshot[phaseKey] === "number" ? snapshot[phaseKey] as number : 0;
  const panel = getHangarGuidePanel(step.id, phase);
  if (!panel) return null;
  const total = step.id === "hangar-turrets"
    ? HANGAR_COMBAT_SWAP_PHASE_COUNT
    : HANGAR_REVIEW_PHASE_COUNT;
  return { label: panel.label, body: panel.body, index: phase + 1, total };
}

export function getTutorialStepHint(
  step: TutorialStep,
  snapshot: Record<string, unknown> = {},
): string {
  if (step.id === "hud-tour") {
    const phase = typeof snapshot.hudTourPhase === "number" ? snapshot.hudTourPhase : 0;
    return HUD_TOUR_PANELS[phase]?.body ?? "";
  }
  if (step.id === "hangar-high") {
    if (snapshot.hangarReviewComplete === true) {
      return t("tutorial.step.hangarHigh.complete");
    }
    if (!Client.stationOpen) {
      return tutorialHangarHint("begin the loadout walkthrough");
    }
    if (!isStationHangarTabActive()) {
      return t("tutorial.step.hangarHigh.hangarTabHint");
    }
    const phase = typeof snapshot.hangarReviewPhase === "number"
      ? snapshot.hangarReviewPhase
      : 0;
    return getHangarGuidePanel("hangar-high", phase)?.body ?? "";
  }
  if (step.id === "hangar-turrets") {
    if (snapshot.hangarReviewComplete === true) {
      return t("tutorial.step.hangarTurrets.complete");
    }
    if (!Client.stationOpen) {
      return tutorialHangarHint("swap in your combat loadout");
    }
    if (!isStationHangarTabActive()) {
      return t("tutorial.step.hangarHigh.hangarTabHint");
    }
    const phase = typeof snapshot.hangarCombatPhase === "number"
      ? snapshot.hangarCombatPhase
      : 0;
    return getHangarGuidePanel("hangar-turrets", phase)?.body ?? "";
  }
  if (!step.hint) return "";
  return typeof step.hint === "function" ? step.hint(snapshot) : step.hint;
}

export function isStationHangarTabActive(): boolean {
  if (!Client.stationOpen) return false;
  return document.getElementById("panel-hangar")?.classList.contains("active") ?? false;
}

export function buildTutorialCtx(
  now: number,
  stepEnteredAt: number,
  snapshot: Record<string, unknown>,
  player: Player,
): TutorialCtx {
  const ctx: TutorialCtx = {
    player,
    now,
    stepEnteredAt,
    snapshot,
    distToZone(zone) {
      return dst(player.x, player.y, zone.x, zone.y);
    },
    inZone(zone) {
      return dst(player.x, player.y, zone.x, zone.y) < zone.r;
    },
  };
  return ctx;
}

export function getCurrentTutorialStep(p: Player): TutorialStep | null {
  if (!p.tutorial?.active) return null;
  const step = p.tutorial.step;
  if (step < 0 || step >= TUTORIAL_STEPS.length) return null;
  return TUTORIAL_STEPS[step];
}

/** Novus Prime warp gate in sys-0 — hidden until the final tutorial approach. */
export function isTutorialExitGate(g: Gate, sysIdx: number): boolean {
  const primeIdx = getNovusPrimeIdx();
  return sysIdx === 0 && primeIdx >= 0 && g.targetSysIdx === primeIdx;
}

export function isTutorialExitGateRevealed(p: Player): boolean {
  if (p.sysIdx !== 0) return true;
  if (!p.tutorial?.active) return true;
  const step = getCurrentTutorialStep(p);
  return step?.id === "fly-gate" || step?.id === "graduation";
}

export function canWarpThroughTutorialExitGate(p: Player): boolean {
  if (!isTutorialExitGateRevealed(p)) return false;
  if (!p.tutorial?.active) return true;
  return getCurrentTutorialStep(p)?.id === "graduation";
}

export function shouldShowWarpGate(g: Gate, sysIdx: number, p: Player): boolean {
  if (!isTutorialExitGate(g, sysIdx)) return true;
  return isTutorialExitGateRevealed(p);
}

export function canWarpThroughGate(g: Gate, sysIdx: number, p: Player): boolean {
  if (!shouldShowWarpGate(g, sysIdx, p)) return false;
  if (!isTutorialExitGate(g, sysIdx)) return true;
  return canWarpThroughTutorialExitGate(p);
}

/** Gate pulse intensity for graduation step (0..1). */
export let tutorialGatePulse = 0;

export function setTutorialGatePulse(v: number) {
  tutorialGatePulse = v;
}

export function getTutorialNavProgress(step: TutorialStep | null, p: Player): number | null {
  if (!step?.nav) return null;
  const track = getTutorialTrackById(step.nav.trackId);
  if (!track) return null;
  return trackArcLengthProgress(track, p.x, p.y);
}

export function getTutorialNavRemainingM(step: TutorialStep | null, p: Player): number | null {
  if (!step?.nav) return null;
  const track = getTutorialTrackById(step.nav.trackId);
  if (!track) return null;
  const total = trackTotalArcLength(track);
  const progress = trackArcLengthProgress(track, p.x, p.y);
  const arcRemaining = Math.max(0, total * (1 - progress));
  if (step.zone) {
    const distToTarget = dst(p.x, p.y, step.nav.targetX, step.nav.targetY);
    const zoneEdgeRemaining = Math.max(0, distToTarget - step.zone.r);
    return Math.max(arcRemaining, zoneEdgeRemaining);
  }
  return arcRemaining;
}
