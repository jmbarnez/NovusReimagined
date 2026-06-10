
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
import { createTutorialMission } from "../data/missions.js";
import { TUTORIAL_STEP_COUNT } from "../data/tutorial.js";
import { TUTORIAL_LOCAL_REGIONS } from "../data/tutorial-layout.js";
import { syncActiveProfile } from "../data/profiles.js";
import { getHardpointSlotCount, mergeLegacyTurretSlotsIntoHigh, playerHardpointRack } from "../utils/hardpoints.js";
import { ALLOY_FAMILIES, flattenStorageMaterials, makeDefaultAlloyCodex, makeDefaultRefineryStorage, preferredStorageForMaterial } from "../refinery/index.js";

const CURRENT_SAVE_VERSION = 1;

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

function copyPaddedArray<T>(prev: T[] | undefined, length: number, fallback: (idx: number) => T): T[] {
  return Array.from({ length }, (_, idx) => prev?.[idx] ?? fallback(idx));
}

function normalizeHardpointArrays(p: Player): void {
  const hardpointCount = p.fitting?.[playerHardpointRack(p)]?.length ?? 0;
  const highCount = p.fitting?.high?.length ?? 0;
  p.turretTargets = copyPaddedArray(p.turretTargets, hardpointCount, () => null);
  p.highTargets = copyPaddedArray(p.highTargets, highCount, () => null);
  p.turretCds = copyPaddedArray(p.turretCds, hardpointCount, () => 0);
  p.turretPower = copyPaddedArray(p.turretPower, hardpointCount, () => false);
  p.turretPowerCd = copyPaddedArray(p.turretPowerCd, hardpointCount, () => 0);
}

function migrateLegacyHardpointFit(p: Player): void {
  if (playerHardpointRack(p) !== "high") return;
  const legacyTurretSlots = Array.isArray(p.fitting?.turret) ? p.fitting.turret : [];
  if (legacyTurretSlots.length === 0) return;
  const highCount = SHIPS[p.shipId]?.fitting.high ?? 0;
  p.fitting.high = mergeLegacyTurretSlotsIntoHigh(p.fitting?.high, legacyTurretSlots, highCount, () => null);
  p.fitting.turret = [];
  if (p.moduleHp && typeof p.moduleHp === "object") {
    p.moduleHp.high = mergeLegacyTurretSlotsIntoHigh(p.moduleHp.high, p.moduleHp.turret, highCount, () => null);
    p.moduleHp.turret = [];
  }
  if (p.slotActive && typeof p.slotActive === "object") {
    p.slotActive.high = mergeLegacyTurretSlotsIntoHigh(p.slotActive.high, p.slotActive.turret, highCount, () => true);
    p.slotActive.turret = [];
  }
}

function applyStarterTrainingFit(p: Player): void {
  const hasRegressedStarterFit =
    p.fitting?.turret?.includes("start-tu-civ-cannon") ||
    p.fitting?.high?.includes("start-tu-civ-cannon") ||
    p.fitting?.med?.includes("start-me-ab1") ||
    p.fitting?.low?.includes("start-tu-civ-scanner");
  if (!p.tutorial?.active || p.tutorial.completed || !hasRegressedStarterFit) return;
  const fit = defaultFitting(p.shipId);
  fit.high[0] = "start-tu-civ-miner";
  fit.high[1] = "start-tu-tractor";
  p.fitting = fit;
  const hardpointCount = fit[playerHardpointRack(p)]?.length ?? 0;
  p.turretTargets = Array(hardpointCount).fill(null);
  p.highTargets = Array(fit.high?.length ?? 0).fill(null);
  p.turretCds = Array(hardpointCount).fill(0);
  p.turretPower = Array(hardpointCount).fill(false);
  p.turretPowerCd = Array(hardpointCount).fill(0);
  p.moduleHp = {
    turret: Array(fit.turret.length).fill(null),
    high: Array(fit.high?.length ?? 0).fill(null),
    med: Array(fit.med?.length ?? 0).fill(null),
    low: Array(fit.low?.length ?? 0).fill(null),
  };
  p.slotActive = {
    turret: Array(fit.turret.length).fill(true),
    high: Array(fit.high?.length ?? 0).fill(true),
    med: Array(fit.med?.length ?? 0).fill(true),
    low: Array(fit.low?.length ?? 0).fill(true),
  };
}

