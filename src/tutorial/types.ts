import type { Player } from "../state.js";

export interface TutorialZone {
  x: number;
  y: number;
  r: number;
}

export interface TutorialCtx {
  player: Player;
  now: number;
  stepEnteredAt: number;
  snapshot: Record<string, unknown>;
  distToZone: (zone: TutorialZone) => number;
  inZone: (zone: TutorialZone) => boolean;
}

export interface TutorialNavTarget {
  trackId: string;
  label: string;
  targetX: number;
  targetY: number;
}

export interface TutorialTourPhase {
  label: string;
  body: string;
  target: string;
  tab?: string;
}

export interface TutorialTour {
  phases: TutorialTourPhase[];
  phaseKey: string;
  completeKey: string;
}

export interface TutorialStep {
  id: string;
  title: string;
  objective: string | ((snapshot?: Record<string, unknown>) => string);
  zone: TutorialZone;
  beaconColor: number;
  nav?: TutorialNavTarget;
  highlight?: string;
  tour?: TutorialTour;
  noDimmer?: boolean;
  noCardAnchor?: boolean;
  autoAdvanceOnComplete?: boolean;
  isComplete: (ctx: TutorialCtx) => boolean;
  onEnter?: (ctx: TutorialCtx) => void;
  onComplete?: (ctx: TutorialCtx) => void;
}
