import type { Bullet, EnemyBullet, Beam, Particle, Shockwave, FloatText, Trail } from "../../utils/entities.js";
import type { WreckPiece, SalvagePickup } from "../../types/system.js";
import type { ComputedStats } from "../../player/player-stats.js";
import type { SpatialGrid } from "../../utils/spatial.js";
import type { System, Star, DustParticle } from "../../types/system.js";
import type { MiningLaserState, SalvagerState, TractorState } from "./player.js";

export interface ActiveScanTarget {
  startedAt: number;
  pulseRange: number;
  strength: number;
  angle: number;
  coneDeg: number;
}

export interface GameEffect {
  type: "floatText" | "explosion" | "shockwave" | "impact" | "beam" | "weaponFire" | "shieldImpact" | "hullImpact" | "hostileLocking" | "hostileLock" | "underAttackPulse" | "industrialBeam" | "blip" | "gateBoostParticles";
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
    delivery?: string;
    typeId?: string;
    vol?: number;
    count?: number;
    gateId?: string;
    angle?: number;
    halfWidth?: number;
    isForward?: boolean;
  };
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
  P: import("./player.js").Player;
  players: Map<string, import("./player.js").Player>;
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
