/**
 * Enemy entity structural types.
 */

import type { Player } from "../state.js";
import { ModuleInstance } from "./moduleInstance.js";

export interface EnemyFitting {
  turret?: (string | null)[];
  high?: (string | null)[];
  med?: (string | null)[];
  low?: (string | null)[];
  tempInstances?: ModuleInstance[];
  [key: string]: (string | null)[] | ModuleInstance[] | undefined;
}

export interface ResistProfile {
  em: number;
  therm: number;
  kin: number;
  exp: number;
}

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
  /** Angular velocity from collision impulses (rad/s). AI steering sets angle directly. */
  angularVel: number;
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
  lastHitByPlayer?: Player;
  lastPlayerHitAt?: number;
  lastPlayerHitKind?: "projectile" | "beam" | "missile";
}

export interface EnemyFaction {
  faction?: "hostile" | "neutral" | "player" | "friendly";
  hailable?: boolean;
  commsRange?: number;
}

export interface Enemy extends
  EnemyIdentity,
  EnemyPhysics,
  EnemyCombat,
  EnemyFaction
{
  // Temporary module instances stored on the fitting at spawn time
  tempInstances?: ModuleInstance[];
}
