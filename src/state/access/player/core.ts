import { _G, Client, type Player } from "../../../state.js";

export const playerCoreAccess = {
  updatePhysics(data: {
    x?: number; y?: number;
    px?: number; py?: number;
    vx?: number; vy?: number; va?: number;
    angle?: number; prevAngle?: number;
    thrustFx?: boolean;
    boostFx?: boolean;
    boostLockout?: boolean;
  }, p: Player = _G.P) {
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
    if (data.boostFx !== undefined) p.boostFx = data.boostFx;
    if (data.boostLockout !== undefined) p.boostLockout = data.boostLockout;
  },

  setShield(value: number, p: Player = _G.P) {
    p.shield = value;
  },

  setHp(value: number, p: Player = _G.P) {
    p.hp = value;
  },

  setStructure(value: number, p: Player = _G.P) {
    p.structure = value;
  },

  setEnergy(value: number, p: Player = _G.P) {
    p.energy = value;
  },

  setInvincible(value: number, p: Player = _G.P) {
    p.invincible = value;
  },

  setColCooldown(value: number, p: Player = _G.P) {
    p._colCooldown = value;
  },

  setShieldHitGlow(value: number, p: Player = _G.P) {
    p.shieldHitGlow = value;
  },

  setShieldHitAngle(value: number, p: Player = _G.P) {
    p.shieldHitAngle = value;
  },

  setHullHitGlow(value: number, p: Player = _G.P) {
    p.hullHitGlow = value;
  },

  setHullHitAngle(value: number, p: Player = _G.P) {
    p.hullHitAngle = value;
  },

  setStructureHitGlow(value: number, p: Player = _G.P) {
    p.structureHitGlow = value;
  },

  setStructureHitAngle(value: number, p: Player = _G.P) {
    p.structureHitAngle = value;
  },

  setCombatHeat(value: number) {
    Client.combatHeat = value;
  },

  setXp(value: number, p: Player = _G.P) {
    p.xp = value;
  },

  setLevel(value: number, p: Player = _G.P) {
    p.level = value;
  },

  setKills(value: number, p: Player = _G.P) {
    p.kills = value;
  },

  setSkillXp(skillId: string, value: number, p: Player = _G.P) {
    p.skillXp[skillId] = value;
  },

  setSkill(skillId: string, level: number, p: Player = _G.P) {
    p.skills[skillId] = level;
  },

  setSysIdx(value: number, p: Player = _G.P) {
    p.sysIdx = value;
  },

  setMaxHp(value: number, p: Player = _G.P) {
    p.maxHp = value;
  },

  setMaxStructure(value: number, p: Player = _G.P) {
    p.maxStructure = value;
  },

  setMaxShield(value: number, p: Player = _G.P) {
    p.maxShield = value;
  },

  setCombatBar(bar: Player["combatBar"], p: Player = _G.P) {
    p.combatBar = bar;
  },

  setPendingHomeSpawn(value: boolean, p: Player = _G.P) {
    p.pendingHomeSpawn = value;
  },

  setShieldCd(value: number, p: Player = _G.P) {
    p.shieldCd = value;
  },

  setHomeSysIdx(value: number, p: Player = _G.P) {
    p.homeSysIdx = value;
  },

  setSkillsAll(skills: Record<string, number>, p: Player = _G.P) {
    p.skills = skills;
  },

  setSkillXpAll(skillXp: Record<string, number>, p: Player = _G.P) {
    p.skillXp = skillXp;
  },
};
