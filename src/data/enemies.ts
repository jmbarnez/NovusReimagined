import type { EngagementName } from "../config/enemies.js";

export interface EnemyRender {
  path: number[][];
  fill: string;
  stroke: string;
  pathType?: string;
  panelLines?: number[][][];
  lights?: { x: number; y: number; r?: number; color?: string }[];
}

export interface ModuleLootEntry {
  id: string;
  weight: number;
}

export interface EnemyDef {
  name: string;
  /** AI engagement archetype — see ENGAGEMENT in src/config/enemies.ts. */
  engagement: EngagementName;
  credits: number;
  sigRadius: number;
  /** Collision radius for solid-body physics (derived from visual path extent). */
  colRadius: number;
  speed: number;
  accuracy: number;
  baseHp: number;
  baseStructure: number;
  shield?: number;
  weaponMult?: number;
  loot: Record<string, number>;
  weaponRange?: number;
  wreckChance?: number;
  moduleLoot?: ModuleLootEntry[];
  slots?: { turret?: number; high?: number; med?: number; low?: number };
  render: EnemyRender;
}

export const ENEMY_DEFS: Record<string, EnemyDef> = {
  rat_drone: {
    name: "Mite Drone",
    engagement: "orbiter",
    credits: 8,
    sigRadius: 18,
    colRadius: 10,
    speed: 80,
    accuracy: 0.5,
    baseHp: 3,
    baseStructure: 2,
    shield: 0,
    weaponMult: 0.4,
    weaponRange: 250,
    wreckChance: 0.30,
    loot: { scrap: 0.5, chip: 0.1 },
    moduleLoot: [
      { id: "tu-npc-mite-laser", weight: 1 },
      { id: "me-ab1", weight: 0.2 },
    ],
    slots: { turret: 1 },
    render: {
      path: [[14,0],[11,-2],[9,-6],[6,-9],[3,-7],[0,-10],[-4,-6],[-7,-8],[-10,-3],[-8,0],[-9,2],[-6,3],[-3,1],[0,3],[4,2],[8,1],[11,1]],
      fill: "#4a5a3a",
      stroke: "#6aaa4a",
      panelLines: [[[11,-2],[9,-6],[6,-8]],[[-7,-8],[-10,-3],[-8,0]],[[0,3],[4,2],[8,1]],[[6,-9],[3,-7],[0,-10]]],
    },
  },
  rat: {
    name: "Scrap Mite",
    engagement: "skirmisher",
    credits: 4,
    sigRadius: 25,
    colRadius: 10,
    speed: 90,
    accuracy: 0.6,
    baseHp: 5,
    baseStructure: 1,
    shield: 0,
    weaponMult: 0.6,
    wreckChance: 0.45,
    loot: { scrap: 0.6, chip: 0.08 },
    moduleLoot: [
      { id: "tu-civilian-cannon", weight: 2 },
      { id: "hi-nos", weight: 1 },
    ],
    slots: { turret: 1, high: 1 },
    render: {
      path: [[13,0],[10,-1],[8,-4],[6,-1],[4,-6],[2,-3],[0,-7],[-3,-4],[-5,-7],[-8,-3],[-10,0],[-9,2],[-11,5],[-8,3],[-6,6],[-3,3],[0,5],[3,2],[6,5],[9,2],[11,1]],
      fill: "#5a4a3a",
      stroke: "#8a7a40",
      panelLines: [[[10,-1],[8,-4],[6,-1]],[[4,-6],[2,-3],[0,-7]],[[-5,-7],[-8,-3],[-10,0]],[[-11,5],[-8,3],[-6,6]],[[0,5],[3,2],[6,5]]],
    },
  },
  drone: {
    name: "Sentry Drone",
    engagement: "sentry",
    credits: 6,
    sigRadius: 20,
    colRadius: 13,
    speed: 0,
    accuracy: 0.85,
    baseHp: 6,
    baseStructure: 4,
    shield: 0,
    weaponMult: 0.5,
    loot: { scrap: 0.8, chip: 0.15 },
    weaponRange: 900,
    wreckChance: 0.35,
    moduleLoot: [
      { id: "tu-npc-sentry-cannon", weight: 2 },
      { id: "hi-nos", weight: 1 },
    ],
    slots: { turret: 1, med: 1 },
    render: {
      path: [[12,0],[9,7],[4,10],[0,13],[-4,10],[-9,7],[-12,0],[-9,-7],[-4,-10],[0,-13],[4,-10],[9,-7]],
      fill: "#3a4855",
      stroke: "#6a8aaa",
      panelLines: [[[6,0],[-8,0]],[[0,-9],[0,9]],[[4,-5],[-4,-5]],[[4,5],[-4,5]]],
    },
  },
  target_dummy: {
    name: "Training Dummy",
    engagement: "sentry",
    credits: 1,
    sigRadius: 32,
    colRadius: 14,
    speed: 0,
    accuracy: 0,
    baseHp: 8,
    baseStructure: 4,
    shield: 0,
    weaponMult: 0,
    loot: {},
    render: {
      path: [[12,0],[8,-9],[0,-12],[-8,-9],[-12,0],[-8,9],[0,12],[8,9]],
      fill: "#4a3a2a",
      stroke: "#d0a060",
      panelLines: [[[0,-8],[0,8]],[[-7,0],[7,0]]],
    },
  },
  pirate: {
    name: "Belt Pirate",
    engagement: "brawler",
    credits: 12,
    sigRadius: 40,
    colRadius: 18,
    speed: 110,
    accuracy: 1.0,
    baseHp: 35,
    baseStructure: 25,
    shield: 20,
    weaponMult: 0.8,
    wreckChance: 0.60,
    loot: { scrap: 1.2, cell: 0.1 },
    moduleLoot: [
      { id: "tu-cannon", weight: 2 },
      { id: "tu-pulse", weight: 1 },
      { id: "me-ab1", weight: 1 },
    ],
    slots: { turret: 2, med: 1 },
    render: {
      path: [[18,0],[12,-10],[6,-14],[-2,-10],[-8,-16],[-14,-6],[-12,0],[-14,6],[-8,16],[-2,10],[6,14],[12,10]],
      fill: "#5a3020",
      stroke: "#cc8844",
      panelLines: [[[10,0],[0,0],[-10,0]],[[4,-8],[4,8]],[[-4,-6],[-10,-4]],[[-4,6],[-10,4]]],
    },
  },
  raider: {
    name: "Blockade Raider",
    engagement: "brawler",
    credits: 55,
    sigRadius: 65,
    colRadius: 20,
    speed: 125,
    accuracy: 1.15,
    baseHp: 120,
    baseStructure: 90,
    shield: 80,
    weaponMult: 1.0,
    wreckChance: 0.85,
    loot: { scrap: 3, chip: 0.4, cell: 0.35 },
    moduleLoot: [
      { id: "tu-gauss", weight: 2 },
      { id: "tu-missile", weight: 2 },
      { id: "hi-nos", weight: 1 },
      { id: "me-ab1", weight: 1 },
    ],
    slots: { turret: 3, med: 2, low: 1 },
    render: {
      path: [[20,0],[14,-12],[6,-16],[-2,-10],[-10,-20],[-16,-6],[-18,-2],[-14,0],[-18,2],[-16,6],[-10,20],[-2,10],[6,16],[14,12]],
      fill: "#2a3a30",
      stroke: "#4aaa88",
      panelLines: [[[12,0],[4,0],[-8,0]],[[8,-10],[2,-8],[-4,-6]],[[8,10],[2,8],[-4,6]],[[-8,-14],[-12,-6],[-14,-2]],[[-8,14],[-12,6],[-14,2]]],
    },
  },
  faction_hauler: {
    name: "Alliance Hauler",
    engagement: "skirmisher",
    credits: 0,
    sigRadius: 55,
    colRadius: 22,
    speed: 70,
    accuracy: 0.5,
    baseHp: 180,
    baseStructure: 100,
    shield: 80,
    loot: {},
    render: {
      path: [[25,0],[18,-15],[8,-18],[-18,-18],[-25,-10],[-25,10],[-18,18],[8,18],[18,15]],
      fill: "#1e3a45",
      stroke: "#00d0ff",
      panelLines: [[[10,-12],[10,12]],[[-10,-12],[-10,12]],[[0,-18],[0,18]]],
    },
  },
  faction_miner: {
    name: "Alliance Prospector",
    engagement: "skirmisher",
    credits: 0,
    sigRadius: 40,
    colRadius: 16,
    speed: 80,
    accuracy: 0.5,
    baseHp: 90,
    baseStructure: 60,
    shield: 40,
    loot: {},
    render: {
      path: [[18,0],[14,-10],[4,-12],[-12,-12],[-18,-6],[-18,6],[-12,12],[4,12],[14,10]],
      fill: "#183238",
      stroke: "#00c8b0",
      panelLines: [[[6,-8],[6,8]],[[-6,-8],[-6,8]]],
    },
  },
  faction_escort: {
    name: "Alliance Escort",
    engagement: "skirmisher",
    credits: 0,
    sigRadius: 28,
    colRadius: 12,
    speed: 130,
    accuracy: 0.9,
    baseHp: 50,
    baseStructure: 30,
    shield: 40,
    weaponMult: 0.8,
    loot: {},
    moduleLoot: [
      { id: "tu-cannon", weight: 1 },
      { id: "me-ab1", weight: 1 },
    ],
    slots: { turret: 1, med: 1 },
    render: {
      path: [[14,0],[8,-8],[-2,-10],[-10,-6],[-8,0],[-10,6],[-2,10],[8,8]],
      fill: "#122a3a",
      stroke: "#00aaff",
      panelLines: [[[4,0],[-4,0]],[[0,-6],[0,6]]],
    },
  },
  faction_scout: {
    name: "Alliance Scout",
    engagement: "orbiter",
    credits: 0,
    sigRadius: 24,
    colRadius: 10,
    speed: 150,
    accuracy: 0.85,
    baseHp: 35,
    baseStructure: 20,
    shield: 20,
    weaponMult: 0.6,
    loot: {},
    moduleLoot: [
      { id: "tu-pulse", weight: 1 },
    ],
    slots: { turret: 1 },
    render: {
      path: [[12,0],[6,-6],[-4,-8],[-8,-4],[-6,0],[-8,4],[-4,8],[6,6]],
      fill: "#0e2430",
      stroke: "#33bbff",
      panelLines: [[[2,0],[-3,0]]],
    },
  },
};

