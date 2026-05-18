import { G } from "../state.js";
import { SHIPS } from "../data/ships.js";
import { MODULES, MODULE_FLAGS } from "../data/modules.js";
import { WEAPON_PROFILES } from "../data/weaponProfiles.js";
import { resolveWeaponTurret, getWeaponTurretAtSlot } from "../targeting.js";
import { MODULE_HP_MAX, MIN_THRUST_PCT, SHIP_MASS_REF } from "../constants.js";
import { levelForSkillXp, WEAPON_SKILL, type WeaponDelivery } from "../data/skills.js";
import { getInstance } from "../utils/items.js";
import { ModuleInstance } from "../types/moduleInstance.js";
import { C } from "../config/index.js";

export interface ComputedStats {
  ship: any;
  weaponMult: number;
  miningMult: number;
  maxHp: number;
  maxStructure: number;
  maxShield: number;
  shieldRegen: number;
  maxEnergy: number;
  energyRegen: number;
  thrustScale: number;
  baseThrustScale: number;
  turnRate: number;
  baseTurnRate: number;
  mainThrust: number;
  retroThrust: number;
  lateralThrust: number;
  maxSpeed: number;
  baseMaxSpeed: number;
  dragPerSec: number;
  weaponTurret: any;
  wProf: any;
  finalDmg: number;
  hasMiner: boolean;
  hasSalvager: boolean;
  salvageBonus: number;
  metallurgyLevel: number;
  lockScanMult: number;
  usedPG: number;
  usedCPU: number;
  totalPG: number;
  totalCPU: number;
  mineRange: number;
  massMult: number;
}

import { invalidateInstanceCache } from "../utils/items.js";

export function invalidate() {
  G._statsCache = null;
  invalidateInstanceCache();
}

export function getStats(): ComputedStats {
  return G._statsCache || (G._statsCache = computeStats());
}

/** Per-weapon-type skill bonus, applied at fire time (multiplier above 1.0). */
export function weaponSkillBonus(delivery: WeaponDelivery): number {
  const id = WEAPON_SKILL[delivery];
  const lvl = levelForSkillXp(G.P.skillXp?.[id] || 0);
  return lvl * C.PLAYER.SKILL_POTENCY.weaponMultPerLevel;
}

function isModuleActive(m: any, rack: string, idx: number): boolean {
  return rack === "turret" ? (G.P.turretPower?.[idx] ?? false) : (G.P.slotActive?.[rack]?.[idx] ?? true);
}

