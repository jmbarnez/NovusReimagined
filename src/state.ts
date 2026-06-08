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
import type {
  RefiningHeatMode,
  BulkMaterialKind,
  RefineryStorageKind,
  BulkMaterialStack,
  RefineryStorageUnit,
  DiscoveredAlloy,
  AlloyCodex,
  MixedOreCargo,
  HubDepositItem,
  HubDeposit,
  HubJob,
  HubOutput,
  MiningLaserState,
  SalvagerState,
  TractorState,
  Player,
  ActiveScanTarget,
  GameEffect,
  ImpactDecal,
  GameState,
  ClientState,
} from "./state/types/index.js";
import { AppMode } from "./state/types/index.js";

// Re-export all types from state/types/
export type {
  RefiningHeatMode,
  BulkMaterialKind,
  RefineryStorageKind,
  BulkMaterialStack,
  RefineryStorageUnit,
  DiscoveredAlloy,
  AlloyCodex,
  MixedOreCargo,
  HubDepositItem,
  HubDeposit,
  HubJob,
  HubOutput,
  MiningLaserState,
  SalvagerState,
  TractorState,
  Player,
  ActiveScanTarget,
  GameEffect,
  ImpactDecal,
  GameState,
  ClientState,
} from "./state/types/index.js";

// Re-export AppMode as a value (enum)
export { AppMode } from "./state/types/index.js";

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
  perfAdvanced: false,
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
  warpGateHint: null,
};

export function isPlayerReady(): boolean {
  return _G.P !== null && _G.P !== undefined;
}

export function isGameplayPaused(): boolean {
  return Client.settingsOpen;
}
