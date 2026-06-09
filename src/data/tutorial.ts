import { Client, type Player } from "../state.js";
import { dst } from "../utils/math.js";
import { getNovusPrimeIdx } from "../world/galaxy-build.js";
import type { Gate } from "../types/world.js";
import {
  getTutorialTrackById,
  trackTotalArcLength,
  trackArcLengthProgress,
} from "./tutorial-layout.js";
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

export function getTourPanel(
  step: TutorialStep | null,
  snapshot: Record<string, unknown> = {},
): { label: string; body: string; index: number; total: number } | null {
  if (!step?.tour) return null;
  const phase = typeof snapshot[step.tour.phaseKey] === "number" ? snapshot[step.tour.phaseKey] as number : 0;
  const panel = step.tour.phases[phase];
  if (!panel) return null;
  return { label: panel.label, body: panel.body, index: phase + 1, total: step.tour.phases.length };
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

/** Novus Prime warp gate in sys-0 — visible early, warp-locked until graduation. */
export function isTutorialExitGate(g: Gate, sysIdx: number): boolean {
  const primeIdx = getNovusPrimeIdx();
  return sysIdx === 0 && primeIdx >= 0 && g.target.label === `sector-${primeIdx}`;
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
  void g;
  void sysIdx;
  void p;
  return true;
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
