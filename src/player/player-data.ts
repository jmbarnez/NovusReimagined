
import { PlayerAccess, getState } from "../state-access.js";
import { t } from "../utils/i18n.js";
import type { Player } from "../state.js";
import { SHIPS } from "../data/ships.js";
import { SKILL_IDS, SKILL_DEF, xpForSkillLevel, levelForSkillXp, MAX_SKILL_LEVEL, type SkillId } from "../data/skills.js";
import {
  AMMO_START_HYBRID,
  AMMO_START_MISSILE,
  SAVE_KEY,
  LEVEL_XP_BASE,
  MODULE_HP_MAX,
  RACK_TYPES,
} from "../constants.js";
import { floatText, spawnParticles } from "../utils/fx.js";
import { getStats, invalidate } from "./player-stats.js";
import { logEvent, showXpEarned } from "../feedback.js";
import { ModuleRarity } from "../data/moduleRarity.js";
import { ModuleInstance } from "../types/moduleInstance.js";
import { syncActiveProfile } from "../data/profiles.js";
import { ALLOY_FAMILIES, makeDefaultAlloyCodex } from "../refinery/index.js";
import { makePlayer as makePlayerImpl } from "./player-factory.js";
import {
  normalizeHardpointArrays,
  migrateLegacyHardpointFit,
  applyStarterTrainingFit,
} from "./migrations/hardpoint-migrations.js";
import { migrateLegacyRefinedCargo } from "./migrations/refined-cargo-migration.js";
import { migrateRefineryStorage } from "./migrations/refinery-storage-migration.js";
import { TUTORIAL_SPAWN } from "../data/tutorial-layout.js";

const CURRENT_SAVE_VERSION = 2;

export function defaultFitting(shipId: string): Record<string, (string | null)[]> {
  const s = SHIPS[shipId];
  const out: Record<string, (string | null)[]> = {};
  for (const r of RACK_TYPES) out[r] = Array(s.fitting[r] || 0).fill(null);
  return out;
}

export function getPilotDisplayName(player: Player): string {
  const name = player.pilotName?.trim();
  return name && name.length > 0 ? name : "Pilot";
}

export function makePlayer(): Player {
  return makePlayerImpl();
}

export function clearTransientPlayerInput(p: Player): void {
  p.inputKeys = null;
  p.inputMouseWorld = null;
  p.waypoint = null;
  p.navCommand = null;
  p.netInputFrame = null;
  p.boostFx = false;
  p.boostLockout = false;
}

type LegacyRefinedPool = Partial<Record<"bar" | "lattice" | "condensate", number>>;

