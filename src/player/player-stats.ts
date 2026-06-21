import { getState, WorldAccess } from "../state-access.js";
import { SHIPS, ShipDef } from "../data/ships.js";
import { MODULES, MODULE_FLAGS, ModuleDef } from "../data/modules.js";
import { WEAPON_PROFILES, WeaponProfile } from "../data/weaponProfiles.js";
import { resolveWeaponTurret, getWeaponTurretAtSlot } from "../targeting.js";
import { MODULE_HP_MAX, MIN_THRUST_PCT, SHIP_MASS_REF, RACK_TYPES, type RackId } from "../constants.js";
import { levelForSkillXp, WEAPON_SKILL, type WeaponDelivery } from "../data/skills.js";
import { getInstance } from "../utils/items.js";
import { ModuleInstance } from "../types/moduleInstance.js";
import { C } from "../config/index.js";
import { playerHardpointRack } from "../utils/hardpoints.js";
import type { Player } from "../state.js";
import { estimateCargoMaterialMassKg, estimateMixedOreCargoMassKg } from "../refinery/index.js";

export interface ComputedStats {
  ship: ShipDef;
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
  weaponTurret: ModuleDef | null;
  wProf: WeaponProfile;
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
  scanRange: number;
  scanStrength: number;
  scanResolveMult: number;
  decryptPower: number;
  decryptTraceResist: number;
}

import { invalidateInstanceCache } from "../utils/items.js";

export function invalidate(p?: Player) {
  if (!p || p === getState().player) {
    WorldAccess.clearStatsCache();
  }
  invalidateInstanceCache();
}

export function getStats(p?: Player): ComputedStats {
  const targetPlayer = p ?? getState().player;
  if (targetPlayer === getState().player) {
    return WorldAccess.getStatsCache() || (WorldAccess.setStatsCache(computeStats(undefined, targetPlayer)), WorldAccess.getStatsCache())!;
  }
  return computeStats(undefined, targetPlayer);
}

/** Per-weapon-type skill bonus, applied at fire time (multiplier above 1.0). */
export function weaponSkillBonus(delivery: WeaponDelivery, p: Player = getState().player): number {
  const id = WEAPON_SKILL[delivery];
  const lvl = levelForSkillXp(p.skillXp?.[id] || 0);
  return lvl * C.PLAYER.SKILL_POTENCY.weaponMultPerLevel;
}

function isModuleActive(m: ModuleDef, rack: RackId, idx: number, p: Player): boolean {
  return true;
}

function isPlayer(obj: unknown): obj is Player {
  return obj !== null && typeof obj === "object" && "shipId" in obj;
}