export function computeStats(tempFitting?: any): ComputedStats {
  const p = G.P;
  const fitting = tempFitting || p.fitting;
  const ship = SHIPS[p.shipId];
  const skLv = (id: string) => levelForSkillXp(p.skillXp?.[id] || 0);
  let wepB = 0, minB = 0, ehpB = 0, addPG = 0, engineMN = ship?.baseMainEngineMN ?? 7;
  let massMult = ((ship?.hullMassKg ?? SHIP_MASS_REF) / SHIP_MASS_REF);
  let usedPG = 0, usedCPU = 0;
  let simThrustPct = 0, simMaxSpeedPct = 0, simTurnPct = 0, simDragAdd = 0;
  let capFlat = 0, capPct = 0, capRechargePct = 0;
  let shieldRegenFlat = 0;
  let miningRangeKmMult = 1, miningRangeKmFlat = 0;
  let actSimThrustPct = 0, actSimMaxSpeedPct = 0, actSimTurnPct = 0, actEngineMN = 0;

  for (const rack of ["turret", "high", "med", "low"] as const) {
    for (let idx = 0; idx < (fitting[rack]?.length || 0); idx++) {
      const instanceId = fitting[rack][idx];
      if (!instanceId) continue;
      const instance = getInstance(instanceId);
      if (!instance) continue;
      const m = MODULES[instance.baseId]; if (!m) continue;
      
      const durabilityScale = instance.durability / instance.maxDurability;
      const active = isModuleActive(m, rack, idx) && instance.durability > 0;
      const e = { ...m.effects };
      
      // Apply instance affixes
      for (const affix of instance.affixes) {
        if (e[affix.affectedStat]) {
          e[affix.affectedStat] += affix.value;
        } else {
          e[affix.affectedStat] = affix.value;
        }
      }
      
      const scale = instance.durability > 0 ? (0.3 + 0.7 * durabilityScale) : 0;
      usedPG += m.powergrid || 0;
      usedCPU += m.cpu || 0;
      if (!active) continue;
      wepB += (e.weaponMultBonus || 0) * scale;
      minB += (e.miningMultBonus || 0) * scale;
      ehpB += (e.hullEhpMultBonus || 0) * scale;
      engineMN += (e.mainEngineMN || 0) * scale;
      massMult *= Math.pow(e.structuralMassMult || 1, scale);
      addPG += (e.addPowergrid || 0) * scale;
      simThrustPct += (e.simThrustPctBonus || 0) * scale;
      simMaxSpeedPct += (e.simMaxSpeedPctBonus || 0) * scale;
      simTurnPct += (e.simTurnPctBonus || 0) * scale;
      simDragAdd += (e.simDragDelta || 0) * scale;
      capFlat += (e.capacitorFlat || 0) * scale;
      capPct += (e.capacitorPctBonus || 0) * scale;
      capRechargePct += (e.capRechargePctBonus || 0) * scale;
      shieldRegenFlat += (e.shieldRegenFlat || 0) * scale;
      if (e.miningRangePctBonus) miningRangeKmMult *= Math.pow(1 + e.miningRangePctBonus, scale);
      miningRangeKmFlat += (e.miningRangeKmBonus || 0) * scale;
      if (m.isActive) {
        actSimThrustPct += (e.simThrustPctBonus || 0) * scale;
        actSimMaxSpeedPct += (e.simMaxSpeedPctBonus || 0) * scale;
        actSimTurnPct += (e.simTurnPctBonus || 0) * scale;
        actEngineMN += (e.mainEngineMN || 0) * scale;
      }
    }
  }

  const miningSkl = skLv('mining') * C.PLAYER.SKILL_POTENCY.miningMultPerLevel;
  const engSkl = skLv('engineering') * C.PLAYER.SKILL_POTENCY.engineeringEhpPerLevel;
  const lvlHp = (p.level - 1) * C.PLAYER.SKILL_POTENCY.levelHpPerLevel;
  const combatTrainingLvl = Math.max(skLv('ballistics'), skLv('beam_weapons'), skLv('missile_guidance'));

  let lockScanMult = 1;
  const allMods = [...fitting.turret, ...fitting.high, ...fitting.med, ...fitting.low].filter(Boolean) as string[];
  for (const uid of allMods) {
    const inst = getInstance(uid);
    if (!inst) continue;
    const m = MODULES[inst.baseId];
    lockScanMult += m?.effects?.lockScanBonus || 0;
  }
  lockScanMult *= 1 + combatTrainingLvl * C.PLAYER.SKILL_POTENCY.lockScanPerLevel;

  // Base weapon multiplier — does not include weapon-type skill (applied at fire time).
  const weaponMult = ship.weaponMult * (1 + wepB);
  const miningMult = ship.miningMult * (1 + minB + miningSkl);
  const maxHp = Math.floor(ship.hull * (1 + ehpB + engSkl + lvlHp));
  const maxStructure = Math.floor(ship.hull * C.PLAYER.STRUCTURE_RATIO * (1 + ehpB + engSkl + lvlHp));
  let hasShieldSystem = false;
  for (const rack of ["turret", "high", "med", "low"] as const) {
    for (let idx = 0; idx < (fitting[rack]?.length || 0); idx++) {
      const uid = fitting[rack][idx];
      if (!uid) continue;
      const inst = getInstance(uid);
      if (!inst) continue;
      const m = MODULES[inst.baseId];
      if (m && MODULE_FLAGS.isShield(m)) {
        if (isModuleActive(m, rack, idx) && inst.durability > 0) {
          hasShieldSystem = true;
          break;
        }
      }
    }
    if (hasShieldSystem) break;
  }

  const maxShield = hasShieldSystem ? Math.floor((ship.shield || 0) * (1 + ehpB)) : 0;
  if (!tempFitting) {
    p.maxHp = maxHp;
    p.maxStructure = maxStructure;
    p.maxShield = maxShield;
  }
  const shieldRegen = shieldRegenFlat * (1 + skLv('engineering') * C.PLAYER.SKILL_POTENCY.engineeringShieldRegenPerLevel);

  const baseCap = (ship.baseCapacitor ?? C.PLAYER.CAPACITOR.baseCapacitorFallback)
    + (p.level - 1) * (ship.capPerLevel ?? C.PLAYER.CAPACITOR.capPerLevelFallback)
    + skLv('engineering') * (ship.capFromEngineering ?? C.PLAYER.CAPACITOR.capFromEngineeringFallback);
  const baseReg = (ship.baseCapRecharge ?? C.PLAYER.CAPACITOR.baseCapRechargeFallback)
    + skLv('engineering') * (ship.capRechargeFromEngineering ?? C.PLAYER.CAPACITOR.capRechargeFromEngineeringFallback);
  const maxEnergy = Math.floor((baseCap + capFlat) * (1 + capPct));
  const energyRegen = baseReg * (1 + capRechargePct);

  const main0 = ship.simMainThrustPx ?? 220;
  const maxSpd0 = ship.simMaxSpeedPx ?? 780;
  const turn0 = ship.simTurnRateRad ?? 2.6;
  const drag0 = ship.simDragPerSec ?? 0.9925;
  const retroR = ship.simRetroRatio ?? 0.355;
  const latR = ship.simLateralRatio ?? 0.478;
  const cruiseMult = ship.cruiseSpeedMult ?? 1;
  const baseEng = Math.max(0.01, ship.baseMainEngineMN ?? 7);

  const engineRatio = engineMN / baseEng;
  const agilityMult = 1 / Math.max(0.4, massMult);
  const thrustScalar = engineRatio * cruiseMult * agilityMult * (1 + simThrustPct);
  let mainThrust = main0 * thrustScalar;
  const retroThrust = main0 * retroR * thrustScalar;
  const lateralThrust = main0 * latR * thrustScalar;
  let maxSpeed = maxSpd0 * cruiseMult * (1 + simMaxSpeedPct) * (C.PLAYER.SPEED.engineRatioFloor + C.PLAYER.SPEED.engineRatioCeiling * Math.min(engineRatio, C.PLAYER.SPEED.engineRatioCap));
  const turnRate = turn0 * agilityMult * (1 + simTurnPct);
  const dragPerSec = Math.min(C.PLAYER.THRUST.dragMax, Math.max(C.PLAYER.THRUST.dragMin, drag0 + simDragAdd));

  const minThrust = main0 * MIN_THRUST_PCT;
  const minSpeed = maxSpd0 * MIN_THRUST_PCT;
  if (mainThrust < minThrust) mainThrust = minThrust;
  if (maxSpeed < minSpeed) maxSpeed = minSpeed;

  const baseEngineMN = engineMN - actEngineMN;
  const baseEngineRatio = baseEngineMN / baseEng;
  const baseSimThrustPct = simThrustPct - actSimThrustPct;
  const baseSimMaxSpeedPct = simMaxSpeedPct - actSimMaxSpeedPct;
  const baseSimTurnPct = simTurnPct - actSimTurnPct;
  const baseThrustScalar = baseEngineRatio * cruiseMult * agilityMult * (1 + baseSimThrustPct);
  const baseMaxSpeed = maxSpd0 * cruiseMult * (1 + baseSimMaxSpeedPct) * (C.PLAYER.SPEED.engineRatioFloor + C.PLAYER.SPEED.engineRatioCeiling * Math.min(baseEngineRatio, C.PLAYER.SPEED.engineRatioCap));
  const baseTurnRate = turn0 * agilityMult * (1 + baseSimTurnPct);

  const miningKm = (ship.miningRangeKm ?? C.PLAYER.MINE_RANGE.referenceKm) * miningRangeKmMult + miningRangeKmFlat;
  const mineRange = (miningKm / C.PLAYER.MINE_RANGE.referenceKm) * C.PLAYER.MINE_RANGE.referencePx * (1 + miningSkl * C.PLAYER.MINE_RANGE.miningSkillMultiplier);

  const thrustScale = thrustScalar;
  const baseThrustScale = baseThrustScalar;

  let hasMiner = false;
  for (const uid of fitting.turret) {
    if (!uid) continue;
    const inst = getInstance(uid);
    const m = inst ? MODULES[inst.baseId] : null;
    if (m && MODULE_FLAGS.isMiningTurret(m)) hasMiner = true;
  }

  let hasSalvager = false;
  let salvageBonus = skLv('salvage') * C.PLAYER.SKILL_POTENCY.salvagePerLevel;
  for (let i = 0; i < (fitting.high?.length ?? 0); i++) {
    const uid = fitting.high?.[i];
    if (!uid) continue;
    const inst = getInstance(uid);
    const m = inst ? MODULES[inst.baseId] : null;
    if (!m?.isSalvager) continue;
    hasSalvager = true;
    salvageBonus += (m as any).salvageRollBonus ?? 0;
  }
  const metallurgyLevel = skLv('metallurgy');
  const weaponTurret = resolveWeaponTurret(fitting);
  const baseProf = weaponTurret ? (WEAPON_PROFILES[weaponTurret.id] || WEAPON_PROFILES.default) : WEAPON_PROFILES.default;
  const rangeScale = ((ship.turretRangeKm || C.PLAYER.TURRET.rangeKmReference) / C.PLAYER.TURRET.rangeKmReference) * C.PLAYER.TURRET.rangeScaleMultiplier;
  const wProf = { ...baseProf, range: Math.max(C.PLAYER.TURRET.rangeMinPx, Math.round(baseProf.range * rangeScale)) };
  if (weaponTurret && baseProf.type === "projectile" && baseProf.spd > 0) {
    const trk = weaponTurret.trackingSpeed ?? C.PLAYER.TURRET.defaultTrackingSpeed;
    wProf.spd = Math.max(C.PLAYER.TURRET.projectileSpeedMin, Math.round(baseProf.spd * (C.PLAYER.TURRET.projectileSpeedBase + trk * C.PLAYER.TURRET.projectileSpeedPerTracking)));
  }
  const primaryDelivery: WeaponDelivery | null = (weaponTurret?.weaponDelivery as WeaponDelivery | undefined) ?? null;
  const primarySkillBonus = primaryDelivery ? skLv(WEAPON_SKILL[primaryDelivery]) * C.PLAYER.SKILL_POTENCY.weaponMultPerLevel : 0;
  const finalDmg = Math.floor(wProf.dmg * weaponMult * (1 + primarySkillBonus));

  return {
    ship, weaponMult, miningMult, maxHp, maxStructure, maxShield, shieldRegen, maxEnergy, energyRegen,
    thrustScale, baseThrustScale, turnRate, baseTurnRate,
    mainThrust, retroThrust, lateralThrust, maxSpeed, baseMaxSpeed, dragPerSec,
    weaponTurret, wProf, finalDmg, hasMiner, hasSalvager, salvageBonus, metallurgyLevel, lockScanMult,
    usedPG, usedCPU,
    totalPG: (ship.fitting.powergrid || 0) + addPG,
    totalCPU: ship.fitting.cpu || 0,
    mineRange,
    massMult,
  };
}