export function loadPlayer(): Player {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return makePlayer();
    const p = JSON.parse(raw) as Player & {
      refined?: LegacyRefinedPool;
      hubOutput?: Player["hubOutput"] & { refined?: LegacyRefinedPool };
      moduleInventory?: Record<string, number>;
      damagedModuleHp?: unknown;
    };
    p.vx = p.vy = p.va = 0;
    p.px = p.x; p.py = p.y; p.prevAngle = p.angle;
    p.shootCd = p.mineCd = 0; p.invincible = 1.5;
    p.thrustFx = false;
    p.boostFx = false;
    p.boostLockout = false;
    clearTransientPlayerInput(p);
    if (p.shield == null) p.shield = 0;
    p.shieldCd = 0;
    p.shieldHitGlow = 0;
    p.shieldHitAngle = 0;
    p.hullHitGlow = 0;
    p.hullHitAngle = 0;
    p.structureHitGlow = 0;
    p.structureHitAngle = 0;
    p.targetLock = null;



    if (!p.fitting) p.fitting = defaultFitting(p.shipId);
    migrateLegacyHardpointFit(p);
    if (!Array.isArray(p.turretTargets)) p.turretTargets = [];
    if (!Array.isArray(p.highTargets)) p.highTargets = [];
    normalizeHardpointArrays(p);
    if (!p.moduleCargo) p.moduleCargo = [];
    if (!Array.isArray(p.mixedOreCargo)) p.mixedOreCargo = [];
    if (!Array.isArray(p.bulkMaterialsCargo)) p.bulkMaterialsCargo = [];
    for (const slot of p.mixedOreCargo) {
      if (typeof slot.richness !== "number") slot.richness = 1;
    }
    if (!p.ore || typeof p.ore !== "object") p.ore = {};
    for (const key of ["iron", "nickel", "silicate", "carbon", "crystal", "exotic"]) {
      if (typeof p.ore[key] !== "number") p.ore[key] = 0;
    }
    const starter = makePlayer();
    const ownedUids = new Set(p.moduleCargo.map((inst) => inst.uid));
    for (const inst of starter.moduleCargo) {
      if (!ownedUids.has(inst.uid)) p.moduleCargo.push({ ...inst, affixes: [...inst.affixes] });
    }
    if (p.moduleInventory && typeof p.moduleInventory === "object") {
      for (const [baseId, count] of Object.entries(p.moduleInventory)) {
        for (let i = 0; i < count; i++) {
          p.moduleCargo.push({
            uid: `migrated-${baseId}-${Date.now()}-${i}`,
            baseId,
            rarity: ModuleRarity.Stock,
            itemLevel: 1,
            durability: 100,
            maxDurability: 100,
            affixes: [],
          });
        }
      }
      delete p.moduleInventory;
    }
    if (p.damagedModuleHp) delete p.damagedModuleHp;
    if (!p.moduleHp || typeof p.moduleHp !== "object") p.moduleHp = { turret: [], high: [], med: [], low: [] };
    if (!p.slotActive || typeof p.slotActive !== "object") p.slotActive = { turret: [], high: [], med: [], low: [] };
    if (!Array.isArray(p.moduleCargo)) p.moduleCargo = [];
    if (!Array.isArray(p.contracts)) p.contracts = [];
    if (!Array.isArray(p.craftQueue)) p.craftQueue = [];
    if (!Array.isArray(p.hubQueue)) p.hubQueue = [];
    migrateLegacyRefinedCargo(p.refined, p);
    migrateLegacyRefinedCargo(p.hubOutput?.refined, p);
    delete p.refined;
    if (!p.hubOutput || typeof p.hubOutput !== "object") p.hubOutput = { loot: {}, ore: {}, materials: [], modules: [] };
    if ("refined" in p.hubOutput) delete (p.hubOutput as Player["hubOutput"] & { refined?: LegacyRefinedPool }).refined;
    if (!Array.isArray(p.hubOutput.materials)) p.hubOutput.materials = [];
    if (!p.hubDeposit || typeof p.hubDeposit !== "object") p.hubDeposit = { raw: [], ore: {}, materials: [], loot: {}, modules: [] };
    if (!Array.isArray(p.hubDeposit.materials)) p.hubDeposit.materials = [];
    if (!p.alloyCodex || typeof p.alloyCodex !== "object") p.alloyCodex = makeDefaultAlloyCodex();
    else {
      p.alloyCodex = {
        knownFamilyIds: Array.isArray(p.alloyCodex.knownFamilyIds) && p.alloyCodex.knownFamilyIds.length > 0
          ? [...p.alloyCodex.knownFamilyIds]
          : ALLOY_FAMILIES.map((family) => family.id),
        discoveries: Array.isArray(p.alloyCodex.discoveries)
          ? p.alloyCodex.discoveries.map((entry) => ({
            ...entry,
            composition: { ...entry.composition },
            compatibleFamilyIds: [...entry.compatibleFamilyIds],
            tags: [...entry.tags],
          }))
          : [],
      };
    }
    migrateRefineryStorage(p);
    p.tractorCarryKg = 0;
    if (typeof p.tractorTightness !== "number") p.tractorTightness = 0.5;
    if (!p.tutorial) p.tutorial = { active: false, step: 0, completed: false, skipped: false };
    if (p.pilotName === undefined || p.pilotName === null) p.pilotName = "";
    if (!Array.isArray(p.scannedSiteIds)) p.scannedSiteIds = [];
    if (!Array.isArray(p.completedSiteIds)) p.completedSiteIds = [];
    if (!Array.isArray(p.discoveredConcentricSectors)) p.discoveredConcentricSectors = [];
    if (!Array.isArray(p.discoveredLocalRegionIds)) p.discoveredLocalRegionIds = [];
    if (!Array.isArray(p.stationOffers)) p.stationOffers = [];
    if (p.stationOfferStationId === undefined) p.stationOfferStationId = null;
    if (!Array.isArray(p.detectedSignatures)) p.detectedSignatures = [];
    if (p.activeScan === undefined) p.activeScan = null;
    if (p.scannerAngle === undefined) p.scannerAngle = 0;
    if (p.scannerConeDeg === undefined) p.scannerConeDeg = 180;
    if (p.mapScannerActive === undefined) p.mapScannerActive = false;
    if (p.mapScannerStrength === undefined) p.mapScannerStrength = 0.5;
    p.boostFx = false;
    p.boostLockout = false;
    if (p.warpCooldown === undefined) p.warpCooldown = 0;
    if (p.warpTargetIdx === undefined) p.warpTargetIdx = -1;
    applyStarterTrainingFit(p);
    ensureAmmoDefaults(p);
    if (p.structure == null) {
      const shipHull = (SHIPS[p.shipId] || SHIPS.scout).hull;
      p.structure = Math.floor(shipHull * 0.8);
      p.maxStructure = p.structure;
    }
    if (!p.skillXp) {
      p.skillXp = {};
      for (const id of SKILL_IDS) {
        const lvl = p.skills?.[id] || 0;
        p.skillXp[id] = xpForSkillLevel(lvl);
      }
    }
    // Split legacy `gunnery` XP evenly across the three weapon-type skills.
    const legacyGunneryXp = (p.skillXp as Record<string, number>)["gunnery"];
    if (legacyGunneryXp != null) {
      delete (p.skillXp as Record<string, number>)["gunnery"];
      const share = Math.floor(legacyGunneryXp / 3);
      for (const id of ["ballistics", "beam_weapons", "missile_guidance"] as const) {
        p.skillXp[id] = (p.skillXp[id] || 0) + share;
      }
    }
    // Drop skill keys that are no longer in SKILL_IDS (post-simplification migration).
    const valid = new Set<string>(SKILL_IDS);
    for (const k of Object.keys(p.skillXp)) if (!valid.has(k)) delete p.skillXp[k];
    if (p.skills) for (const k of Object.keys(p.skills)) if (!valid.has(k)) delete p.skills[k];
    p.skills = Object.fromEntries(SKILL_IDS.map(id => [id, levelForSkillXp(p.skillXp[id] || 0)]));
    // Skill points were removed — strip the field from old saves.
    if ("skillPoints" in (p as object)) delete (p as { skillPoints?: number }).skillPoints;
    // Relocate active tutorial players with stale positions after the layout refactor.
    if ((p.saveVersion ?? 0) < 2 && p.sysIdx === 0 && p.tutorial?.active) {
      p.x = TUTORIAL_SPAWN.x;
      p.y = TUTORIAL_SPAWN.y;
      p.px = TUTORIAL_SPAWN.x;
      p.py = TUTORIAL_SPAWN.y;
    }
    p.saveVersion = CURRENT_SAVE_VERSION;
    return p;
  } catch {
    return makePlayer();
  }
}

