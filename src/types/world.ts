/**
 * Shared structural interfaces for world entities.
 *
 * These describe the *runtime* shape of objects produced by world-gen and
 * mutated by physics/combat. They are intentionally lenient (many fields
 * optional) because the same object shape evolves through its lifecycle
 * (e.g. `_liveEnemies` cached on a System, `_lastPlayerHitAt` stamped on
 * an Enemy). The goal is autocomplete and safer refactors, not airtight
 * invariant enforcement.
 */

import type { ModuleDef } from "../data/modules.js";
import { ModuleInstance } from "./moduleInstance.js";
import type { Player } from "../state.js";

// ── Sensor lock state ────────────────────────────────────────────────────

export interface LockSlot {
  id: string;
  resolving: boolean;
  acc: number;
}

/**
 * Resolved primary target (Enemy or Asteroid). Defined as a structural
 * shape rather than a discriminated union so callers don't need to narrow
 * before reading common fields like `name`/`alive`/`depleted`.
 */
export interface AutoTarget {
  id: string;
  x: number;
  y: number;
  hp: number;
  name?: string;
  alive?: boolean;
  depleted?: boolean;
  sigRadius?: number;
  vx?: number;
  vy?: number;
  radius?: number;
}

// ── Galaxy geometry ──────────────────────────────────────────────────────

export interface StationTurret {
  angle: number;
  orbitRadius: number;
  orbitSpeed: number;
  shootCd: number;
  // Set during physics tick (orbit position + targeting state)
  x?: number;
  y?: number;
  target?: Enemy | null;
  faceAngle?: number;
  muzzleFlash?: number;
}

export interface Station {
  id: string;
  name: string;
  x: number;
  y: number;
  radius: number;
  spin: number;
  isHome: boolean;
  services: string[];
  safeRadius: number;
  turrets: StationTurret[];
  structureType?: "standard" | "home" | "industrial";
  isProcessingHub?: boolean;
  collectRadius?: number;
  dropZoneOffset?: { dx?: number; dy?: number; x?: number; y?: number };
  dropZoneRadius?: number;
  _orbitSpeed?: number;
}

export type GateFxProfile = "sector" | "tutorial-return" | "temporary";

export interface Gate {
  id?: string;
  x: number;
  y: number;
  px: number;
  py: number;
  target: {
    kind: "local";
    x: number;
    y: number;
    label: string;
  };
  targetSysIdx?: number;
  radius: number;
  spin: number;
  angle?: number;
  _orbitSpeed?: number;
  gateState?: "dormant" | "charging" | "active" | "warping" | "cooldown";
  chargeProgress?: number;
  cooldownTimer?: number;
  dispenseTimer?: number | null;
  isTemporary?: boolean;
  activationRadius?: number;
  fxProfile?: GateFxProfile;
}

export interface Planet {
  name?: string;
  x: number;
  y: number;
  radius: number;
  hue: number;
  sat: number;
  lit: number;
  hasRing: boolean;
  ringTilt: number;
  moons: number;
  _orbitSpeed?: number;
}

// ── NPCs and asteroids ───────────────────────────────────────────────────

export interface EnemyFitting {
  turret?: (string | null)[];
  high?: (string | null)[];
  med?: (string | null)[];
  low?: (string | null)[];
  _tempInstances?: import("./moduleInstance.js").ModuleInstance[];
  [key: string]: (string | null)[] | import("./moduleInstance.js").ModuleInstance[] | undefined;
}

export interface ResistProfile {
  em: number;
  therm: number;
  kin: number;
  exp: number;
}

// ── Enemy sub-interfaces (same runtime shape, explicit domain separation) ──

export interface EnemyIdentity {
  id: string;
  type: string;
  name: string;
  credits: number;
  loot: Record<string, number>;
  level?: number;
  alive: boolean;
  respawnTimer: number;
}

export interface EnemyPhysics {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  angle: number;
  prevAngle: number;
  speed: number;
  spawnX: number;
  spawnY: number;
  radius?: number;
  sigRadius: number;
}

export interface EnemyCombat {
  hp: number;
  maxHp: number;
  aggroRange: number;
  weaponRange?: number;
  accuracy?: number;
  fitting: EnemyFitting;
  turretCds: number[];
  shield?: number;
  maxShield?: number;
  structure?: number;
  maxStructure?: number;
  weaponMult?: number;
  resists?: ResistProfile;
  _lastHitByPlayer?: Player;
}

export interface EnemyAI {
  targetingPlayer?: boolean;
  hasLockOnPlayer?: boolean;
  lockOnTimer?: number;
  thrustFx?: boolean;
  _orbitDir?: 1 | -1;
  _lastPlayerHitAt?: number;
  _lastPlayerHitKind?: "projectile" | "beam" | "missile";
  _npcTarget?: Enemy | Player | null;
  _npcLockTimer?: number;
  _npcHasLock?: boolean;
}

export interface EnemyVisual {
  shieldHitGlow?: number;
  shieldHitAngle?: number;
  structureHitGlow?: number;
}

export interface EnemyFaction {
  faction?: "hostile" | "neutral" | "player" | "friendly";
  hailable?: boolean;
  commsRange?: number;
  _speech?: { text: string; until: number };
}

