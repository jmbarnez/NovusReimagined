import { getState } from "../state-access.js";
import { emit } from "../events.js";
import { logEvent } from "../feedback.js";
import { t } from "../utils/i18n.js";
import type { Station } from "../types/world.js";
import type { Player } from "../state.js";

export type MissionType = "bounty" | "mining" | "delivery" | "salvage" | "tutorial";

export const TUTORIAL_MISSION_ID = "mc_academy_training";
export const TUTORIAL_ACADEMY_STATION_ID = "station-sys-0-academy-prime";
export const TUTORIAL_GRADUATION_REWARD = 2500;
const ACADEMY_PROGRAM_MINING_ID = "mc_academy_program_mining";
const ACADEMY_PROGRAM_REFINING_ID = "mc_academy_program_refining";
const ACADEMY_PROGRAM_GUNNERY_ID = "mc_academy_program_gunnery";

export interface MissionContract {
  id: string;
  type: MissionType;
  title: string;
  description: string;
  reward: number;
  stationId: string;
  sysIdx: number;
  objective: {
    type: MissionType;
    target: string;
    required: number;
    current: number;
  };
  status: "available" | "active" | "complete";
}

let _idCounter = 0;
function genId(): string {
  return `mc_${Date.now()}_${_idCounter++}`;
}

