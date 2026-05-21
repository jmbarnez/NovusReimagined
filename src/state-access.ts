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

import { G, type GameState, type Player } from "./state.js";

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
    vx?: number; vy?: number; va?: number;
    angle?: number; thrustFx?: boolean;
  }) {
    const p = G.P;
    if (data.x !== undefined) p.x = data.x;
    if (data.y !== undefined) p.y = data.y;
    if (data.vx !== undefined) p.vx = data.vx;
    if (data.vy !== undefined) p.vy = data.vy;
    if (data.va !== undefined) p.va = data.va;
    if (data.angle !== undefined) p.angle = data.angle;
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

  /** Update combat heat (Client state, not Player). */
  setCombatHeat(value: number) {
    // combatHeat lives on Client, not G.P
    // This accessor is a no-op placeholder for domain clarity
    // Use Client.combatHeat = value directly from the UI/input layer
    void value;
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
