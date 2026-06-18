export interface ShipFitting {
  powergrid: number;
  cpu: number;
  turret: number;
  high: number;
  med: number;
  low: number;
}

export interface CockpitConfig {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface SensorGlow {
  x: number;
  y: number;
  r: number;
  color: string;
}

export type ShipDecor =
  | { kind: "plate"; points: number[][]; fill: string; stroke?: string; alpha?: number }
  | { kind: "line"; points: number[][]; color: string; width: number; alpha?: number }
  | { kind: "vent"; x: number; y: number; w: number; h: number; count?: number; color: string; alpha?: number }
  | { kind: "circle"; x: number; y: number; r: number; fill: string; stroke?: string; alpha?: number };

export interface ShipRender {
  path: number[][];
  fill: string;
  stroke: string;
  nozzleOffsets: number[][];
  turretOffsets?: number[][];
  cockpit?: CockpitConfig;
  cockpitColor?: string;
  sensorGlow?: SensorGlow;
  panelLines?: number[][][];
  lights?: { x: number; y: number; r?: number; color?: string }[];
  decor?: ShipDecor[];
}

export interface ShipDef {
  id: string;
  name: string;
  role: string;
  hull: number;
  hullMax: number;
  shield: number;
  shieldRegen: number;
  baseCargoM3: number;
  signatureRadius: number;
  /** Collision radius for solid-body physics (derived from visual path extent). */
  colRadius: number;
  resistances: Record<string, number>;
  weaponMult: number;
  miningMult: number;
  lockBonusTicks: number;
  sensorContactRangeKm: number;
  lockRangeKm: number;
  turretRangeKm: number;
  miningRangeKm: number;
  passiveScanRangeKm?: number;
  cruiseSpeedMult: number;
  hullMassKg: number;
  baseMainEngineMN: number;
  cruiseAccelMult: number;
  simMainThrustPx: number;
  simRetroThrustPx?: number;
  simLateralThrustPx?: number;
  simRetroRatio: number;
  simLateralRatio: number;
  simMaxSpeedPx: number;
  simTurnRateRad: number;
  simDragPerSec: number;
  baseCapacitor: number;
  capPerLevel: number;
  capFromEngineering: number;
  baseCapRecharge: number;
  capRechargeFromEngineering: number;
  fitting: ShipFitting;
  render: ShipRender;
}

export const SHIPS: Record<string, ShipDef> = {
  scout: {
    id: "scout",
    name: "NODE-I",
    role: "Utility drone",
    hull: 12,
    hullMax: 12,
    shield: 60,
    shieldRegen: 0,
    baseCargoM3: 180,
    signatureRadius: 19,
    colRadius: 14,
    resistances: { em: 0.1, therm: 0.2, kin: 0.2, exp: 0.1 },
    weaponMult: 0.9,
    miningMult: 0.85,
    lockBonusTicks: 1,
    sensorContactRangeKm: 118,
    lockRangeKm: 86,
    turretRangeKm: 58,
    miningRangeKm: 8,
    passiveScanRangeKm: 54,
    cruiseSpeedMult: 1.0,
    hullMassKg: 680000,
    baseMainEngineMN: 7,
    cruiseAccelMult: 1.08,
    simMainThrustPx: 60,
    simRetroRatio: 0.25,
    simLateralRatio: 0.05,
    simMaxSpeedPx: 100,
    simTurnRateRad: 1.5,
    simDragPerSec: 0.99,
    baseCapacitor: 100,
    capPerLevel: 8,
    capFromEngineering: 4,
    baseCapRecharge: 6,
    capRechargeFromEngineering: 0.5,
    fitting: {
      powergrid: 38,
      cpu: 200,
      turret: 0,
      high: 2,
      med: 1,
      low: 1,
    },
    render: {
      path: [
        [11, 0], [9, -4], [6, -6], [1, -6], [-3, -6],
        [-6, -7], [-11, -7], [-12, -4], [-11, -2],
        [-8, 0], [-11, 2], [-12, 4], [-11, 7],
        [-6, 7], [-3, 6], [1, 6], [6, 6], [9, 4],
      ],
      fill: "#182e42",
      stroke: "#38c0e0",
      nozzleOffsets: [[-12, -2], [-12, 2]],
      turretOffsets: [[5, -5], [5, 5]],
      cockpit: { cx: 5, cy: 0, rx: 2.5, ry: 2 },
      cockpitColor: "rgba(130,230,255,0.85)",
      sensorGlow: { x: 10, y: 0, r: 2.2, color: "rgba(80,180,255,0.40)" },
      decor: [
        { kind: "line", points: [[9, -1.2], [5, -1.2], [1, -1.2]], color: "rgba(70,220,255,0.72)", width: 0.75 },
        { kind: "line", points: [[9, 1.2], [5, 1.2], [1, 1.2]], color: "rgba(70,220,255,0.72)", width: 0.75 },
        { kind: "plate", points: [[5, -5.5], [0, -5.5], [-1, -4], [3, -4]], fill: "rgba(20,52,76,0.68)", stroke: "rgba(100,210,240,0.35)" },
        { kind: "plate", points: [[5, 5.5], [0, 5.5], [-1, 4], [3, 4]], fill: "rgba(20,52,76,0.68)", stroke: "rgba(100,210,240,0.35)" },
        { kind: "plate", points: [[-8, -6.5], [-11, -6.5], [-11.5, -5], [-8.5, -5]], fill: "rgba(20,52,76,0.68)", stroke: "rgba(100,210,240,0.35)" },
        { kind: "plate", points: [[-8, 5], [-11.5, 5], [-11, 6.5], [-8, 6.5]], fill: "rgba(20,52,76,0.68)", stroke: "rgba(100,210,240,0.35)" },
        { kind: "circle", x: 9, y: 0, r: 1.5, fill: "rgba(60,180,255,0.35)", stroke: "rgba(100,220,255,0.5)" },
        { kind: "vent", x: -10.5, y: -6.2, w: 3, h: 1.2, count: 3, color: "rgba(8,18,28,0.72)" },
        { kind: "vent", x: -10.5, y: 5, w: 3, h: 1.2, count: 3, color: "rgba(8,18,28,0.72)" },
      ],
      panelLines: [
        [[8, 0], [3, 0], [-3, 0], [-8, 0]],
        [[6, -5.5], [6, 5.5]],
        [[1, -6], [1, 6]],
        [[-3, -6], [-3, 6]],
        [[-6, -6.5], [-11, -6.5]],
        [[-6, 6.5], [-11, 6.5]],
        [[-11.5, -4], [-11.5, 4]],
        [[9, -1.5], [9, 1.5]],
      ],
      lights: [
        { x: -11, y: -6.5, r: 0.7, color: "rgba(255,100,100,0.6)" },
        { x: -11, y: 6.5, r: 0.7, color: "rgba(100,255,100,0.6)" },
        { x: 11, y: 0, r: 0.9, color: "rgba(200,220,255,0.5)" },
      ],
    },
  },
  miner: {
    id: "miner",
    name: "BORE-DRILL",
    role: "Industrial miner",
    hull: 140,
    hullMax: 140,
    shield: 40,
    shieldRegen: 0,
    baseCargoM3: 420,
    signatureRadius: 120,
    colRadius: 22,
    resistances: { em: 0.2, therm: 0.2, kin: 0.4, exp: 0.4 },
    weaponMult: 0.75,
    miningMult: 1.35,
    lockBonusTicks: 0,
    sensorContactRangeKm: 86,
    lockRangeKm: 58,
    turretRangeKm: 30,
    miningRangeKm: 8,
    cruiseSpeedMult: 0.95,
    hullMassKg: 920000,
    baseMainEngineMN: 6,
    cruiseAccelMult: 0.88,
    simMainThrustPx: 90,
    simRetroRatio: 0.36,
    simLateralRatio: 0.45,
    simMaxSpeedPx: 105,
    simTurnRateRad: 1.95,
    simDragPerSec: 0.99,
    baseCapacitor: 125,
    capPerLevel: 8,
    capFromEngineering: 4,
    baseCapRecharge: 5.5,
    capRechargeFromEngineering: 0.5,
    fitting: {
      powergrid: 55,
      cpu: 220,
      turret: 0,
      high: 3,
      med: 3,
      low: 4,
    },
    render: {
      path: [[22,0],[17,-10],[11,-15],[4,-16],[-2,-13],[-7,-15],[-13,-18],[-19,-13],[-21,-7],[-17,-3],[-21,0],[-17,3],[-21,7],[-19,13],[-13,18],[-7,15],[-2,13],[4,16],[11,15],[17,10]],
      fill: "#7a6a38",
      stroke: "#c0a040",
      nozzleOffsets: [[-20, -9], [-20, 9]],
      turretOffsets: [[7, -12], [7, 12]],
      cockpit: { cx: 9, cy: 0, rx: 5, ry: 5 },
      decor: [
        { kind: "plate", points: [[8, -14], [-4, -13], [-4, -7], [8, -8]], fill: "rgba(108,96,50,0.82)", stroke: "rgba(230,200,95,0.34)" },
        { kind: "plate", points: [[8, 14], [-4, 13], [-4, 7], [8, 8]], fill: "rgba(108,96,50,0.82)", stroke: "rgba(230,200,95,0.34)" },
        { kind: "line", points: [[15, -5], [2, -5]], color: "rgba(245,210,80,0.72)", width: 1.0 },
        { kind: "line", points: [[15, 5], [2, 5]], color: "rgba(245,210,80,0.72)", width: 1.0 },
        { kind: "vent", x: -15, y: -11.6, w: 5.4, h: 1.6, count: 4, color: "rgba(22,20,14,0.72)" },
        { kind: "vent", x: -15, y: 10.0, w: 5.4, h: 1.6, count: 4, color: "rgba(22,20,14,0.72)" },
        { kind: "circle", x: -9, y: 0, r: 2.4, fill: "rgba(35,34,25,0.82)", stroke: "rgba(230,200,95,0.32)" },
      ],
      panelLines: [[[14,0],[1,0],[-17,0]],[[8,-12],[8,12]],[[-4,-13],[-4,13]],[[-11,-14],[-16,-11],[-19,-7]],[[-11,14],[-16,11],[-19,7]],[[2,-12],[-2,-10],[-6,-12]],[[2,12],[-2,10],[-6,12]]],
    },
  },
  fighter: {
    id: "fighter",
    name: "CLEAVE-IV",
    role: "Assault / patrol",
    hull: 120,
    hullMax: 120,
    shield: 100,
    shieldRegen: 0,
    baseCargoM3: 260,
    signatureRadius: 65,
    colRadius: 29,
    resistances: { em: 0.3, therm: 0.3, kin: 0.3, exp: 0.3 },
    weaponMult: 1.25,
    miningMult: 0.7,
    lockBonusTicks: 0,
    sensorContactRangeKm: 96,
    lockRangeKm: 64,
    turretRangeKm: 68,
    miningRangeKm: 8,
    cruiseSpeedMult: 1.04,
    hullMassKg: 810000,
    baseMainEngineMN: 8,
    cruiseAccelMult: 1.12,
    simMainThrustPx: 100,
    simRetroRatio: 0.33,
    simLateralRatio: 0.48,
    simMaxSpeedPx: 145,
    simTurnRateRad: 2.88,
    simDragPerSec: 0.99,
    baseCapacitor: 92,
    capPerLevel: 8,
    capFromEngineering: 4,
    baseCapRecharge: 6.6,
    capRechargeFromEngineering: 0.52,
    fitting: {
      powergrid: 50,
      cpu: 190,
      turret: 0,
      high: 4,
      med: 2,
      low: 3,
    },
    render: {
      path: [[28,0],[22,-6],[17,-12],[11,-16],[4,-12],[-2,-10],[-9,-18],[-16,-8],[-20,-4],[-17,0],[-20,4],[-16,8],[-9,18],[-2,10],[4,12],[11,16],[17,12],[22,6]],
      fill: "#7a3828",
      stroke: "#d45a2a",
      nozzleOffsets: [[-19, -5], [-19, 5]],
      turretOffsets: [[13, -9], [13, 9]],
      cockpit: { cx: 13, cy: 0, rx: 7, ry: 4 },
      decor: [
        { kind: "plate", points: [[19, -5], [9, -11], [3, -9], [10, -4]], fill: "rgba(98,34,26,0.76)", stroke: "rgba(245,120,70,0.34)" },
        { kind: "plate", points: [[19, 5], [9, 11], [3, 9], [10, 4]], fill: "rgba(98,34,26,0.76)", stroke: "rgba(245,120,70,0.34)" },
        { kind: "line", points: [[21, -2.8], [11, -4.6], [-6, -11.6]], color: "rgba(255,126,66,0.70)", width: 0.9 },
        { kind: "line", points: [[21, 2.8], [11, 4.6], [-6, 11.6]], color: "rgba(255,126,66,0.70)", width: 0.9 },
        { kind: "vent", x: -13.8, y: -6.6, w: 4.8, h: 1.5, count: 4, color: "rgba(22,10,8,0.74)" },
        { kind: "vent", x: -13.8, y: 5.1, w: 4.8, h: 1.5, count: 4, color: "rgba(22,10,8,0.74)" },
        { kind: "circle", x: 5, y: -9.8, r: 1.4, fill: "rgba(255,120,65,0.42)" },
        { kind: "circle", x: 5, y: 9.8, r: 1.4, fill: "rgba(255,120,65,0.42)" },
      ],
      panelLines: [[[18,0],[7,0],[-13,0]],[[13,-6],[8,-11],[3,-10]],[[13,6],[8,11],[3,10]],[[0,-8],[-7,-12],[-13,-7]],[[0,8],[-7,12],[-13,7]],[[-3,-10],[-9,-16]],[[-3,10],[-9,16]]],
    },
  },
};
