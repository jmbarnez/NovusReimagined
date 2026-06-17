/**
 * System, hidden sites, signatures, and debris structural types.
 */

import type { Asteroid } from "./asteroid.js";
import type { Enemy } from "./enemy.js";
import type { Gate, Station, Planet } from "./station.js";
import { ModuleInstance } from "./moduleInstance.js";

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
