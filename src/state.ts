/**
 * Global state singletons.
 *
 *  G        — Authoritative game/simulation state (what a server would own)
 *  Client   — Client-only input, camera, UI, and display state
 *
 * Rule of thumb: if a headless server needs it, it belongs in G.
 * If it only matters to the local display/input layer, it belongs in Client.
 */

import { SpatialGrid } from "./utils/spatial.js";
import type {
  Bullet,
  EnemyBullet,
  Beam,
  Particle,
  Shockwave,
  FloatText,
  Trail,
} from "./utils/entities.js";
import type {
  AutoTarget,
  LockSlot,
  Star,
  DustParticle,
  Station,
  System,
  WreckPiece,
  SalvagePickup,
} from "./types/world.js";
import { DEFAULT_SETTINGS } from "./data/settings.js";
import type { Settings } from "./data/settings.js";
import type { ComputedStats } from "./player/player-stats.js";
import type { MissionContract } from "./data/missions.js";
import type { ModuleInstance } from "./types/moduleInstance.js";
import type { CraftJob } from "./data/industryRecipes.js";

export enum AppMode {
  TITLE = "TITLE",
  SPACE = "SPACE",
  STATION = "STATION",
}

export interface SocketedModule {
  id: string;
  x: number;
  y: number;
  hp: number;
  active: boolean;
  // Metadata for combat/UI
  heat?: number;
  cd?: number;
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
  sysIdx: number;
  credits: number;
  ore: Record<string, number>;
  refined: Record<string, number>;
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
  recoilFrames?: number;
  fitting: Record<string, (string | null)[]>;
  moduleHp: Record<string, (number | null)[]>;
  slotActive: Record<string, boolean[]>;
  _assignTargetId: string | null;
  slotHeat?: Record<string, number[]>;
  _colCooldown?: number;
  contracts: MissionContract[];
  craftQueue: CraftJob[];
}

export interface MiningLaserState {
  active: boolean;
  x1: number; y1: number;
  x2: number; y2: number;
  phase: number;
  hitR: number;
  hitNx: number;
  hitNy: number;
  oreKey: string;
  oreColor: string;
}

export interface SalvagerState {
  active: boolean;
  targetPieceId: string | null;
  x1: number; y1: number;
  x2: number; y2: number;
  phase: number;
}

export interface ImpactDecal {
  id: number;
  x: number; y: number;
  poly: number[][];
  color: string;
  life: number;
  maxLife: number;
}

export interface GameState {
  P: Player;
  bullets: Bullet[];
  enemyBullets: EnemyBullet[];
  beams: Beam[];
  particles: Particle[];
  shockwaves: Shockwave[];
  floatTexts: FloatText[];
  trails: Trail[];
  wreckPieces: WreckPiece[];
  salvagePickups: SalvagePickup[];
  impactDecals: ImpactDecal[];
  miningLaser: MiningLaserState;
  salvager: SalvagerState;
  warpCooldown: number;
  warpTargetIdx: number;
  GALAXY: System[];
  STARS: Star[];
  STARS_FAR: Star[];
  STARS_NEAR: Star[];
  DUST: DustParticle[];
  _statsCache: ComputedStats | null;
  spatialGrid: SpatialGrid | null;
}

export interface ClientState {
  mode: AppMode;
  keys: Record<string, boolean>;
  mouse: { x: number; y: number; lmb: boolean; rmb: boolean; firing: boolean };
  mouseWorld: { x: number; y: number };
  camx: number; camy: number;
  zoom: number;
  waypoint: { x: number; y: number } | null;
  cursorUnlocked: boolean;
  combatHeat: number;
  showMap: boolean;
  showSystemMap: boolean; // true = system view, false = galaxy view in fullscreen map
  stationOpen: boolean;
  activeStation: Station | null;
  bridgeOpen: boolean;
  overviewOpen: boolean;
  bridgeWindowZ: number;

  settingsOpen: boolean;
  skillsOpen: boolean;
  settings: Settings;
  showPerf: boolean;
  gameStarted: boolean;
  _lastBridgeRender: number;
}

export const G: GameState = {
  P: null as unknown as Player,  // overwritten in main.ts init() before any game code runs
  bullets: [],
  enemyBullets: [],
  beams: [],
  particles: [],
  shockwaves: [],
  floatTexts: [],
  trails: [],
  wreckPieces: [],
  salvagePickups: [],
  impactDecals: [],
  miningLaser: { active: false, x1: 0, y1: 0, x2: 0, y2: 0, phase: 0, hitR: 0, hitNx: 0, hitNy: 0, oreKey: "", oreColor: "" },
  salvager: { active: false, targetPieceId: null, x1: 0, y1: 0, x2: 0, y2: 0, phase: 0 },
  warpCooldown: 0,
  warpTargetIdx: -1,
  GALAXY: [],
  STARS: [],
  STARS_FAR: [],
  STARS_NEAR: [],
  DUST: [],
  _statsCache: null,
  spatialGrid: null,
};

export const Client: ClientState = {
  mode: AppMode.TITLE,
  keys: {},
  mouse: { x: 0, y: 0, lmb: false, rmb: false, firing: false },
  mouseWorld: { x: 0, y: 0 },
  camx: 0,
  camy: 0,
  zoom: 1.0,
  waypoint: null,
  cursorUnlocked: false,
  combatHeat: 0,
  showMap: false,
  showSystemMap: false,
  stationOpen: false,
  activeStation: null,
  bridgeOpen: false,
  overviewOpen: false,
  bridgeWindowZ: 12,

  settingsOpen: false,
  skillsOpen: false,
  settings: { ...DEFAULT_SETTINGS },
  showPerf: false,
  gameStarted: false,
  _lastBridgeRender: 0,
};
;
