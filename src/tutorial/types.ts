import type { Player } from "../state.js";

export interface TutorialZone {
  x: number;
  y: number;
  r: number;
}

export interface TutorialSnapshot extends Record<string, unknown> {
  pilotingTried?: boolean;
  boostUsed?: boolean;
  zoneReached?: boolean;
  visitedZones?: string[];
  trackProgressTotal?: number;
  minerInHigh?: boolean;
  hangarReviewPhase?: number;
  hangarReviewPhaseAt?: number;
  hangarReviewStarted?: boolean;
  hangarReviewComplete?: boolean;
  hangarTabActive?: boolean;
  hangarCombatPhase?: number;
  hangarCombatPhaseAt?: number;
  ore?: number;
  dummyCount?: number;
  craftQueue?: number;
  hubQueue?: number;
  materialVolume?: number;
  refineryMaterialVolume?: number;
  refineryGuidePhase?: number;
  refineryGuideStarted?: boolean;
  refineryGuideComplete?: boolean;
  industryTabActive?: boolean;
  sysIdx?: number;
}

export interface TutorialCtx {
  player: Player;
  now: number;
  stepEnteredAt: number;
  snapshot: TutorialSnapshot;
  patchSnapshot: (next: Partial<TutorialSnapshot>) => void;
  setSnapshotField: <K extends keyof TutorialSnapshot>(key: K, value: TutorialSnapshot[K]) => void;
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
  /** Optional fixed world point for the off-screen guide arrow. Overrides the zone fallback. */
  guideTarget?: { x: number; y: number };
  highlight?: string;
  tour?: TutorialTour;
  stationTourGroup?: "hangar" | "industry";
  noDimmer?: boolean;
  noCardAnchor?: boolean;
  forceIndustryQueueRail?: boolean;
  autoAdvanceOnComplete?: boolean;
  autoCompleteTourOnLastPhase?: boolean;
  gatePulse?: boolean;
  revealsTutorialExitGate?: boolean;
  allowsTutorialExitWarp?: boolean;
  nextButtonTextKey?: "tutorial.next" | "tutorial.graduate";
  completesTutorialOnComplete?: boolean;
  isComplete: (ctx: TutorialCtx) => boolean;
  onEnter?: (ctx: TutorialCtx) => void;
  onComplete?: (ctx: TutorialCtx) => void;
}
