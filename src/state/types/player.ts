import type { BulkMaterialStack, RefineryStorageUnit, AlloyCodex, MixedOreCargo } from "./materials.js";
import type { HubJob, HubOutput, HubDeposit } from "./hub.js";
import type { ModuleInstance } from "../../types/moduleInstance.js";
import type { CraftJob } from "../../data/industryRecipes.js";
import type { MissionContract } from "../../data/missions.js";
import type { SignatureContact } from "../../types/system.js";
import type { AutoTarget, LockSlot } from "../../types/combat.js";
import type { ActiveScanTarget } from "./combat.js";

export interface MiningLaserState {
  active: boolean;
  x1: number; y1: number;
  x2: number; y2: number;
  phase: number;
  hitR: number;
  hitNx: number;
  hitNy: number;
  oreKey?: string;
  oreColor?: string;
}

export interface SalvagerState {
  active: boolean;
  targetPieceId: string | null;
  x1: number; y1: number;
  x2: number; y2: number;
  phase: number;
}

export interface TractorState {
  active: boolean;
  targetId: string | null;
  tooHeavy: boolean;
  x1: number; y1: number;
  x2: number; y2: number;
  phase: number;
}

export interface PlayerIdentity {
  shipId: string;
  pilotName: string;
  homeSysIdx: number;
  pendingHomeSpawn: boolean;
  netId?: string;
  netInputFrame?: unknown;
  saveVersion?: number;
}

export interface PlayerPhysics {
  x: number; y: number;
  px: number; py: number;
  vx: number; vy: number; va: number;
  angle: number; prevAngle: number;
  sysIdx: number;
  boostLockout: boolean;
  gateBoostRemaining?: number;
  recoilFrames?: number;
}

export interface PlayerCombat {
  hp: number; maxHp: number;
  structure: number; maxStructure: number;
  shield: number; shieldCd: number;
  maxShield?: number;
  targetLock: AutoTarget | null;
  lockQueue: LockSlot[];
  fireControlSlot: number;
  turretTargets: (string | null)[];
  highTargets: (string | null)[];
  turretCds: number[];
  turretPower: boolean[];
  turretPowerCd: number[];
  combatBar: { pos: number; dir: number };
  energy: number;
  shootCd: number; mineCd: number;
  invincible: number;
  _assignTargetId: string | null;
  _colCooldown?: number;
}

export interface PlayerEconomy {
  credits: number;
  ore: Record<string, number>;
  mixedOreCargo: MixedOreCargo[];
  bulkMaterialsCargo: BulkMaterialStack[];
  refineryStorage: RefineryStorageUnit[];
  alloyCodex: AlloyCodex;
  loot: Record<string, number>;
  components: Record<string, number>;
  ammo: { hybrid: number; missile: number };
  moduleCargo: ModuleInstance[];
  blueprints: Record<string, boolean>;
  skills: Record<string, number>;
  skillXp: Record<string, number>;
  xp: number; level: number; kills: number;
}

export interface PlayerFitting {
  fitting: Record<string, (string | null)[]>;
  moduleHp: Record<string, (number | null)[]>;
  slotActive: Record<string, boolean[]>;
  slotPowerCd?: Record<string, number[]>;
  slotHeat?: Record<string, number[]>;
}

export interface PlayerNavigation {
  waypoint?: { x: number; y: number } | null;
  navCommand?: { mode: "orbit" | "keepRange"; targetId: string; rangePx: number; dir: 1 | -1 } | null;
  movementControlMode?: "waypoint" | "direct";
}

export interface PlayerWarp {
  warpCooldown?: number;
  warpTargetIdx?: number;
  warpHoldStartTime?: number | null;
  gateCooldowns?: Record<string, number>;
  gatesCleared?: string[];
}

export interface PlayerIndustry {
  contracts: MissionContract[];
  craftQueue: CraftJob[];
  hubQueue: HubJob[];
  hubOutput: HubOutput;
  hubDeposit: HubDeposit;
  stationOffers: MissionContract[];
  stationOfferStationId: string | null;
  tractorCarryKg?: number;
  tractorTightness?: number;
  miningLaser?: MiningLaserState | null;
  salvager?: SalvagerState | null;
  tractor?: TractorState | null;
}

export interface PlayerScanning {
  scannedSiteIds: string[];
  completedSiteIds: string[];
  detectedSignatures: SignatureContact[];
  activeScan: ActiveScanTarget | null;
  scannerAngle: number;
  scannerConeDeg: number;
  mapScannerActive: boolean;
  mapScannerStrength: number;
}

export interface PlayerProgression {
  discoveredConcentricSectors: number[];
  discoveredLocalRegionIds: string[];
}

export interface PlayerTutorial {
  tutorial: { active: boolean; step: number; completed: boolean; skipped: boolean; stepEnteredAt?: number; v?: number };
}

export interface Player extends
  PlayerIdentity,
  PlayerPhysics,
  PlayerCombat,
  PlayerEconomy,
  PlayerFitting,
  PlayerNavigation,
  PlayerWarp,
  PlayerIndustry,
  PlayerScanning,
  PlayerProgression,
  PlayerTutorial
{
  // No additional fields — all domains are covered above.
}
