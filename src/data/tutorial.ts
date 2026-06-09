export type {
  TutorialZone,
  TutorialCtx,
  TutorialNavTarget,
  TutorialStep,
} from "../tutorial/types.js";

export {
  TUTORIAL_STEP_COUNT,
  findStep,
  isZoneStepComplete,
  initTrackProgress,
  buildTutorialCtx,
  getTutorialStepObjective,
  getTourPanel,
  isStationHangarTabActive,
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
} from "../tutorial/data/helpers.js";

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
} from "../tutorial/data/bypass.js";

export {
  TUTORIAL_STEPS,
} from "../tutorial/data/steps.js";

export {
  HUD_TOUR_PHASES,
  HANGAR_REVIEW_TOUR,
  HANGAR_COMBAT_SWAP_TOUR,
  REFINERY_TOUR,
} from "../tutorial/data/phases.js";

export {
  TUTORIAL_SUN_DIR,
  TUTORIAL_SECTOR,
  TUTORIAL_STATION,
  TUTORIAL_HUB,
  TUTORIAL_APPROACH_TARGET,
  getTutorialSunWorldPos,
  TUTORIAL_SPAWN,
  shouldRelocateTutorialStart,
  TUTORIAL_FLIGHT_DECK,
  TUTORIAL_FLIGHT_DECK_R,
  TUTORIAL_BELT_CENTER,
  TUTORIAL_MINING_ZONE_R,
  TUTORIAL_GUNNERY_CENTER,
  TUTORIAL_TRAINING_SITE_X,
  TUTORIAL_TRAINING_SITE_Y,
  TUTORIAL_GATE,
  TUTORIAL_LOCAL_REGIONS,
  TUTORIAL_TRACKS,
  TUTORIAL_BOOST_GATES,
  getTutorialTrackById,
  getActiveTutorialTracks,
  getTutorialTrackForNav,
  trackTotalArcLength,
  distToTrack,
  trackArcLengthProgress,
  getBoostGatesForTrack,
  getBoostPadsForTrack,
  getBoostGatesForStep,
  getBoostPadsForStep,
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
} from "../tutorial/data/layout.js";

export {
  tutorialBarKey,
  tutorialBarKeyStyled,
  tutorialKey,
  tutorialKeyStyled,
  resolveTutorialGateHint,
  type TutorialGateHintKey,
} from "../tutorial/data/controls.js";

export {
  TUTORIAL_TRAINING_SITE_ID,
  TUTORIAL_TRAINING_SITE_TYPE,
} from "../tutorial/data/site.js";

export {
  TUTORIAL_STEP_REWARDS,
  ensureTutorialMission,
  grantTutorialStepReward,
  removeTutorialContract,
  finalizeTutorialMission,
  getTutorialMissionForHud,
} from "../tutorial/data/mission.js";