export interface EnemyTask {
  _task?: "transit-in" | "goto-station" | "dwell" | "mine" | "patrol" | "engage" | "depart";
  _taskTimer?: number;
  _wpX?: number;
  _wpY?: number;
  _exitGateIdx?: number;
  _mineTargetId?: string;
}

export interface Enemy extends
  EnemyIdentity,
  EnemyPhysics,
  EnemyCombat,
  EnemyAI,
  EnemyVisual,
  EnemyFaction,
  EnemyTask
{
  // Temporary module instances stored on the fitting at spawn time
  _tempInstances?: import("./moduleInstance.js").ModuleInstance[];
}

export interface AsteroidCrystal {
  x: number;
  y: number;
  size: number;
  rot: number;
}

export interface Asteroid {
  id: string;
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  radius: number;
  shape: number[][];
  hp: number;
  maxHp: number;
  composition: Record<string, number>;
  richness: number;
  depleted: boolean;
  respawnTimer: number;
  spinAngle: number;
  spinVel: number;
  prevSpin: number;
  tintHue: number;
  tintSat: number;
  name?: string;
  hasCrystals?: boolean;
  crystalHue?: number;
  crystals?: AsteroidCrystal[];
  spawnX?: number;
  spawnY?: number;
  _orbitSpeed?: number;
}

// ── Hidden Sites ─────────────────────────────────────────────────────────

export type HiddenSiteFamily = "resource" | "derelict" | "relic" | "combat" | string;

export interface HiddenSite {
  id: string;
  systemId: number;
  family: HiddenSiteFamily;
  name: string;
  x: number;
  y: number;
  threatLevel: number;
  signatureStrength: number;
  signatureSize: number;
  scanDifficulty: number;
  decryptDifficulty: number;
  state: "hidden" | "detected" | "resolved" | "cleared";
  rewardSeed: number;
  hasEncryptedContent: boolean;
  siteTypeId: string;
  requiredSurveyLevel: number;
  isTutorialSite?: boolean;
  _orbitSpeed?: number;
}

export type SignatureClassification = "relic" | "derelict" | "resource" | "combat" | "unknown" | string;
export type SignatureStrengthLabel = "weak" | "medium" | "strong";

export interface SignatureContact {
  siteId: string;
  systemId: number;
  signalStrength: number;
  progress: number;
  confidence: number;
  state: "detected" | "classified" | "resolved";
  bearingDeg: number;
  bearingErrorDeg: number;
  classification: SignatureClassification;
  strengthLabel: SignatureStrengthLabel;
  driftPhase: number;
  lastKnownX: number;
  lastKnownY: number;
  pulseSamples: number;
  lastPulseX: number;
  lastPulseY: number;
  parallaxFactor: number;
}


// ── System ───────────────────────────────────────────────────────────────

export interface System {
  idx: number;
  id: string;
  name: string;
  security: number;
  mapX: number;
  mapY: number;
  ring: number;
  links: number[];
  _ready: boolean;
  asteroids: Asteroid[];
  enemies: Enemy[];
  gates: Gate[];
  stations: Station[];
  planets: Planet[];
  nebulaHues: number[];
  starHue: number;
  hiddenSites?: HiddenSite[];
  _isNovusPrime?: boolean;

  // Visual identity fields (A1)
  archetype?: string;
  starClass?: string;
  sunDir?: number;
  sunDist?: number;
  tintRGB?: [number, number, number];
  flareTint?: number;
  flareTimer?: number;

  // Cached views rebuilt by physics each tick
  _liveEnemies?: Enemy[];
  _liveAsteroids?: Asteroid[];
  _enemyMap?: Map<string, Enemy>;
  _asteroidMap?: Map<string, Asteroid>;

}

// ── Background scenery ───────────────────────────────────────────────────

export interface Star {
  ox: number;
  oy: number;
  r: number;
  a: number;
  hue: number;
}

export interface DustParticle {
  ox: number;
  oy: number;
  r: number;
  a: number;
  drift: number;
  parallax: number;
}

// ── Loot drops ───────────────────────────────────────────────────────────

export interface WreckSalvageEntry {
  id: string;
  weight: number;
}

/**
 * Physics-enabled debris fragment from a destroyed ship. Drifts dormantly
 * after the initial outward explosion, has its own HP, and can be locked
 * and salvaged independently of the loot container.
 */
export interface WreckPiece {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  angularVel: number;
  /** Polygon fragment in local space (subset of enemy hull path). */
  pts: [number, number][];
  /** Bounding radius for spatial grid and collision resolution. */
  radius: number;
  type: string;
  name: string;
  hp: number;
  maxHp: number;
  /** Seconds since spawn — used for fade-in / explosion phase visuals. */
  age: number;
  despawnTimer: number;
  salvagePool: WreckSalvageEntry[];
  bob: number;
  hitFlash: number;
}

/** Floating loot drop that auto-collects on proximity. */
export interface SalvagePickup {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  bob: number;
  kind: "loot" | "module" | "ore" | "credits";
  /** Loot key, module id, ore key, or "credits". */
  payload: string;
  qty: number;
  /** Mixed ore chunk composition; present for asteroid-derived ore pickups. */
  composition?: Record<string, number>;
  /** Generated mixed ore display name. */
  name?: string;
  /** Asteroid richness that produced this chunk. */
  richness?: number;
  instance?: ModuleInstance;
}

// ── Module references re-exported for convenience ────────────────────────

export type { ModuleDef };
