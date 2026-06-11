/** Mutable shared snapshot for the tutorial system.
 *  Typed fields are known keys; index signature preserves dynamic access for tour phase keys.
 */
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

export let snapshot: TutorialSnapshot = {};
export let tutorialEventsBound = false;

export function setSnapshot(next: TutorialSnapshot): void {
  snapshot = next;
}

export function setTutorialEventsBound(next: boolean): void {
  tutorialEventsBound = next;
}

/** Convenience accessor for typed fields. */
export function getSnapshotField<K extends keyof TutorialSnapshot>(key: K): TutorialSnapshot[K] {
  return snapshot[key];
}

/** Convenience setter for typed fields. */
export function setSnapshotField<K extends keyof TutorialSnapshot>(key: K, value: TutorialSnapshot[K]): void {
  snapshot[key] = value;
}