export function computeStats(
  fittingOrPlayer?: Record<string, (string | null)[]> | Player,
  playerArg?: Player
): ComputedStats {
  let p: Player;
  let fitting: Record<string, (string | null)[]>;
  if (isPlayer(fittingOrPlayer)) {
    p = fittingOrPlayer;
    fitting = p.fitting;
  } else {
    p = playerArg ?? getState().player;
    fitting = (fittingOrPlayer as Record<string, (string | null)[]>) ?? p.fitting;
  }
  const ship = SHIPS[p.shipId];
  const skLv = (id: string) => levelForSkillXp(p.skillXp?.[id] || 0);
  let wepB = 0, minB = 0, ehpB = 0, addPG = 0, engineMN = ship?.baseMainEngineMN ?? 7;
  const carryKg = (p.tractorCarryKg ?? 0);
  const mixedOreCargoKg = (p.mixedOreCargo ?? []).reduce(
    (sum, slot) => sum + estimateMixedOreCargoMassKg(slot.qty, slot.composition),
    0,
  );
  const bulkMaterialKg = estimateCargoMaterialMassKg(p.bulkMaterialsCargo);
  let massMult = ((ship?.hullMassKg ?? SHIP_MASS_REF) + carryKg + mixedOreCargoKg + bulkMaterialKg) / SHIP_MASS_REF;
  let usedPG = 0, usedCPU = 0;
  let simThrustPct = 0, simMaxSpeedPct = 0, simTurnPct = 0, simDragAdd = 0;
  let capFlat = 0, capPct = 0, capRechargePct = 0;
  let shieldRegenFlat = 0;
  let miningRangeKmMult = 1, miningRangeKmFlat = 0;
  let actSimThrustPct = 0, actSimMaxSpeedPct = 0, actSimTurnPct = 0, actEngineMN = 0;

  for (const rack of RACK_TYPES) {
    for (let idx = 0; idx < (fitting[rack]?.length || 0); idx++) {
      const instanceId = fitting[rack][idx];
      if (!instanceId) continue;
      const instance = getInstance(instanceId, p);
      if (!instance) continue;
      const m = MODULES[instance.baseId]; if (!m) continue;
      
      const durabilityScale = instance.durability / instance.maxDurability;
      const active = isModuleActive(m, rack, idx, p) && instance.durability > 0;
      const e = { ...m.effects };
      
      // Apply instance affixes
      for (const affix of instance.affixes) {
        const cur = e[affix.affectedStat];
        e[affix.affectedStat] = (cur ?? 0) + affix.value;
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
  const allMods = [
    ...(fitting.turret ?? []),
    ...(fitting.high ?? []),
    ...(fitting.med ?? []),
    ...(fitting.low ?? []),
  ].filter(Boolean) as string[];
  for (const uid of allMods) {
    const inst = getInstance(uid, p);
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
  for (const rack of RACK_TYPES) {
    for (let idx = 0; idx < (fitting[rack]?.length || 0); idx++) {
      const uid = fitting[rack][idx];
      if (!uid) continue;
      const inst = getInstance(uid, p);
      if (!inst) continue;
      const m = MODULES[inst.baseId];
      if (m && MODULE_FLAGS.isShield(m)) {
        if (isModuleActive(m, rack, idx, p) && inst.durability > 0) {
          hasShieldSystem = true;
          break;
        }
      }
    }
    if (hasShieldSystem) break;
  }

  const maxShield = hasShieldSystem ? Math.floor((ship.shield || 0) * (1 + ehpB)) : 0;
  const isTemp = !!fittingOrPlayer && !isPlayer(fittingOrPlayer);
  if (!isTemp) {
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

  const cruiseMult = 1 + actSimThrustPct;
  const agilityMult = 1 + actSimTurnPct;
  const maxSpd = maxSpd0 * cruiseMult * (1 + actSimMaxSpeedPct);

  const baseEng = ship?.baseMainEngineMN ?? 7;
  const engineRatio = engineMN / baseEng;
  const thrustScalar = engineRatio * cruiseMult * agilityMult * (1 + simThrustPct);
  const maxSpeed = maxSpd * (C.PLAYER.SPEED.engineRatioFloor + C.PLAYER.SPEED.engineRatioCeiling * Math.min(engineRatio, C.PLAYER.SPEED.engineRatioCap));
  const turnRate = turn0 * agilityMult * (1 + simTurnPct);
  const mainThrust = main0 * thrustScalar;
  const retroThrust = (ship.simRetroThrustPx ?? main0 * ship.simRetroRatio) * thrustScalar;
  const lateralThrust = (ship.simLateralThrustPx ?? main0 * ship.simLateralRatio) * thrustScalar;
  const dragPerSec = Math.max(0.5, drag0 + simDragAdd);

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

  const hardpointRack = playerHardpointRack(p);
  const hardpointSlots = fitting[hardpointRack] ?? [];

  let hasMiner = false;
  for (const uid of hardpointSlots) {
    if (!uid) continue;
    const inst = getInstance(uid, p);
    const m = inst ? MODULES[inst.baseId] : null;
    if (m && MODULE_FLAGS.isMiningTurret(m)) hasMiner = true;
  }

  let hasSalvager = false;
  let salvageBonus = skLv('salvage') * C.PLAYER.SKILL_POTENCY.salvagePerLevel;
  for (let i = 0; i < hardpointSlots.length; i++) {
    const uid = hardpointSlots[i];
    if (!uid) continue;
    const inst = getInstance(uid, p);
    const m = inst ? MODULES[inst.baseId] : null;
    if (!m?.isSalvager) continue;
    hasSalvager = true;
    salvageBonus += m.salvageRollBonus ?? 0;
  }
  const metallurgyLevel = skLv('metallurgy');
  const weaponTurret = resolveWeaponTurret(fitting, p);
  const wProf = computeScaledWeaponProfile(weaponTurret ? weaponTurret.id : "default", weaponTurret, ship);
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
    scanRange: 1,
    scanStrength: 1,
    scanResolveMult: 1,
    decryptPower: 1,
    decryptTraceResist: 1,
  };
}

export function computeScaledWeaponProfile(baseId: string, weaponTurret: ModuleDef | null, ship: ShipDef): WeaponProfile {
  const baseProf = WEAPON_PROFILES[baseId] || WEAPON_PROFILES.default;
  const rangeScale = ((ship.turretRangeKm || C.PLAYER.TURRET.rangeKmReference) / C.PLAYER.TURRET.rangeKmReference) * C.PLAYER.TURRET.rangeScaleMultiplier;
  const wProf: WeaponProfile = { ...baseProf, range: Math.max(C.PLAYER.TURRET.rangeMinPx, Math.round(baseProf.range * rangeScale)) };
  if (baseProf.type === "projectile" && baseProf.spd > 0) {
    const trk = weaponTurret?.trackingSpeed ?? C.PLAYER.TURRET.defaultTrackingSpeed;
    wProf.spd = Math.max(C.PLAYER.TURRET.projectileSpeedMin, Math.round(baseProf.spd * (C.PLAYER.TURRET.projectileSpeedBase + trk * C.PLAYER.TURRET.projectileSpeedPerTracking)));
  }

  const optKm = weaponTurret?.optimalRange ?? 0;
  const fallKm = weaponTurret?.falloff ?? 0;
  const edge = C.COMBAT.RANGE_MODEL.edgeFalloffs;
  if (optKm + fallKm > 0) {
    const denom = optKm + edge * fallKm;
    wProf.optimalPx = Math.round(wProf.range * (optKm / denom));
    wProf.falloffPx = Math.max(1, Math.round(wProf.range * (fallKm / denom)));
  } else {
    wProf.optimalPx = wProf.range;
    wProf.falloffPx = C.COMBAT.RANGE_MODEL.minFalloffPx;
  }

  return wProf;
}

export function getWeaponProfileForSlot(idx: number, p: Player = getState().player): WeaponProfile | null {
  const ship = SHIPS[p.shipId];
  const uid = p.fitting[playerHardpointRack(p)]?.[idx];
  const inst = uid ? getInstance(uid, p) : null;
  const m = inst ? MODULES[inst.baseId] : null;
  if (!m) return null;
  return computeScaledWeaponProfile(inst!.baseId, m, ship);
}

export function hasCommsEquipment(p: Player = getState().player): boolean {
  const fitting = p?.fitting;
  if (!fitting) return false;
  for (const rack of RACK_TYPES) {
    for (const uid of fitting[rack] || []) {
      if (!uid) continue;
      const inst = getInstance(uid, p);
      if (!inst) continue;
      const m = MODULES[inst.baseId];
      if (m?.isComms) return true;
    }
  }
  return false;
}
