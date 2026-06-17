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
  _tempInstances?: ModuleInstance[];
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
  _orbitDir?: 1 | -1;
  _lastPlayerHitAt?: number;
  _lastPlayerHitKind?: "projectile" | "beam" | "missile";
  _npcTarget?: Enemy | Player | null;
  _npcLockTimer?: number;
  _npcHasLock?: boolean;
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
  EnemyFaction,
  EnemyTask
{
  // Temporary module instances stored on the fitting at spawn time
  _tempInstances?: ModuleInstance[];
}
