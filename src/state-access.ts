/**
 * State access layer — controlled entry point to the G singleton.
 *
 * Goal: Replace direct G / G.P mutations across the codebase with
 * explicit accessor functions. This makes data flow auditable and
 * paves the way for future encapsulation (e.g. server-authoritative
 * architecture, immutable snapshots, replay systems).
 *
 * Usage:
 *   import { getState, PlayerAccess } from "./state-access.js";
 *
 *   const state = getState();
 *   const credits = state.player.credits;
 *
 *   PlayerAccess.modifyCredits(500);
 */

import { G, Client, type GameState, type Player } from "./state.js";
import type { ModuleInstance } from "./types/moduleInstance.js";
import type { LockSlot } from "./types/world.js";
import type { CraftJob } from "./data/industryRecipes.js";
import type { MissionContract } from "./data/missions.js";

// ─── Read-only snapshot interface ────────────────────────────────────────────

export interface ReadOnlyState {
  player: Player;
  bullets: GameState["bullets"];
  enemyBullets: GameState["enemyBullets"];
  beams: GameState["beams"];
  particles: GameState["particles"];
  shockwaves: GameState["shockwaves"];
  floatTexts: GameState["floatTexts"];
  trails: GameState["trails"];
  wreckPieces: GameState["wreckPieces"];
  salvagePickups: GameState["salvagePickups"];
  impactDecals: GameState["impactDecals"];
  miningLaser: GameState["miningLaser"];
  salvager: GameState["salvager"];
  warpCooldown: GameState["warpCooldown"];
  warpTargetIdx: GameState["warpTargetIdx"];
  spatialGrid: GameState["spatialGrid"];
  STARS: GameState["STARS"];
  STARS_FAR: GameState["STARS_FAR"];
  STARS_NEAR: GameState["STARS_NEAR"];
  DUST: GameState["DUST"];
  GALAXY: GameState["GALAXY"];
}

/**
 * Returns a read-only view of the current game state.
 * The returned object references live arrays — do not mutate them directly.
 * Use the domain-specific accessors below for mutations.
 */
export function getState(): ReadOnlyState {
  return {
    player: G.P,
    bullets: G.bullets,
    enemyBullets: G.enemyBullets,
    beams: G.beams,
    particles: G.particles,
    shockwaves: G.shockwaves,
    floatTexts: G.floatTexts,
    trails: G.trails,
    wreckPieces: G.wreckPieces,
    salvagePickups: G.salvagePickups,
    impactDecals: G.impactDecals,
    miningLaser: G.miningLaser,
    salvager: G.salvager,
    warpCooldown: G.warpCooldown,
    warpTargetIdx: G.warpTargetIdx,
    spatialGrid: G.spatialGrid,
    STARS: G.STARS,
    STARS_FAR: G.STARS_FAR,
    STARS_NEAR: G.STARS_NEAR,
    DUST: G.DUST,
    GALAXY: G.GALAXY,
  };
}

// ─── Player accessors ────────────────────────────────────────────────────────

