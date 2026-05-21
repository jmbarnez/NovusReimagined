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
  cruiseSpeedMult: number;
  hullMassKg: number;
  baseMainEngineMN: number;
  cruiseAccelMult: number;
  simMainThrustPx: number;
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
    name: "RAPIER-I",
    role: "Light interceptor",
    hull: 12,
    hullMax: 12,
    shield: 60,
    shieldRegen: 0,
    baseCargoM3: 180,
    signatureRadius: 19,
    colRadius: 24,
    resistances: { em: 0.1, therm: 0.2, kin: 0.2, exp: 0.1 },
    weaponMult: 0.9,
    miningMult: 0.85,
    lockBonusTicks: 1,
    sensorContactRangeKm: 118,
    lockRangeKm: 86,
    turretRangeKm: 58,
    miningRangeKm: 8,
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
      turret: 2,
      high: 2,
      med: 3,
      low: 3,
    },
    render: {
      path: [
        [22,0],[16,-5],[8,-7],[0,-9],
        [-4,-14],[-10,-10],[-18,-5],
        [-20,0],
        [-18,5],[-10,10],[-4,14],
        [0,9],[8,7],[16,5],
      ],
      fill: "#182e42",
      stroke: "#38c0e0",
      nozzleOffsets: [[-20, 0]],
      turretOffsets: [[8, -7], [8, 7]],
      cockpit: { cx: 14, cy: 0, rx: 5, ry: 3 },
      cockpitColor: "rgba(130,230,255,0.85)",
      sensorGlow: { x: 22, y: 0, r: 3, color: "rgba(80,180,255,0.40)" },
      panelLines: [
        [[20,0],[0,0],[-18,0]],
        [[10,-5],[4,-7],[0,-8]],
        [[10,5],[4,7],[0,8]],
        [[-6,-12],[-16,-5]],
        [[-6,12],[-16,5]],
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
    colRadius: 20,
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
      turret: 2,
      high: 1,
      med: 3,
      low: 4,
    },
    render: {
      path: [[20,0],[14,-12],[8,-16],[2,-14],[-4,-12],[-10,-10],[-16,-12],[-18,-6],[-16,0],[-18,6],[-16,12],[-10,10],[-4,12],[2,14],[8,16],[14,12]],
      fill: "#7a6a38",
      stroke: "#c0a040",
      nozzleOffsets: [[-16, -8], [-16, 8]],
      turretOffsets: [[6, -12], [6, 12]],
      cockpit: { cx: 8, cy: 0, rx: 5, ry: 5 },
      panelLines: [[[12,0],[0,0],[-14,0]],[[6,-11],[6,11]],[[-4,-12],[-4,12]],[[-10,-8],[-14,-10]],[[-10,8],[-14,10]]],
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
    colRadius: 26,
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
      turret: 2,
      high: 2,
      med: 2,
      low: 3,
    },
    render: {
      path: [[26,0],[20,-7],[14,-13],[8,-11],[2,-9],[-6,-15],[-14,-5],[-16,0],[-14,5],[-6,15],[2,9],[8,11],[14,13],[20,7]],
      fill: "#7a3828",
      stroke: "#d45a2a",
      nozzleOffsets: [[-14, -5], [-14, 5]],
      turretOffsets: [[12, -8], [12, 8]],
      cockpit: { cx: 12, cy: 0, rx: 7, ry: 4 },
      panelLines: [[[16,0],[6,0],[-10,0]],[[10,-6],[6,-9],[2,-8]],[[10,6],[6,9],[2,8]],[[-2,-6],[-8,-4]],[[-2,6],[-8,4]]],
    },
  },
};
