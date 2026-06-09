// Compatibility shim — re-exports from the new tutorial/data layer.
export {
  TUTORIAL_STEP_REWARDS,
  ensureTutorialMission,
  grantTutorialStepReward,
  removeTutorialContract,
  finalizeTutorialMission,
  getTutorialMissionForHud,
} from "../tutorial/data/mission.js";
export type { TutorialStepReward } from "../tutorial/data/mission.js";