export function savePlayer() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(getState().player));
    syncActiveProfile();
  } catch (e) {
    console.warn("[save] localStorage failed:", e);
  }
}

export function ensureAmmoDefaults(p = getState().player) {
  if (!p.ammo) p.ammo = { hybrid: AMMO_START_HYBRID, missile: AMMO_START_MISSILE };
  else {
    if (p.ammo.hybrid == null) p.ammo.hybrid = AMMO_START_HYBRID;
    if (p.ammo.missile == null) p.ammo.missile = AMMO_START_MISSILE;
  }
}

export function xpForLevel(lvl: number): number {
  return LEVEL_XP_BASE * lvl * lvl;
}

export function addXp(amount: number, p: Player = getState().player) {
  PlayerAccess.setXp(p.xp + amount, p);
  let leveledUp = false;
  while (p.xp >= xpForLevel(p.level)) {
    PlayerAccess.setXp(p.xp - xpForLevel(p.level), p);
    PlayerAccess.setLevel(p.level + 1, p);
    invalidate(p);
    PlayerAccess.setHp(Math.min(p.hp + 30, getStats(p).maxHp), p);
    if (p === getState().player) {
      floatText(p.x, p.y - 50, t("system.levelUpFloat", { level: p.level }), "#ffe066");
      spawnParticles(p.x, p.y, "#ffe066", 6, 70);
      logEvent(t("system.levelUpLog", { level: p.level }), "system");
    }
    leveledUp = true;
  }
  if (leveledUp && p === getState().player) {
    savePlayer();
  }
}

export function addSkillXp(skillId: string, amount: number, p: Player = getState().player) {
  if (!SKILL_IDS.includes(skillId as SkillId)) return;
  if (amount <= 0) return;
  const prevXp = p.skillXp[skillId] || 0;
  const oldLvl = levelForSkillXp(prevXp);
  if (oldLvl >= MAX_SKILL_LEVEL) return;
  PlayerAccess.setSkillXp(skillId, prevXp + amount, p);
  if (p === getState().player) showXpEarned(skillId, amount);
  syncSkillsFromXp(p);
  const newLvl = levelForSkillXp(p.skillXp[skillId]);
  if (newLvl > oldLvl) {
    const def = SKILL_DEF[skillId as SkillId];
    const name = def?.name ?? skillId;
    const icon = def?.icon ?? "⭐";
    if (p === getState().player) {
      floatText(p.x, p.y - 45, t("system.skillUpFloat", { icon, name, level: newLvl }), "#ffe066");
      spawnParticles(p.x, p.y, "#ffe066", 4, 60);
      logEvent(t("system.skillUpLog", { name, level: newLvl }), "system");
      savePlayer();
    }
  }
}

function syncSkillsFromXp(p: Player = getState().player) {
  for (const id of SKILL_IDS) {
    PlayerAccess.setSkill(id, levelForSkillXp(p.skillXp[id] || 0), p);
  }
}

export function validatePilotName(name: string): { ok: boolean; name?: string; error?: string } {
  const trimmed = (name || "").trim();
  if (trimmed.length < 3) {
    return { ok: false, error: "Callsign must be at least 3 characters long." };
  }
  if (!/^[a-zA-Z0-9_\s]+$/.test(trimmed)) {
    return { ok: false, error: "Only letters, numbers, spaces, and underscores allowed." };
  }
  return { ok: true, name: trimmed };
}
