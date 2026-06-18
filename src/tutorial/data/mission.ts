import { PlayerAccess, getState } from "../../state-access.js";
import { addSkillXp, addXp } from "../../player/player-data.js";
import { logEvent } from "../../feedback.js";
import type { SkillId } from "../../data/skills.js";
import {
  isTutorialContract,
  TUTORIAL_ACADEMY_STATION_ID,
  TUTORIAL_GRADUATION_REWARD,
  type MissionContract,
} from "../../data/missions.js";
import { t } from "../../utils/i18n.js";
import { TUTORIAL_STEP_COUNT } from "./helpers.js";

export interface TutorialStepReward {
  credits: number;
  skillId: SkillId;
  skillXp: number;
}

export const TUTORIAL_STEP_REWARDS: Record<string, TutorialStepReward> = {
  "piloting-choice":  { credits: 0,  skillId: "engineering", skillXp: 0 },
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

export interface TutorialMissionDef {
  id: string;
  title: string;
  description: string;
  firstStep: number;
  lastStep: number;
  reward: number;
  icon: string;
}

export const TUTORIAL_MISSION_CHAIN: readonly TutorialMissionDef[] = [
  {
    id: "mc_getting_started",
    title: "Getting Started",
    description: "Learn basic piloting and fly to the Academy.",
    firstStep: 0,
    lastStep: 2,
    reward: 250,
    icon: "▲",
  },
  {
    id: "mc_tutorial_hangar",
    title: "Hangar & Mining",
    description: "Review your ship, mine ore, and return to the Academy.",
    firstStep: 3,
    lastStep: 7,
    reward: 600,
    icon: "⛏",
  },
  {
    id: "mc_tutorial_refinery",
    title: "Refinery Training",
    description: "Refine the ore you mined at the Academy hub.",
    firstStep: 8,
    lastStep: 8,
    reward: 400,
    icon: "◈",
  },
  {
    id: "mc_tutorial_combat",
    title: "Combat Training",
    description: "Fit weapons and destroy target drones.",
    firstStep: 9,
    lastStep: 11,
    reward: 700,
    icon: "⌖",
  },
  {
    id: "mc_tutorial_graduation",
    title: "Graduation",
    description: "Warp to Novus Prime and complete your training.",
    firstStep: 12,
    lastStep: 13,
    reward: 2500,
    icon: "★",
  },
];

export const TUTORIAL_MISSION_IDS = TUTORIAL_MISSION_CHAIN.map((m) => m.id);
export const TUTORIAL_MISSION_ID = TUTORIAL_MISSION_CHAIN[0]!.id;

function getMissionDefById(id: string): TutorialMissionDef | undefined {
  return TUTORIAL_MISSION_CHAIN.find((m) => m.id === id);
}

function getMissionDefForStep(step: number): TutorialMissionDef | undefined {
  return TUTORIAL_MISSION_CHAIN.find((m) => step >= m.firstStep && step <= m.lastStep);
}

export function getTutorialMissionStepCounter(step: number): { n: number; total: number } {
  const def = getMissionDefForStep(step);
  if (!def) return { n: step + 1, total: TUTORIAL_STEP_COUNT };
  return {
    n: step - def.firstStep + 1,
    total: def.lastStep - def.firstStep + 1,
  };
}

export function createTutorialMission(def: TutorialMissionDef, currentStep: number): MissionContract {
  const required = def.lastStep - def.firstStep + 1;
  const current = Math.max(0, Math.min(currentStep - def.firstStep, required));
  return {
    id: def.id,
    type: "tutorial",
    title: def.title,
    description: def.description,
    reward: def.reward,
    stationId: TUTORIAL_ACADEMY_STATION_ID,
    sysIdx: 0,
    objective: {
      type: "tutorial",
      target: "step",
      required,
      current,
    },
    status: "active",
  };
}

export function findTutorialContract(p = getState().player): MissionContract | undefined {
  return p.contracts?.find((c) => isTutorialContract(c));
}

export function findActiveTutorialMission(p = getState().player): MissionContract | undefined {
  return p.contracts?.find((c) => isTutorialContract(c) && c.status === "active");
}

export function findTutorialMissionById(id: string, p = getState().player): MissionContract | undefined {
  return p.contracts?.find((c) => c.id === id);
}

export function syncTutorialMissionProgress(p = getState().player): void {
  for (const c of p.contracts ?? []) {
    if (!isTutorialContract(c)) continue;
    const def = getMissionDefById(c.id);
    if (!def) continue;
    const required = def.lastStep - def.firstStep + 1;
    const current = Math.max(0, Math.min(p.tutorial.step - def.firstStep, required));
    c.objective.current = current;
    c.objective.required = required;
    c.status = current >= required ? "complete" : "active";
  }
}

export function ensureTutorialMission(): void {
  const player = getState().player;
  if (!player?.tutorial?.active || player.tutorial.completed || player.tutorial.skipped) {
    removeTutorialContract();
    return;
  }
  const active = findActiveTutorialMission(player);
  if (!active) {
    const def = getMissionDefForStep(player.tutorial.step);
    if (def) {
      PlayerAccess.addContract(createTutorialMission(def, player.tutorial.step));
    }
  }
  syncTutorialMissionProgress(player);
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
  for (let i = getState().player.contracts.length - 1; i >= 0; i--) {
    if (isTutorialContract(getState().player.contracts[i]!)) {
      PlayerAccess.removeContract(i);
    }
  }
}

export function finalizeTutorialMission(fromSkip: boolean): void {
  const active = findActiveTutorialMission();
  if (!fromSkip && active) {
    PlayerAccess.modifyCredits(TUTORIAL_GRADUATION_REWARD);
    logEvent(t("tutorial.missionComplete", { credits: TUTORIAL_GRADUATION_REWARD }), "loot");
    addXp(500, getState().player);
    addSkillXp("engineering", 1000, getState().player);
    addSkillXp("ballistics", 500, getState().player);
    addSkillXp("mining", 500, getState().player);
  }
  removeTutorialContract();
}

export function grantRemainingTutorialMissions(p = getState().player): void {
  if (!p?.tutorial?.active || p.tutorial.completed || p.tutorial.skipped) return;
  const step = p.tutorial.step;
  const first = TUTORIAL_MISSION_CHAIN[0]!;
  if (step < first.lastStep + 1) return;
  const ids = new Set((p.contracts ?? []).filter((c) => isTutorialContract(c)).map((c) => c.id));
  for (const def of TUTORIAL_MISSION_CHAIN) {
    if (def.id === first.id) continue;
    if (!ids.has(def.id)) {
      PlayerAccess.addContract(createTutorialMission(def, step), p);
    }
  }
  syncTutorialMissionProgress(p);
}

export function getTutorialMissionForHud() {
  const player = getState().player;
  if (!player?.tutorial?.active || player.tutorial.completed || player.tutorial.skipped) return null;
  const active = findActiveTutorialMission(player);
  if (!active) return null;
  syncTutorialMissionProgress(player);
  return active;
}

export function getAvailableTutorialMissionOffers(p = getState().player): MissionContract[] {
  const player = p;
  if (!player?.tutorial?.active || player.tutorial.completed || player.tutorial.skipped) return [];
  const activeOrCompleteIds = new Set(
    (player.contracts ?? [])
      .filter((c) => isTutorialContract(c))
      .map((c) => c.id)
  );
  const step = player.tutorial.step;
  return TUTORIAL_MISSION_CHAIN
    .filter((m) => !activeOrCompleteIds.has(m.id) && m.firstStep <= step)
    .map((m) => createTutorialMission(m, step));
}

export function hasRemainingTutorialMissions(): boolean {
  const player = getState().player;
  if (!player?.tutorial?.active || player.tutorial.completed || player.tutorial.skipped) return false;
  const activeOrCompleteIds = new Set(
    (player.contracts ?? [])
      .filter((c) => isTutorialContract(c))
      .map((c) => c.id)
  );
  const step = player.tutorial.step;
  return TUTORIAL_MISSION_CHAIN.some((m) => !activeOrCompleteIds.has(m.id) && m.firstStep <= step);
}