export function getWeaponProfileForSlot(idx: number): any | null {
  const p = G.P;
  const ship = SHIPS[p.shipId];
  const uid = G.P.fitting.turret[idx];
  const inst = uid ? getInstance(uid) : null;
  const m = inst ? MODULES[inst.baseId] : null;
  if (!m) return null;
  const baseProf = WEAPON_PROFILES[inst!.baseId] || WEAPON_PROFILES.default;
  const rangeScale = ((ship.turretRangeKm || C.PLAYER.TURRET.rangeKmReference) / C.PLAYER.TURRET.rangeKmReference) * C.PLAYER.TURRET.rangeScaleMultiplier;
  const wProf = { ...baseProf, range: Math.max(C.PLAYER.TURRET.rangeMinPx, Math.round(baseProf.range * rangeScale)) };
  if (baseProf.type === "projectile" && baseProf.spd > 0) {
    const trk = (m as any).trackingSpeed ?? C.PLAYER.TURRET.defaultTrackingSpeed;
    wProf.spd = Math.max(C.PLAYER.TURRET.projectileSpeedMin, Math.round(baseProf.spd * (C.PLAYER.TURRET.projectileSpeedBase + trk * C.PLAYER.TURRET.projectileSpeedPerTracking)));
  }
  return wProf;
}
