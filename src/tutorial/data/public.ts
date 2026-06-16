export type {
  TutorialZone,
  TutorialCtx,
  TutorialNavTarget,
  TutorialStep,
} from "../types.js";

export {
  TUTORIAL_STEP_COUNT,
  findStep,
  isZoneStepComplete,
  initTrackProgress,
  buildTutorialCtx,
  getTutorialStepObjective,
  getTourPanel,
  isStationHangarTabActive,
  isStationTourStep,
  getCurrentTutorialStep,
  isTutorialExitGate,
  isTutorialExitGateRevealed,
  canWarpThroughTutorialExitGate,
  shouldShowWarpGate,
  canWarpThroughGate,
  tutorialGatePulse,
  setTutorialGatePulse,
  getTutorialNavProgress,
  getTutorialNavRemainingM,
} from "./helpers.js";

export {
  totalOre,
  hasLockOnAsteroid,
  countAliveTargetDummiesInZone,
  getTrainingSite,
  isTrainingSiteResolved,
  isTrainingSiteComplete,
  isModuleFitted,
  hasCombatLoadout as hasTutorialCombatLoadout,
  hasBypassedMining,
  hasBypassedIndustry,
  hasBypassedHangarTurrets,
  hasBypassedGunnery,
} from "./bypass.js";

export { TUTORIAL_STEPS } from "./steps.js";

export {
  HUD_TOUR_PHASES,
  HANGAR_REVIEW_TOUR,
  HANGAR_COMBAT_SWAP_TOUR,
  REFINERY_TOUR,
} from "./phases.js";

export {
  TUTORIAL_SUN_DIR,
  TUTORIAL_SECTOR,
  TUTORIAL_STATION,
  TUTORIAL_HUB,
  getTutorialSunWorldPos,
  TUTORIAL_SPAWN,
  shouldRelocateTutorialStart,
  TUTORIAL_BELT_RING_CENTER,
  TUTORIAL_BELT_RING_RADIUS,
  TUTORIAL_BELT_THICKNESS,
  TUTORIAL_BELT_CENTER,
  TUTORIAL_MINING_ZONE_R,
  TUTORIAL_GUNNERY_CENTER,
  TUTORIAL_TRAINING_SITE_X,
  TUTORIAL_TRAINING_SITE_Y,
  TUTORIAL_GATE,
  TUTORIAL_LOCAL_REGIONS,
  TUTORIAL_TRACKS,
  getTutorialTrackById,
  getActiveTutorialTracks,
  getTutorialTrackForNav,
  trackTotalArcLength,
  distToTrack,
  trackArcLengthProgress,
  snapToTrackCenterline,
  tutorialRegionZone,
  tutorialRegionByStep,
  getGateControlHint,
  gatePillarPositions,
  detectGateCrossing,
  type TutorialLocalRegion,
  type TutorialTrackSegment,
  type TutorialBoostGate,
  type TrackProximity,
} from "./layout.js";

export {
  tutorialBarKey,
  tutorialBarKeyStyled,
  tutorialKey,
  tutorialKeyStyled,
  resolveTutorialGateHint,
  type TutorialGateHintKey,
} from "./controls.js";

export {
  TUTORIAL_TRAINING_SITE_ID,
  TUTORIAL_TRAINING_SITE_TYPE,
} from "./site.js";

export {
  TUTORIAL_STEP_REWARDS,
  ensureTutorialMission,
  grantTutorialStepReward,
  removeTutorialContract,
  finalizeTutorialMission,
  getTutorialMissionForHud,
} from "./mission.js";
