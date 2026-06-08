import type { BulkMaterialStack, RefineryStorageUnit, AlloyCodex, MixedOreCargo } from "./materials.js";
import type { HubJob, HubOutput, HubDeposit } from "./hub.js";
import type { ModuleInstance } from "../../types/moduleInstance.js";
import type { CraftJob } from "../../data/industryRecipes.js";
import type { MissionContract } from "../../data/missions.js";
import type { SignatureContact } from "../../types/world.js";
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

export interface Player {
  shipId: string;
  homeSysIdx: number;
  pendingHomeSpawn: boolean;
  x: number; y: number;
  px: number; py: number;
  vx: number; vy: number; va: number;
  angle: number; prevAngle: number;
  hp: number; maxHp: number;
  structure: number; maxStructure: number;
  shield: number; shieldCd: number;
  maxShield?: number;
  shieldHitGlow: number; shieldHitAngle: number;
  hullHitGlow: number; hullHitAngle: number;
  structureHitGlow?: number; structureHitAngle?: number;
  targetLock: import("../../types/world.js").AutoTarget | null;
  lockQueue: import("../../types/world.js").LockSlot[];
  fireControlSlot: number;
  turretTargets: (string | null)[];
  highTargets: (string | null)[];
  turretCds: number[];
  turretPower: boolean[];
  turretPowerCd: number[];
  combatBar: { pos: number; dir: number };
  energy: number;
  sysIdx: number;
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
  shootCd: number; mineCd: number;
  invincible: number;
  thrustFx: boolean;
  boostFx: boolean;
  boostLockout: boolean;
  gateBoostRemaining?: number;
  recoilFrames?: number;
  fitting: Record<string, (string | null)[]>;
  moduleHp: Record<string, (number | null)[]>;
  slotActive: Record<string, boolean[]>;
  slotPowerCd?: Record<string, number[]>;
  _assignTargetId: string | null;
  slotHeat?: Record<string, number[]>;
  _colCooldown?: number;
  contracts: MissionContract[];
  craftQueue: CraftJob[];
  tractorCarryKg?: number;
  tractorTightness?: number;
  hubQueue: HubJob[];
  hubOutput: HubOutput;
  hubDeposit: HubDeposit;
  inputKeys?: { space: boolean; w: boolean; a: boolean; s: boolean; d: boolean; boost: boolean } | null;
  inputMouseWorld?: { x: number; y: number } | null;
  waypoint?: { x: number; y: number } | null;
  navCommand?: { mode: "orbit" | "keepRange"; targetId: string; rangePx: number; dir: 1 | -1 } | null;
  movementControlMode?: "waypoint" | "direct";
  gateCooldowns?: Record<string, number>;
  gatesCleared?: string[];
  tutorial: { active: boolean; step: number; completed: boolean; skipped: boolean; stepEnteredAt?: number; v?: number };
  pilotName: string;
  scannedSiteIds: string[];
  completedSiteIds: string[];
  netId?: string;
  netInputFrame?: unknown;
  discoveredConcentricSectors: number[];
  discoveredLocalRegionIds: string[];
  stationOffers: MissionContract[];
  stationOfferStationId: string | null;
  miningLaser?: MiningLaserState | null;
  salvager?: SalvagerState | null;
  tractor?: TractorState | null;
  warpCooldown?: number;
  warpTargetIdx?: number;
  warpHoldStartTime?: number | null;
  detectedSignatures: SignatureContact[];
  activeScan: ActiveScanTarget | null;
  scannerAngle: number;
  scannerConeDeg: number;
  mapScannerActive: boolean;
  mapScannerStrength: number;
}
