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
  WreckSalvageEntry,
  SignatureContact,
} from "./types/world.js";
import { DEFAULT_SETTINGS } from "./data/settings.js";
import type { Settings } from "./data/settings.js";
import type { ComputedStats } from "./player/player-stats.js";
import type { MissionContract } from "./data/missions.js";
import type { ModuleInstance } from "./types/moduleInstance.js";
import type { CraftJob } from "./data/industryRecipes.js";

export interface ActiveScanTarget {
  startedAt: number;
  pulseRange: number;
  strength: number;
  angle: number;
  coneDeg: number;
}

export interface GameEffect {
  type: "floatText" | "explosion" | "shockwave" | "impact" | "beam";
  payload?: {
    x?: number;
    y?: number;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
    text?: string;
    color?: string;
    bgColor?: string;
    scale?: number;
    tier?: "small" | "medium" | "large" | number;
    width?: number;
  };
}

export interface HubDepositItem {
  id: string;
  kind: "asteroid" | "debris";
  label: string;
  mass: number;
  oreWeights?: number[];
  salvagePool?: WreckSalvageEntry[];
}

export interface HubDeposit {
  raw: HubDepositItem[];
  ore: Record<string, number>;
  loot: Record<string, number>;
  modules: ModuleInstance[];
}

export interface HubJob {
  id: string;
  kind: "asteroid" | "debris" | "smelt";
  startTime: number;
  duration: number;
  mass: number;
  oreWeights?: number[];
  salvagePool?: WreckSalvageEntry[];
  smeltRecipeId?: string;
  smeltQty?: number;
}

export interface HubOutput {
  loot: Record<string, number>;
  ore: Record<string, number>;
  refined?: Record<string, number>;
  modules: ModuleInstance[];
}

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
  inputKeys?: { space: boolean } | null;
  inputMouseWorld?: { x: number; y: number } | null;
  waypoint?: { x: number; y: number } | null;
  navCommand?: { mode: "orbit" | "keepRange"; targetId: string; rangePx: number; dir: 1 | -1 } | null;
  gateCooldowns?: Record<string, number>;
  gatesCleared?: string[];
  tutorial: { active: boolean; step: number; completed: boolean; skipped: boolean; stepEnteredAt?: number };
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
  detectedSignatures: SignatureContact[];
  activeScan: ActiveScanTarget | null;
  scannerAngle: number;
  scannerConeDeg: number;
  mapScannerActive: boolean;
  mapScannerStrength: number;
}

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
  players: Map<string, Player>;
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
  tractor: TractorState;
  warpCooldown: number;
  warpTargetIdx: number;
  GALAXY: System[];
  STARS: Star[];
  STARS_FAR: Star[];
  STARS_NEAR: Star[];
  DUST: DustParticle[];
  _statsCache: ComputedStats | null;
  spatialGrid: SpatialGrid | null;
  pendingEffects: GameEffect[];
}

export interface ClientState {
  mode: AppMode;
  keys: Record<string, boolean>;
  mouse: { x: number; y: number; lmb: boolean; rmb: boolean };
  mouseWorld: { x: number; y: number };
  camx: number; camy: number;
  zoom: number;
  waypoint: { x: number; y: number } | null;
  navCommand: { mode: "orbit" | "keepRange"; targetId: string; rangePx: number; dir: 1 | -1 } | null;
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
  mapPanX: number;
  mapPanY: number;
  mapZoom: number;
  multiplayerRole?: "none" | "host" | "client" | null;
  pauseOpen: boolean;
  mapDragging: boolean;
  mapDragLastSx: number;
  mapDragLastSy: number;
  systemMapTransform?: unknown;
  mapScannerAngleDeg: number;
  typingPlayers: Set<string>;
  chatBubbles: Map<string, { text: string; expiresAt: number }>;
}

export const _G: GameState = {
  P: null as unknown as Player,  // overwritten in main.ts init() before any game code runs
  players: new Map(),
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
  tractor: { active: false, targetId: null, tooHeavy: false, x1: 0, y1: 0, x2: 0, y2: 0, phase: 0 },
  warpCooldown: 0,
  warpTargetIdx: -1,
  GALAXY: [],
  STARS: [],
  STARS_FAR: [],
  STARS_NEAR: [],
  DUST: [],
  _statsCache: null,
  spatialGrid: null,
  pendingEffects: [],
};

export const Client: ClientState = {
  mode: AppMode.TITLE,
  keys: {},
  mouse: { x: 0, y: 0, lmb: false, rmb: false },
  mouseWorld: { x: 0, y: 0 },
  camx: 0,
  camy: 0,
  zoom: 1.0,
  waypoint: null,
  navCommand: null,
  cursorUnlocked: false,
  combatHeat: 0,
  showMap: false,
  showSystemMap: false,
  stationOpen: false,
  activeStation: null,
  bridgeOpen: false,
  overviewOpen: false,
  bridgeWindowZ: 220,

  settingsOpen: false,
  skillsOpen: false,
  settings: { ...DEFAULT_SETTINGS },
  showPerf: false,
  gameStarted: false,
  _lastBridgeRender: 0,
  mapPanX: 0,
  mapPanY: 0,
  mapZoom: 1.0,
  multiplayerRole: null,
  pauseOpen: false,
  mapDragging: false,
  mapDragLastSx: 0,
  mapDragLastSy: 0,
  systemMapTransform: null,
  mapScannerAngleDeg: 0,
  typingPlayers: new Set(),
  chatBubbles: new Map(),
};

export function isPlayerReady(): boolean {
  return _G.P !== null && _G.P !== undefined;
}

export function isGameplayPaused(): boolean {
  return Client.settingsOpen;
}
