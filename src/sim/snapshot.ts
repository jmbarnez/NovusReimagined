import type { GameState, Player } from "../state.js";
import { getStats } from "../player/player-stats.js";
import type { AutoTarget, LockSlot } from "../types/world.js";
import type { CraftJob } from "../data/industryRecipes.js";
import type { MissionContract } from "../data/missions.js";
import type { ModuleInstance } from "../types/moduleInstance.js";
import type { HubDeposit, HubJob, HubOutput } from "../state.js";

type TargetLockSnapshot = Pick<AutoTarget, "id" | "x" | "y" | "hp"> & {
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
  refined?: Record<string, number> | null;
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
  /** Ship class id for remote player entities (e.g. "scout"). */
  shipType?: string;
  /** Display callsign for remote player entities. */
  pilotName?: string;
  miningLaser?: { active: boolean; x1: number; y1: number; x2: number; y2: number; phase: number; hitR: number; hitNx: number; hitNy: number } | null;
  salvager?: { active: boolean; x1: number; y1: number; x2: number; y2: number; phase: number; targetPieceId: string | null } | null;
  tractor?: { active: boolean; x1: number; y1: number; x2: number; y2: number; phase: number; targetId: string | null; tooHeavy: boolean } | null;
  spinAngle?: number;
  spinVel?: number;
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

function setPlayerDiff(
  target: Partial<PlayerSnapshot>,
  key: keyof PlayerSnapshot,
  value: PlayerSnapshot[keyof PlayerSnapshot],
) {
  const writable = target as Record<keyof PlayerSnapshot, PlayerSnapshot[keyof PlayerSnapshot] | undefined>;
  writable[key] = value;
}

function setEntityDiff(
  target: Partial<EntitySnapshot>,
  key: keyof EntitySnapshot,
  value: EntitySnapshot[keyof EntitySnapshot],
) {
  const writable = target as Record<keyof EntitySnapshot, EntitySnapshot[keyof EntitySnapshot] | undefined>;
  writable[key] = value;
}

function snapshotTargetLock(target: AutoTarget | null | undefined, q: (v: number) => number): TargetLockSnapshot | null {
  if (!target) return null;
  return {
    id: target.id,
    x: q(target.x),
    y: q(target.y),
    hp: target.hp,
    name: target.name,
    alive: target.alive,
    depleted: target.depleted,
    sigRadius: target.sigRadius,
    vx: typeof target.vx === "number" ? q(target.vx) : undefined,
    vy: typeof target.vy === "number" ? q(target.vy) : undefined,
    radius: target.radius,
  };
}

export function createSnapshot(tick: number, state: GameState, subject: Player): WorldSnapshot {
  const q = (v: number) => Math.round(v * 100) / 100;
  const entities: EntitySnapshot[] = [];

  // Bullets
  for (const b of state.bullets) {
    entities.push({
      id: b.id,
      type: "bullet",
      x: q(b.x), y: q(b.y), vx: q(b.vx), vy: q(b.vy),
      dmg: b.dmg, color: b.color, sz: b.sz, trail: b.trail,
      kind: b.kind as string | null, weaponId: b.weaponId,
      hitChance: b.hitChance, targetId: b.targetId,
      homingTurnRate: b.homingTurnRate, accel: b.accel, maxSpeed: b.maxSpeed,
      dmgProfile: b.dmgProfile ? JSON.parse(JSON.stringify(b.dmgProfile)) : undefined
    });
  }

  // Enemy Bullets
  for (const eb of state.enemyBullets) {
    entities.push({
      id: eb.id,
      type: "enemyBullet",
      x: q(eb.x), y: q(eb.y), vx: q(eb.vx), vy: q(eb.vy),
      dmg: eb.dmg, color: eb.color, sz: eb.sz, trail: eb.trail,
      kind: eb.kind, ownerFaction: eb.ownerFaction, ownerId: eb.ownerId
    });
  }

    const sys = state.GALAXY[subject.sysIdx] || state.GALAXY[0];
    if (sys) {
      for (const en of sys.enemies) {
        if (en.alive) {
          entities.push({
            id: en.id,
            type: "enemy",
            x: q(en.x), y: q(en.y), vx: q(en.vx), vy: q(en.vy), angle: q(en.angle),
            hp: en.hp, maxHp: en.maxHp,
          });
        }
      }

      for (const ast of sys.asteroids) {
        entities.push({
          id: ast.id,
          type: "asteroid",
          x: q(ast.x), y: q(ast.y), vx: q(ast.vx || 0), vy: q(ast.vy || 0),
          hp: ast.hp, maxHp: ast.maxHp, depleted: ast.depleted,
          spinAngle: q(ast.spinAngle), spinVel: q(ast.spinVel),
        });
      }
    }

    if (state.players) {
      const selfNetId = subject.netId;
      for (const p of state.players.values()) {
        const netId = p.netId;
        if (!netId || netId === selfNetId || p.sysIdx !== subject.sysIdx) continue;
        entities.push({
          id: netId,
          type: "player",
          shipType: p.shipId,
          pilotName: p.pilotName?.trim() || undefined,
          x: q(p.x), y: q(p.y), vx: q(p.vx), vy: q(p.vy), angle: q(p.angle),
          hp: p.hp, maxHp: p.maxHp,
          miningLaser: p.miningLaser ? { ...p.miningLaser } : null,
          salvager: p.salvager ? { ...p.salvager } : null,
          tractor: p.tractor ? { ...p.tractor } : null,
        });
      }
    }

    // Wreck pieces
    for (const wp of state.wreckPieces) {
      entities.push({
        id: wp.id,
        type: "wreckpiece",
        x: q(wp.x), y: q(wp.y), vx: q(wp.vx), vy: q(wp.vy), angle: q(wp.angle),
        hp: wp.hp, maxHp: wp.maxHp,
        radius: wp.radius, pts: wp.pts, name: wp.name, age: wp.age, despawnTimer: wp.despawnTimer
      });
    }

    // Salvage pickups
    for (const sp of state.salvagePickups) {
      entities.push({
        id: sp.id,
        type: "salvagepickup",
        x: q(sp.x), y: q(sp.y), vx: q(sp.vx), vy: q(sp.vy),
        payload: sp.payload, qty: sp.qty, kind: sp.kind as string
      });
    }

  return {
    tick,
    player: {
      netId: subject.netId,
      x: q(subject.x),
      y: q(subject.y),
      vx: q(subject.vx),
      vy: q(subject.vy),
      va: q(subject.va),
      angle: subject.angle,
      hp: subject.hp,
      maxHp: subject.maxHp ?? 100,
      shield: subject.shield,
      maxShield: subject.maxShield ?? 100,
      energy: subject.energy,
      maxEnergy: getStats(subject).maxEnergy,
      credits: subject.credits,
      sysIdx: subject.sysIdx,
      homeSysIdx: subject.homeSysIdx,
      waypoint: subject.waypoint ? { x: q(subject.waypoint.x), y: q(subject.waypoint.y) } : null,
      navCommand: subject.navCommand ? { ...subject.navCommand } : null,
      miningLaser: subject.miningLaser ? { ...subject.miningLaser } : null,
      salvager: subject.salvager ? { ...subject.salvager } : null,
      tractor: subject.tractor ? { ...subject.tractor } : null,
      gateCooldowns: subject.gateCooldowns ? { ...subject.gateCooldowns } : null,
      gatesCleared: subject.gatesCleared ? [ ...subject.gatesCleared ] : null,
      targetLock: snapshotTargetLock(subject.targetLock, q),
      lockQueue: subject.lockQueue ? subject.lockQueue.map(s => ({ ...s })) : null,
      _assignTargetId: subject._assignTargetId,
      turretTargets: subject.turretTargets ? [ ...subject.turretTargets ] : null,
      highTargets: subject.highTargets ? [ ...subject.highTargets ] : null,
      slotActive: subject.slotActive ? JSON.parse(JSON.stringify(subject.slotActive)) : null,
      turretPower: subject.turretPower ? [ ...subject.turretPower ] : null,
      turretCds: subject.turretCds ? [ ...subject.turretCds ] : null,
      turretPowerCd: subject.turretPowerCd ? [ ...subject.turretPowerCd ] : null,
      slotPowerCd: subject.slotPowerCd ? JSON.parse(JSON.stringify(subject.slotPowerCd)) : null,
      moduleHp: subject.moduleHp ? JSON.parse(JSON.stringify(subject.moduleHp)) : null,
      fitting: subject.fitting ? JSON.parse(JSON.stringify(subject.fitting)) : null,
      ore: subject.ore ? { ...subject.ore } : null,
      refined: subject.refined ? { ...subject.refined } : null,
      loot: subject.loot ? { ...subject.loot } : null,
      components: subject.components ? { ...subject.components } : null,
      ammo: subject.ammo ? { ...subject.ammo } : null,
      blueprints: subject.blueprints ? { ...subject.blueprints } : null,
      skills: subject.skills ? { ...subject.skills } : null,
      skillXp: subject.skillXp ? { ...subject.skillXp } : null,
      xp: subject.xp,
      level: subject.level,
      craftQueue: subject.craftQueue ? subject.craftQueue.map((job) => ({ ...job })) : null,
      hubQueue: subject.hubQueue ? subject.hubQueue.map((job) => ({ ...job })) : null,
      hubOutput: subject.hubOutput ? JSON.parse(JSON.stringify(subject.hubOutput)) : null,
      hubDeposit: subject.hubDeposit ? JSON.parse(JSON.stringify(subject.hubDeposit)) : null,
      moduleCargo: subject.moduleCargo
        ? subject.moduleCargo.map((inst) => ({
          ...inst,
          affixes: inst.affixes.map((affix) => ({ ...affix })),
        }))
        : null,
      contracts: subject.contracts ? subject.contracts.map((contract) => ({ ...contract, objective: { ...contract.objective } })) : null,
      stationOffers: subject.stationOffers ? subject.stationOffers.map((c) => ({ ...c })) : null,
      stationOfferStationId: subject.stationOfferStationId ?? null,
    },
    entities,
  };
}

export function diffSnapshots(prev: WorldSnapshot, curr: WorldSnapshot): DeltaSnapshot {
  const delta: DeltaSnapshot = {
    tick: curr.tick,
    fromTick: prev.tick,
  };

  // Compare player properties
  const playerDiff: Partial<PlayerSnapshot> = {};
  let playerChanged = false;
  for (const key of Object.keys(curr.player) as (keyof PlayerSnapshot)[]) {
    const prevVal = prev.player[key];
    const currVal = curr.player[key];
    if (
      key === "miningLaser" ||
      key === "salvager" ||
      key === "tractor" ||
      key === "gateCooldowns" ||
      key === "gatesCleared" ||
      key === "targetLock" ||
      key === "lockQueue" ||
      key === "turretTargets" ||
      key === "highTargets" ||
      key === "slotActive" ||
      key === "turretPower" ||
      key === "turretCds" ||
      key === "turretPowerCd" ||
      key === "slotPowerCd" ||
      key === "moduleHp" ||
      key === "fitting" ||
      key === "ore" ||
      key === "refined" ||
      key === "loot" ||
      key === "components" ||
      key === "ammo" ||
      key === "blueprints" ||
      key === "skills" ||
      key === "skillXp" ||
      key === "craftQueue" ||
      key === "hubQueue" ||
      key === "hubOutput" ||
      key === "hubDeposit" ||
      key === "moduleCargo" ||
      key === "contracts" ||
      key === "stationOffers"
    ) {
      if (JSON.stringify(prevVal) !== JSON.stringify(currVal)) {
        setPlayerDiff(playerDiff, key, currVal);
        playerChanged = true;
      }
    } else {
      if (currVal !== prevVal) {
        setPlayerDiff(playerDiff, key, currVal);
        playerChanged = true;
      }
    }
  }
  if (playerChanged) {
    delta.player = playerDiff;
  }

  // Compare entities
  const prevMap = new Map<string | number, EntitySnapshot>();
  for (const e of prev.entities) prevMap.set(e.id, e);

  const currMap = new Map<string | number, EntitySnapshot>();
  for (const e of curr.entities) currMap.set(e.id, e);

  const spawned: EntitySnapshot[] = [];
  const updated: Partial<EntitySnapshot>[] = [];
  const destroyed: (string | number)[] = [];

  for (const [id, currEnt] of currMap) {
    const prevEnt = prevMap.get(id);
    if (!prevEnt) {
      spawned.push(currEnt);
    } else {
      const entDiff: Partial<EntitySnapshot> = { id: currEnt.id };
      let changed = false;
      for (const key of Object.keys(currEnt) as (keyof EntitySnapshot)[]) {
        const prevVal = prevEnt[key];
        const currVal = currEnt[key];
        if (key === "miningLaser" || key === "salvager" || key === "tractor" || key === "dmgProfile" || key === "pts") {
          if (JSON.stringify(prevVal) !== JSON.stringify(currVal)) {
            setEntityDiff(entDiff, key, currVal);
            changed = true;
          }
        } else {
          if (currVal !== prevVal) {
            setEntityDiff(entDiff, key, currVal);
            changed = true;
          }
        }
      }
      if (changed) {
        updated.push(entDiff);
      }
    }
  }

  for (const id of prevMap.keys()) {
    if (!currMap.has(id)) {
      destroyed.push(id);
    }
  }

  if (spawned.length || updated.length || destroyed.length) {
    delta.entities = {};
    if (spawned.length) delta.entities.spawned = spawned;
    if (updated.length) delta.entities.updated = updated;
    if (destroyed.length) delta.entities.destroyed = destroyed;
  }

  return delta;
}

export function applyDelta(base: WorldSnapshot, delta: DeltaSnapshot): WorldSnapshot {
  const player = { ...base.player, ...delta.player };
  const entMap = new Map<string | number, EntitySnapshot>();
  for (const e of base.entities) entMap.set(e.id, { ...e });

  if (delta.entities) {
    if (delta.entities.destroyed) {
      for (const id of delta.entities.destroyed) {
        entMap.delete(id);
      }
    }
    if (delta.entities.updated) {
      for (const u of delta.entities.updated) {
        const existing = entMap.get(u.id!);
        if (existing) {
          Object.assign(existing, u);
        }
      }
    }
    if (delta.entities.spawned) {
      for (const s of delta.entities.spawned) {
        entMap.set(s.id, { ...s });
      }
    }
  }

  return {
    tick: delta.tick,
    player,
    entities: Array.from(entMap.values()),
  };
}