export const PlayerAccess = {
  /** Update player position & velocity in one call. */
  updatePhysics(data: {
    x?: number; y?: number;
    px?: number; py?: number;
    vx?: number; vy?: number; va?: number;
    angle?: number; prevAngle?: number;
    thrustFx?: boolean;
  }) {
    const p = G.P;
    if (data.x !== undefined) p.x = data.x;
    if (data.y !== undefined) p.y = data.y;
    if (data.px !== undefined) p.px = data.px;
    if (data.py !== undefined) p.py = data.py;
    if (data.vx !== undefined) p.vx = data.vx;
    if (data.vy !== undefined) p.vy = data.vy;
    if (data.va !== undefined) p.va = data.va;
    if (data.angle !== undefined) p.angle = data.angle;
    if (data.prevAngle !== undefined) p.prevAngle = data.prevAngle;
    if (data.thrustFx !== undefined) p.thrustFx = data.thrustFx;
  },

  /** Modify player credits (positive = gain, negative = spend). */
  modifyCredits(amount: number) {
    G.P.credits += amount;
  },

  /** Set a fitting slot to a module UID or null. */
  setFittingSlot(rack: string, idx: number, uid: string | null) {
    if (!G.P.fitting[rack]) G.P.fitting[rack] = [];
    G.P.fitting[rack][idx] = uid;
  },

  /** Set module HP for a slot. */
  setModuleHp(rack: string, idx: number, hp: number | null) {
    if (!G.P.moduleHp[rack]) G.P.moduleHp[rack] = [];
    G.P.moduleHp[rack][idx] = hp;
  },

  /** Set slot active state. */
  setSlotActive(rack: string, idx: number, active: boolean) {
    if (!G.P.slotActive[rack]) G.P.slotActive[rack] = [];
    G.P.slotActive[rack][idx] = active;
  },

  /** Update turret power state. */
  setTurretPower(idx: number, powered: boolean) {
    if (!G.P.turretPower) G.P.turretPower = [];
    G.P.turretPower[idx] = powered;
  },

  /** Update turret power cooldown. */
  setTurretPowerCd(idx: number, cd: number) {
    if (!G.P.turretPowerCd) G.P.turretPowerCd = [];
    G.P.turretPowerCd[idx] = cd;
  },

  /** Update turret cooldown. */
  setTurretCd(idx: number, cd: number) {
    if (!G.P.turretCds) G.P.turretCds = [];
    G.P.turretCds[idx] = cd;
  },

  /** Update shield value. */
  setShield(value: number) {
    G.P.shield = value;
  },

  /** Update HP value. */
  setHp(value: number) {
    G.P.hp = value;
  },

  /** Update structure value. */
  setStructure(value: number) {
    G.P.structure = value;
  },

  /** Update energy value. */
  setEnergy(value: number) {
    G.P.energy = value;
  },

  /** Update slot heat. */
  setSlotHeat(rack: string, idx: number, heat: number) {
    if (!G.P.slotHeat) G.P.slotHeat = {};
    if (!G.P.slotHeat[rack]) G.P.slotHeat[rack] = [];
    G.P.slotHeat[rack][idx] = heat;
  },

  /** Update invincibility timer. */
  setInvincible(value: number) {
    G.P.invincible = value;
  },

  /** Update collision cooldown. */
  setColCooldown(value: number) {
    G.P._colCooldown = value;
  },

  /** Update shield hit glow. */
  setShieldHitGlow(value: number) {
    G.P.shieldHitGlow = value;
  },

  /** Update shield hit angle. */
  setShieldHitAngle(value: number) {
    G.P.shieldHitAngle = value;
  },

  /** Update hull hit glow. */
  setHullHitGlow(value: number) {
    G.P.hullHitGlow = value;
  },

  /** Update hull hit angle. */
  setHullHitAngle(value: number) {
    G.P.hullHitAngle = value;
  },

  /** Update structure hit glow. */
  setStructureHitGlow(value: number) {
    G.P.structureHitGlow = value;
  },

  /** Update structure hit angle. */
  setStructureHitAngle(value: number) {
    G.P.structureHitAngle = value;
  },

  /** Update combat heat (Client state). */
  setCombatHeat(value: number) {
    Client.combatHeat = value;
  },

  /** Update target lock. */
  setTargetLock(target: Player["targetLock"]) {
    G.P.targetLock = target;
  },

  /** Update lock queue. */
  setLockQueue(queue: Player["lockQueue"]) {
    G.P.lockQueue = queue;
  },

  /** Update fire control slot. */
  setFireControlSlot(slot: number) {
    G.P.fireControlSlot = slot;
  },

  /** Update turret targets. */
  setTurretTarget(idx: number, targetId: string | null) {
    if (!G.P.turretTargets) G.P.turretTargets = [];
    G.P.turretTargets[idx] = targetId;
  },

  /** Update shoot cooldown. */
  setShootCd(value: number) {
    G.P.shootCd = value;
  },

  /** Update mine cooldown. */
  setMineCd(value: number) {
    G.P.mineCd = value;
  },

  /** Update recoil frames. */
  setRecoilFrames(value: number) {
    G.P.recoilFrames = value;
  },

  /** Update XP. */
  setXp(value: number) {
    G.P.xp = value;
  },

  /** Update level. */
  setLevel(value: number) {
    G.P.level = value;
  },

  /** Update kills. */
  setKills(value: number) {
    G.P.kills = value;
  },

  /** Update skill XP. */
  setSkillXp(skillId: string, value: number) {
    G.P.skillXp[skillId] = value;
  },

  /** Update skill level. */
  setSkill(skillId: string, level: number) {
    G.P.skills[skillId] = level;
  },

  /** Update ammo. */
  setAmmo(type: "hybrid" | "missile", value: number) {
    G.P.ammo[type] = value;
  },

  /** Update ore. */
  setOre(type: string, value: number) {
    G.P.ore[type] = value;
  },

  /** Update refined. */
  setRefined(type: string, value: number) {
    G.P.refined[type] = value;
  },

  /** Update loot. */
  setLoot(type: string, value: number) {
    G.P.loot[type] = value;
  },

  /** Update components. */
  setComponents(type: string, value: number) {
    G.P.components[type] = value;
  },

  /** Update contracts. */
  setContracts(contracts: Player["contracts"]) {
    G.P.contracts = contracts;
  },

  /** Update craft queue. */
  setCraftQueue(queue: Player["craftQueue"]) {
    G.P.craftQueue = queue;
  },

  /** Update blueprints. */
  setBlueprint(id: string, owned: boolean) {
    G.P.blueprints[id] = owned;
  },

  // ─── Bulk setters & additional fields ────────────────────────────────────

  /** Set current system index. */
  setSysIdx(value: number) {
    G.P.sysIdx = value;
  },

  /** Set max HP. */
  setMaxHp(value: number) {
    G.P.maxHp = value;
  },

  /** Set max structure. */
  setMaxStructure(value: number) {
    G.P.maxStructure = value;
  },

  /** Set max shield. */
  setMaxShield(value: number) {
    G.P.maxShield = value;
  },

  /** Set combat bar state. */
  setCombatBar(bar: Player["combatBar"]) {
    G.P.combatBar = bar;
  },

  /** Set internal assign-target ID. */
  setAssignTargetId(id: string | null) {
    G.P._assignTargetId = id;
  },

  /** Set high-slot target. */
  setHighTarget(idx: number, targetId: string | null) {
    if (!G.P.highTargets) G.P.highTargets = [];
    G.P.highTargets[idx] = targetId;
  },

  /** Set pending home spawn flag. */
  setPendingHomeSpawn(value: boolean) {
    G.P.pendingHomeSpawn = value;
  },

  /** Add a module instance to cargo. */
  addModuleCargo(inst: ModuleInstance) {
    G.P.moduleCargo.push(inst);
  },

  /** Bulk-replace all slot active states. */
  setSlotActiveAll(record: Record<string, boolean[]>) {
    G.P.slotActive = record;
  },

  /** Bulk-replace all module HP. */
  setModuleHpAll(record: Record<string, (number | null)[]>) {
    G.P.moduleHp = record;
  },

  /** Bulk-replace turret targets array. */
  setTurretTargetsAll(targets: (string | null)[]) {
    G.P.turretTargets = targets;
  },

  /** Bulk-replace turret cooldowns array. */
  setTurretCdsAll(cds: number[]) {
    G.P.turretCds = cds;
  },

  /** Bulk-replace turret power states. */
  setTurretPowerAll(powers: boolean[]) {
    G.P.turretPower = powers;
  },

  /** Bulk-replace turret power cooldowns. */
  setTurretPowerCdAll(cds: number[]) {
    G.P.turretPowerCd = cds;
  },

  /** Bulk-replace all slot heat. */
  setSlotHeatAll(heat: Record<string, number[]>) {
    G.P.slotHeat = heat;
  },

  /** Set shield cooldown. */
  setShieldCd(value: number) {
    G.P.shieldCd = value;
  },

  /** Set home system index. */
  setHomeSysIdx(value: number) {
    G.P.homeSysIdx = value;
  },

  /** Remove a module from cargo by index. */
  removeModuleCargo(index: number) {
    G.P.moduleCargo.splice(index, 1);
  },

  /** Add a craft job to the queue. */
  addCraftJob(job: CraftJob) {
    G.P.craftQueue.push(job);
  },

  /** Remove a craft job by index. */
  removeCraftJob(index: number) {
    G.P.craftQueue.splice(index, 1);
  },

  /** Add an accepted contract. */
  addContract(contract: MissionContract) {
    G.P.contracts.push(contract);
  },

  /** Remove a contract by index. */
  removeContract(index: number) {
    G.P.contracts.splice(index, 1);
  },

  /** Splice lockQueue at index. Returns removed items. */
  spliceLockQueue(index: number, deleteCount: number) {
    return G.P.lockQueue.splice(index, deleteCount);
  },

  /** Unshift an item onto lockQueue. */
  unshiftLockQueue(item: LockSlot) {
    G.P.lockQueue.unshift(item);
  },

  /** Pop the last item from lockQueue. */
  popLockQueue() {
    return G.P.lockQueue.pop();
  },
};