function rng(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Contract templates by ring ──────────────────────────────────────────────

const ORE_LABELS: Record<string, string> = {
  iron: "Iron Ore",
  nickel: "Nickel Ore",
  silicate: "Silicate Ore",
  carbon: "Carbonaceous Ore",
  crystal: "Crystal Ore",
  exotic: "Exotic Ore",
};
const LOOT_LABELS: Record<string, string> = { scrap: "Scrap Metal", chip: "Microchips", cell: "Power Cells" };
const ENEMY_LABELS: Record<string, string> = {
  rat_drone: "Mite Drones",
  rat: "Rats",
  drone: "Drones",
  pirate: "Pirates",
  raider: "Raiders",
};

function makeBounty(stationId: string, sysIdx: number, ring: number): MissionContract {
  const dangerTargets = ring <= 1
    ? (["rat_drone", "rat", "drone"] as const)
    : (["pirate", "raider", "drone"] as const);
  const target = pick([...dangerTargets]);
  const count = ring <= 1 ? rng(3, 6) : rng(4, 8);
  const rewardPer = ring <= 1 ? rng(180, 320) : rng(350, 700);
  const reward = count * rewardPer;
  return {
    id: genId(), type: "bounty", stationId, sysIdx,
    title: `Eliminate ${ENEMY_LABELS[target] ?? "Hostiles"}`,
    description: `Destroy ${count} ${ENEMY_LABELS[target] ?? target} in this system.`,
    reward,
    objective: { type: "bounty", target, required: count, current: 0 },
    status: "available",
  };
}

function makeMining(stationId: string, sysIdx: number, ring: number): MissionContract {
  const ores = ring <= 1
    ? (["iron", "iron", "nickel", "silicate", "crystal"] as const)
    : (["crystal", "exotic", "carbon", "nickel", "iron"] as const);
  const target = pick([...ores]);
  const count = ring <= 1 ? rng(20, 50) : rng(15, 35);
  const unitReward = target === "exotic" ? rng(30, 55) : target === "crystal" ? rng(18, 28) : rng(10, 16);
  const reward = count * unitReward;
  return {
    id: genId(), type: "mining", stationId, sysIdx,
    title: `Mine ${ORE_LABELS[target]}`,
    description: `Collect ${count} units of ${ORE_LABELS[target]}.`,
    reward,
    objective: { type: "mining", target, required: count, current: 0 },
    status: "available",
  };
}

function makeDelivery(stationId: string, sysIdx: number, ring: number): MissionContract {
  const goods = ring <= 1
    ? (["iron", "nickel", "silicate", "crystal", "scrap"] as const)
    : (["scrap", "chip", "cell", "crystal", "carbon"] as const);
  const target = pick([...goods]);
  const count = ring <= 1 ? rng(15, 40) : rng(10, 25);
  const label = ORE_LABELS[target] ?? LOOT_LABELS[target] ?? target;
  const unitReward = ring <= 1 ? rng(12, 22) : rng(28, 55);
  const reward = count * unitReward;
  return {
    id: genId(), type: "delivery", stationId, sysIdx,
    title: `Supply ${label}`,
    description: `Bring ${count}× ${label} to this station.`,
    reward,
    objective: { type: "delivery", target, required: count, current: 0 },
    status: "available",
  };
}

function makeSalvage(stationId: string, sysIdx: number, ring: number): MissionContract {
  const targets = ring <= 1
    ? (["scrap", "chip"] as const)
    : (["chip", "cell", "scrap"] as const);
  const target = pick([...targets]);
  const count = ring <= 1 ? rng(10, 25) : rng(8, 20);
  const unitReward = ring <= 1 ? rng(20, 35) : rng(45, 80);
  const reward = count * unitReward;
  const label = LOOT_LABELS[target] ?? target;
  return {
    id: genId(), type: "salvage", stationId, sysIdx,
    title: `Salvage ${label}`,
    description: `Collect ${count}× ${label} from wrecks.`,
    reward,
    objective: { type: "salvage", target, required: count, current: 0 },
    status: "available",
  };
}

function makeAcademyProgramContracts(stationId: string, sysIdx: number): MissionContract[] {
  return [
    {
      id: ACADEMY_PROGRAM_MINING_ID,
      type: "mining",
      title: "Academy Program: Mining Fundamentals",
      description: "Mine 30 units of Iron Ore in the outer belt and return to Academy Prime Station.",
      reward: 750,
      stationId,
      sysIdx,
      objective: { type: "mining", target: "iron", required: 30, current: 0 },
      status: "available",
    },
    {
      id: ACADEMY_PROGRAM_REFINING_ID,
      type: "delivery",
      title: "Academy Program: Refining Fundamentals",
      description: "Deliver 20 units of Iron Ore to Academy Prime Station for refinery intake drills.",
      reward: 820,
      stationId,
      sysIdx,
      objective: { type: "delivery", target: "iron", required: 20, current: 0 },
      status: "available",
    },
    {
      id: ACADEMY_PROGRAM_GUNNERY_ID,
      type: "bounty",
      title: "Academy Program: Gunnery Drills",
      description: "Destroy 3 target dummies in the training range.",
      reward: 980,
      stationId,
      sysIdx,
      objective: { type: "bounty", target: "target_dummy", required: 3, current: 0 },
      status: "available",
    },
  ];
}

export function generateContractsForStation(station: Station, sysIdx: number, ring: number): MissionContract[] {
  if (station.id === TUTORIAL_ACADEMY_STATION_ID) {
    return makeAcademyProgramContracts(station.id, sysIdx);
  }
  const contracts: MissionContract[] = [];
  if (ring <= 1) {
    contracts.push(makeMining(station.id, sysIdx, ring));
    contracts.push(makeMining(station.id, sysIdx, ring));
    contracts.push(makeDelivery(station.id, sysIdx, ring));
    contracts.push(makeBounty(station.id, sysIdx, ring));
  } else if (ring === 2) {
    contracts.push(makeBounty(station.id, sysIdx, ring));
    contracts.push(makeBounty(station.id, sysIdx, ring));
    contracts.push(makeSalvage(station.id, sysIdx, ring));
    contracts.push(makeDelivery(station.id, sysIdx, ring));
  } else {
    contracts.push(makeBounty(station.id, sysIdx, ring));
    contracts.push(makeBounty(station.id, sysIdx, ring));
    contracts.push(makeSalvage(station.id, sysIdx, ring));
  }
  return contracts;
}

// ── Progress tracking ────────────────────────────────────────────────────────

export function progressMissions(type: MissionType, amount: number, target?: string, p: Player = getState().player): void {
  if (!p?.contracts) return;
  for (const c of p.contracts) {
    if (isTutorialContract(c)) continue;
    if (c.status !== "active") continue;
    if (c.objective.type !== type) continue;
    if (target && c.objective.target !== "any" && c.objective.target !== target) continue;
    c.objective.current = Math.min(c.objective.current + amount, c.objective.required);
    if (c.objective.current >= c.objective.required) {
      c.status = "complete";
      if (p === getState().player) {
        emit("mission:completed", { contract: c });
        logEvent(t("system.contractComplete", { title: c.title, reward: c.reward }), "loot");
      }
    }
  }
}

// ── Delivery check on dock ───────────────────────────────────────────────────

function getPlayerStock(target: string, p: Player): number {
  if (!p) return 0;
  return (p.ore[target] ?? 0) + (p.loot[target] ?? 0);
}

export function checkDeliveryContracts(station: Station, p: Player = getState().player): void {
  if (!p?.contracts) return;
  for (const c of p.contracts) {
    if (isTutorialContract(c)) continue;
    if (c.status !== "active") continue;
    if (c.type !== "delivery") continue;
    if (c.stationId !== station.id) continue;
    const have = getPlayerStock(c.objective.target, p);
    c.objective.current = Math.min(have, c.objective.required);
    if (c.objective.current >= c.objective.required) {
      c.status = "complete";
      if (p === getState().player) {
        emit("mission:completed", { contract: c });
        logEvent(t("system.contractComplete", { title: c.title, reward: c.reward }), "loot");
      }
    }
  }
}

// ── Tutorial Helpers ─────────────────────────────────────────────────────────

export function isTutorialContract(c: MissionContract): boolean {
  return c.id === TUTORIAL_MISSION_ID;
}

export function createTutorialMission(currentStep: number, requiredSteps: number): MissionContract {
  return {
    id: TUTORIAL_MISSION_ID,
    type: "tutorial",
    title: "Academy Training",
    description: "Complete Academy training and warp to Novus Prime.",
    reward: TUTORIAL_GRADUATION_REWARD,
    stationId: TUTORIAL_ACADEMY_STATION_ID,
    sysIdx: 0,
    objective: {
      type: "tutorial",
      target: "step",
      required: requiredSteps,
      current: currentStep,
    },
    status: "active",
  };
}

export function findTutorialContract(p: Player): MissionContract | undefined {
  return p.contracts?.find(c => isTutorialContract(c));
}

export function syncTutorialMissionProgress(p: Player): void {
  const c = findTutorialContract(p);
  if (!c) return;
  if (p.tutorial) {
    c.objective.current = p.tutorial.step;
  }
}