type LegacyRefinedPool = Partial<Record<"bar" | "lattice" | "condensate", number>>;

function migrateLegacyRefinedCargo(refined: LegacyRefinedPool | undefined, p: Player): void {
  if (!refined) return;
  const mappings: Array<{ key: keyof LegacyRefinedPool; familyId: string; composition: Record<string, number> }> = [
    { key: "bar", familyId: "ferro_nickel_stock", composition: { iron: 0.64, nickel: 0.24, carbon: 0.08, silicate: 0.04 } },
    { key: "lattice", familyId: "crystal_matrix", composition: { crystal: 0.62, silicate: 0.24, nickel: 0.08, iron: 0.06 } },
    { key: "condensate", familyId: "exotic_conductive", composition: { exotic: 0.3, crystal: 0.3, nickel: 0.2, iron: 0.12, carbon: 0.08 } },
  ];
  for (const mapping of mappings) {
    const qty = refined[mapping.key] ?? 0;
    if (qty <= 0) continue;
    const family = ALLOY_FAMILIES.find((entry) => entry.id === mapping.familyId);
    if (!family) continue;
    PlayerAccess.addBulkMaterial({
      id: `legacy-${mapping.key}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      materialId: family.id,
      kind: "alloy",
      label: family.label,
      volumeM3: qty,
      massKg: qty * family.densityKgPerM3,
      composition: { ...mapping.composition },
      alloyFamilyId: family.id,
    }, p);
  }
}

function migrateRefineryStorage(p: Player): void {
  if (!Array.isArray(p.refineryStorage) || p.refineryStorage.length === 0) {
    p.refineryStorage = makeDefaultRefineryStorage();
  } else {
    p.refineryStorage = p.refineryStorage.map((unit) => ({
      ...unit,
      entries: (unit.entries ?? []).map((entry) => ({
        ...entry,
        composition: { ...entry.composition },
      })),
    }));
  }

  const legacyMaterials = Array.isArray(p.hubDeposit?.materials) ? [...p.hubDeposit.materials] : [];
  if (legacyMaterials.length > 0 && flattenStorageMaterials(p.refineryStorage).length === 0) {
    for (const stack of legacyMaterials) {
      const target = preferredStorageForMaterial(stack, p.refineryStorage);
      if (!target) continue;
      target.entries.push({
        ...stack,
        composition: { ...stack.composition },
      });
    }
  }

  if (!p.hubDeposit || typeof p.hubDeposit !== "object") p.hubDeposit = { raw: [], ore: {}, materials: [], loot: {}, modules: [] };
  p.hubDeposit.materials = flattenStorageMaterials(p.refineryStorage);
}

export function makePlayer(): Player {
  const fit = defaultFitting('scout');
  const hardpointCount = getHardpointSlotCount("scout");
  const startingModules: ModuleInstance[] = [
    { uid: "start-tu-civ-cannon", baseId: "tu-civilian-cannon", rarity: ModuleRarity.Stock, itemLevel: 1, durability: 100, maxDurability: 100, affixes: [] },
    { uid: "start-tu-civ-miner", baseId: "tu-civilian-miner", rarity: ModuleRarity.Stock, itemLevel: 1, durability: 100, maxDurability: 100, affixes: [] },
    { uid: "start-tu-civ-salvager", baseId: "tu-civilian-salvager", rarity: ModuleRarity.Stock, itemLevel: 1, durability: 100, maxDurability: 100, affixes: [] },
    { uid: "start-tu-tractor", baseId: "tu-tractor", rarity: ModuleRarity.Stock, itemLevel: 1, durability: 100, maxDurability: 100, affixes: [] },
    { uid: "start-tu-civ-scanner", baseId: "tu-civilian-scanner", rarity: ModuleRarity.Stock, itemLevel: 1, durability: 100, maxDurability: 100, affixes: [] },
    { uid: "start-me-ab1", baseId: "me-ab1", rarity: ModuleRarity.Stock, itemLevel: 1, durability: 100, maxDurability: 100, affixes: [] },
    { uid: "start-me-shield", baseId: "me-shield", rarity: ModuleRarity.Stock, itemLevel: 1, durability: 100, maxDurability: 100, affixes: [] },
    { uid: "start-hi-comms", baseId: "hi-comms", rarity: ModuleRarity.Stock, itemLevel: 1, durability: 100, maxDurability: 100, affixes: [] },
    { uid: "start-lo-dcu", baseId: "lo-dcu", rarity: ModuleRarity.Stock, itemLevel: 1, durability: 100, maxDurability: 100, affixes: [] },
    { uid: "start-lo-battery", baseId: "lo-battery", rarity: ModuleRarity.Stock, itemLevel: 1, durability: 100, maxDurability: 100, affixes: [] },
  ];
  fit.high[0] = "start-tu-civ-miner";
  fit.high[1] = "start-tu-tractor";
  return {
    shipId: "scout",
    homeSysIdx: 0,
    pendingHomeSpawn: true,
    x: 0, y: 0, px: 0, py: 0,
    vx: 0, vy: 0, va: 0,
    angle: 0, prevAngle: 0,
    hp: SHIPS.scout.hull,
    maxHp: SHIPS.scout.hull,
    structure: Math.floor(SHIPS.scout.hull * 0.8),
    maxStructure: Math.floor(SHIPS.scout.hull * 0.8),
    shield: 0,
    shieldCd: 0,
    shieldHitGlow: 0,
    shieldHitAngle: 0,
    hullHitGlow: 0,
    hullHitAngle: 0,
    targetLock: null,
    lockQueue: [],
    fireControlSlot: 0,
    turretTargets: Array(hardpointCount).fill(null),
    highTargets: Array(fit.high?.length ?? 0).fill(null),
    turretCds: Array(hardpointCount).fill(0),
    turretPower: Array(hardpointCount).fill(false),
    turretPowerCd: Array(hardpointCount).fill(0),
    combatBar: { pos: 0.5, dir: 1 },
    energy: 100,
    sysIdx: 0,
    credits: 5000,
    ore: { iron: 0, nickel: 0, silicate: 0, carbon: 0, crystal: 0, exotic: 0 },
    mixedOreCargo: [],
    bulkMaterialsCargo: [],
    loot: { scrap: 0, chip: 0, cell: 0 },
    components: { circuit: 0, gear: 0, harness: 0, sensor_cluster: 0 },
    ammo: { hybrid: AMMO_START_HYBRID, missile: AMMO_START_MISSILE },
    moduleCargo: startingModules,
    moduleHp: { turret: Array(fit.turret.length).fill(null), high: Array(fit.high?.length ?? 0).fill(null), med: Array(fit.med?.length ?? 0).fill(null), low: Array(fit.low?.length ?? 0).fill(null) },
    slotActive: { turret: Array(fit.turret.length).fill(true), high: Array(fit.high?.length ?? 0).fill(true), med: Array(fit.med?.length ?? 0).fill(true), low: Array(fit.low?.length ?? 0).fill(true) },
    blueprints: {},
    skills: Object.fromEntries(SKILL_IDS.map(id => [id, 0])),
    skillXp: Object.fromEntries(SKILL_IDS.map(id => [id, 0])),
    xp: 0, level: 1, kills: 0,
    shootCd: 0, mineCd: 0,
    invincible: 0,
    thrustFx: false,
    boostFx: false,
    boostLockout: false,
    fitting: fit,

    _assignTargetId: null,
    contracts: [createTutorialMission(0, TUTORIAL_STEP_COUNT)],
    craftQueue: [],
    tractorCarryKg: 0,
    tractorTightness: 0.5,
    hubQueue: [],
    hubOutput: { loot: {}, ore: {}, materials: [], modules: [] },
    hubDeposit: { raw: [], ore: {}, materials: [], loot: {}, modules: [] },
    refineryStorage: makeDefaultRefineryStorage(),
    alloyCodex: makeDefaultAlloyCodex(),
    tutorial: { active: true, step: 0, completed: false, skipped: false },
    pilotName: "Freelancer",
    scannedSiteIds: [],
    completedSiteIds: [],
    discoveredConcentricSectors: [],
    discoveredLocalRegionIds: TUTORIAL_LOCAL_REGIONS.map((r) => r.id),
    stationOffers: [],
    stationOfferStationId: null,
    warpCooldown: 0,
    warpTargetIdx: -1,
    detectedSignatures: [],
    activeScan: null,
    scannerAngle: 0,
    scannerConeDeg: 180,
    mapScannerActive: false,
    mapScannerStrength: 0.5,
    saveVersion: CURRENT_SAVE_VERSION,
  };
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
    if (typeof legacyGunneryXp === "number" && legacyGunneryXp > 0) {
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