// ─── World accessors ─────────────────────────────────────────────────────────

export const WorldAccess = {
  /** Set warp cooldown. */
  setWarpCooldown(value: number) {
    G.warpCooldown = value;
  },

  /** Set warp target index. */
  setWarpTargetIdx(value: number) {
    G.warpTargetIdx = value;
  },

  /** Set spatial grid. */
  setSpatialGrid(grid: GameState["spatialGrid"]) {
    G.spatialGrid = grid;
  },

  /** Set star field (medium parallax layer). */
  setStars(stars: GameState["STARS"]) {
    G.STARS = stars;
  },

  /** Set far star field (slow parallax layer). */
  setStarsFar(stars: GameState["STARS_FAR"]) {
    G.STARS_FAR = stars;
  },

  /** Set near star field (fast parallax layer). */
  setStarsNear(stars: GameState["STARS_NEAR"]) {
    G.STARS_NEAR = stars;
  },

  /** Set dust particle field. */
  setDust(dust: GameState["DUST"]) {
    G.DUST = dust;
  },

  /** Set galaxy systems array (boot-time init). */
  setGalaxy(galaxy: GameState["GALAXY"]) {
    G.GALAXY = galaxy;
  },

  /** Initialize player state (boot-time init). */
  initPlayer(player: Player) {
    G.P = player;
  },
};

// ─── Mining laser accessors ──────────────────────────────────────────────────

export const MiningAccess = {
  /** Update mining laser state. */
  update(data: Partial<GameState["miningLaser"]>) {
    Object.assign(G.miningLaser, data);
  },
};

// ─── Salvager accessors ──────────────────────────────────────────────────────

export const SalvagerAccess = {
  /** Update salvager state. */
  update(data: Partial<GameState["salvager"]>) {
    Object.assign(G.salvager, data);
  },
};

// ─── Client Navigation accessors ─────────────────────────────────────────────

/** Set active navigation command and clear waypoint. */
export function setNavCommand(cmd: typeof Client.navCommand) {
  Client.navCommand = cmd;
  if (cmd) {
    Client.waypoint = null;
  }
}

/** Clear active navigation command. */
export function clearNav() {
  Client.navCommand = null;
}

