import type { AutoTarget, LockSlot } from "../../types/world.js";
import type { CraftJob } from "../../data/industryRecipes.js";
import type { MissionContract } from "../../data/missions.js";
import type { ModuleInstance } from "../../types/moduleInstance.js";
import type { BulkMaterialStack, HubDeposit, HubJob, HubOutput, MixedOreCargo } from "../../state.js";

export type TargetLockSnapshot = Pick<AutoTarget, "id" | "x" | "y" | "hp"> & {
  name?: string;
  alive?: boolean;
  depleted?: boolean;
  sigRadius?: number;
  vx?: number;
  vy?: number;
  radius?: number;
};

export interface PlayerSnapshot {
  netId?: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  va: number;
  angle: number;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  energy: number;
  maxEnergy: number;
  shipHeat: number;
  boostFx: boolean;
  boostLockout: boolean;
  credits: number;
  sysIdx: number;
  homeSysIdx?: number;
  waypoint: { x: number; y: number } | null;
  navCommand: { mode: "orbit" | "keepRange"; targetId: string; rangePx: number; dir: 1 | -1 } | null;
  miningLaser?: { active: boolean; x1: number; y1: number; x2: number; y2: number; phase: number; hitR: number; hitNx: number; hitNy: number } | null;
  salvager?: { active: boolean; x1: number; y1: number; x2: number; y2: number; phase: number; targetPieceId: string | null } | null;
  tractor?: { active: boolean; x1: number; y1: number; x2: number; y2: number; phase: number; targetId: string | null; tooHeavy: boolean } | null;
  gateCooldowns?: Record<string, number> | null;
  gatesCleared?: string[] | null;
  targetLock?: TargetLockSnapshot | null;
  lockQueue?: LockSlot[] | null;
  _assignTargetId?: string | null;
  turretTargets?: (string | null)[] | null;
  highTargets?: (string | null)[] | null;
  slotActive?: Record<string, boolean[]> | null;
  turretPower?: boolean[] | null;
  turretCds?: number[] | null;
  turretPowerCd?: number[] | null;
  slotPowerCd?: Record<string, number[]> | null;
  moduleHp?: Record<string, (number | null)[]> | null;
  fitting?: Record<string, (string | null)[]> | null;
  ore?: Record<string, number> | null;
  mixedOreCargo?: MixedOreCargo[] | null;
  bulkMaterialsCargo?: BulkMaterialStack[] | null;
  loot?: Record<string, number> | null;
  components?: Record<string, number> | null;
  ammo?: { hybrid: number; missile: number } | null;
  blueprints?: Record<string, boolean> | null;
  skills?: Record<string, number> | null;
  skillXp?: Record<string, number> | null;
  xp?: number;
  level?: number;
  craftQueue?: CraftJob[] | null;
  hubQueue?: HubJob[] | null;
  hubOutput?: HubOutput | null;
  hubDeposit?: HubDeposit | null;
  moduleCargo?: ModuleInstance[] | null;
  contracts?: MissionContract[] | null;
  stationOffers?: MissionContract[] | null;
  stationOfferStationId?: string | null;
}

export interface EntitySnapshot {
  id: string | number;
  type: "bullet" | "enemyBullet" | "enemy" | "asteroid" | "wreckpiece" | "salvagepickup" | "player";
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle?: number;
  hp?: number;
  maxHp?: number;
  depleted?: boolean;
  payload?: string;
  qty?: number;
  dmg?: number;
  color?: string;
  sz?: number;
  trail?: string | null;
  kind?: string | null;
  weaponId?: string | null;
  hitChance?: number;
  targetId?: string | null;
  homingTurnRate?: number;
  accel?: number;
  maxSpeed?: number;
  dmgProfile?: unknown;
  ownerFaction?: "hostile" | "neutral" | "player" | "friendly";
  ownerId?: string;
  radius?: number;
  pts?: [number, number][];
  name?: string;
  age?: number;
  despawnTimer?: number;
  shipType?: string;
  pilotName?: string;
  thrustFx?: boolean;
  boostFx?: boolean;
  boostLockout?: boolean;
  shipHeat?: number;
  miningLaser?: { active: boolean; x1: number; y1: number; x2: number; y2: number; phase: number; hitR: number; hitNx: number; hitNy: number } | null;
  salvager?: { active: boolean; x1: number; y1: number; x2: number; y2: number; phase: number; targetPieceId: string | null } | null;
  tractor?: { active: boolean; x1: number; y1: number; x2: number; y2: number; phase: number; targetId: string | null; tooHeavy: boolean } | null;
  spinAngle?: number;
  spinVel?: number;
  enemyType?: string;
  shield?: number;
  maxShield?: number;
  structure?: number;
  maxStructure?: number;
  level?: number;
  faction?: "hostile" | "neutral" | "player" | "friendly";
  weaponRange?: number;
  sigRadius?: number;
  speed?: number;
  composition?: Record<string, number>;
  richness?: number;
  tintHue?: number;
  tintSat?: number;
}

export interface WorldSnapshot {
  tick: number;
  player: PlayerSnapshot;
  entities: EntitySnapshot[];
}

export interface DeltaSnapshot {
  tick: number;
  fromTick: number;
  player?: Partial<PlayerSnapshot>;
  entities?: {
    spawned?: EntitySnapshot[];
    updated?: Partial<EntitySnapshot>[];
    destroyed?: (string | number)[];
  };
}
