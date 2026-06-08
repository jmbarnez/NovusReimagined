
import { PlayerAccess, getState } from "../state-access.js";
import { addSkillXp, addXp } from "../player/player-data.js";
import { logEvent } from "../feedback.js";
import type { SkillId } from "./skills.js";
import {
  createTutorialMission,
  findTutorialContract,
  syncTutorialMissionProgress,
  TUTORIAL_MISSION_ID,
  TUTORIAL_GRADUATION_REWARD,
  isTutorialContract,
} from "./missions.js";
import { TUTORIAL_STEP_COUNT } from "./tutorial.js";
import { t } from "../utils/i18n.js";

export interface TutorialStepReward {
  credits: number;
  skillId: SkillId;
  skillXp: number;
}

/** Per-step payouts when the player presses Next after completing a tutorial objective. */
export const TUTORIAL_STEP_REWARDS: Record<string, TutorialStepReward> = {
  "hud-tour":         { credits: 0,   skillId: "engineering", skillXp: 0 },
  "boost-try":        { credits: 100, skillId: "engineering", skillXp: 0 },
  "fly-academy":      { credits: 150, skillId: "engineering", skillXp: 0 },
  "hangar-high":      { credits: 200, skillId: "engineering", skillXp: 0 },
  "fly-mining":       { credits: 180, skillId: "engineering", skillXp: 0 },
  "targeting":        { credits: 200, skillId: "surveying",   skillXp: 0 },
  "mining":           { credits: 250, skillId: "mining",      skillXp: 0 },
  "fly-station":      { credits: 180, skillId: "engineering", skillXp: 0 },
  "industry":         { credits: 280, skillId: "refining",    skillXp: 0 },
  "hangar-turrets":   { credits: 220, skillId: "engineering", skillXp: 0 },
  "fly-gunnery":      { credits: 180, skillId: "ballistics",  skillXp: 0 },
  "gunnery":          { credits: 300, skillId: "ballistics",  skillXp: 0 },
  "fly-gate":         { credits: 200, skillId: "engineering", skillXp: 0 },
  "graduation":       { credits: 400, skillId: "engineering", skillXp: 0 },
};

export function ensureTutorialMission(): void {
  if (!getState().player?.tutorial?.active || getState().player.tutorial.completed || getState().player.tutorial.skipped) {
    removeTutorialContract();
    return;
  }
  const existing = findTutorialContract(getState().player);
  if (!existing) {
    PlayerAccess.addContract(createTutorialMission(getState().player.tutorial.step, TUTORIAL_STEP_COUNT));
    return;
  }
  syncTutorialMissionProgress(getState().player);
}

export function grantTutorialStepReward(stepId: string): void {
  const reward = TUTORIAL_STEP_REWARDS[stepId];
  if (!reward) return;
  if (reward.credits > 0) {
    PlayerAccess.modifyCredits(reward.credits);
    logEvent(t("tutorial.missionReward", { credits: reward.credits }), "loot");
  }
  if (reward.skillXp > 0) {
    addSkillXp(reward.skillId, reward.skillXp, getState().player);
  }
}

export function removeTutorialContract(): void {
  if (!getState().player?.contracts) return;
  const idx = getState().player.contracts.findIndex(c => c.id === TUTORIAL_MISSION_ID);
  if (idx >= 0) PlayerAccess.removeContract(idx);
}

export function finalizeTutorialMission(fromSkip: boolean): void {
  const contract = findTutorialContract(getState().player);
  if (!fromSkip && contract) {
    PlayerAccess.modifyCredits(TUTORIAL_GRADUATION_REWARD);
    logEvent(t("tutorial.missionComplete", { credits: TUTORIAL_GRADUATION_REWARD }), "loot");
    
    // Grant Player Level XP and Skill XP upon normal graduation completion
    addXp(500, getState().player);
    addSkillXp("engineering", 1000, getState().player);
    addSkillXp("ballistics", 500, getState().player);
    addSkillXp("mining", 500, getState().player);
  }
  removeTutorialContract();
}

export function getTutorialMissionForHud() {
  if (!getState().player?.tutorial?.active || getState().player.tutorial.completed || getState().player.tutorial.skipped) return null;
  const contract = findTutorialContract(getState().player);
  if (!contract || !isTutorialContract(contract)) return null;
  syncTutorialMissionProgress(getState().player);
  return contract;
}
