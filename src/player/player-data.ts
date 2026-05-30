
import { PlayerAccess, getState } from "../state-access.js";
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

function applyStarterTrainingFit(p: Player): void {
  const hasRegressedStarterFit =
    p.fitting?.turret?.includes("start-tu-civ-cannon") ||
    p.fitting?.med?.includes("start-me-ab1") ||
    p.fitting?.low?.includes("start-tu-civ-scanner");
  if (!p.tutorial?.active || p.tutorial.completed || !hasRegressedStarterFit) return;
  const fit = defaultFitting(p.shipId);
  fit.high[0] = "start-tu-civ-miner";
  fit.high[1] = "start-tu-tractor";
  p.fitting = fit;
  const hardpointCount = fit.high?.length ?? fit.turret.length;
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

export function makePlayer(): Player {
  const fit = defaultFitting('scout');
  const hardpointCount = fit.high?.length ?? fit.turret.length;
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
    ore: { iron: 0, crystal: 0, exotic: 0 },
    refined: { bar: 0, lattice: 0, condensate: 0 },
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
    fitting: fit,

    _assignTargetId: null,
    contracts: [createTutorialMission(0, TUTORIAL_STEP_COUNT)],
    craftQueue: [],
    tractorCarryKg: 0,
    tractorTightness: 0.5,
    hubQueue: [],
    hubOutput: { loot: {}, ore: {}, refined: {}, modules: [] },
    hubDeposit: { raw: [], ore: {}, loot: {}, modules: [] },
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
  };
}

export function loadPlayer(): Player {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return makePlayer();
    const p = JSON.parse(raw) as Player;
    p.vx = p.vy = p.va = 0;
    p.px = p.x; p.py = p.y; p.prevAngle = p.angle;
    p.shootCd = p.mineCd = 0; p.invincible = 1.5;
    p.thrustFx = false;
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
    if (!p.turretCds) p.turretCds = Array((p.fitting.turret?.length || 0)).fill(0);
    if (!p.turretPower) p.turretPower = Array((p.fitting.turret?.length || 0)).fill(false);
    if (!p.turretPowerCd) p.turretPowerCd = Array((p.fitting.turret?.length || 0)).fill(0);
    if (!Array.isArray(p.turretTargets)) p.turretTargets = [];
    if (!Array.isArray(p.highTargets)) p.highTargets = [];
    if (!p.moduleCargo) p.moduleCargo = [];
    const starter = makePlayer();
    const ownedUids = new Set(p.moduleCargo.map((inst) => inst.uid));
    for (const inst of starter.moduleCargo) {
      if (!ownedUids.has(inst.uid)) p.moduleCargo.push({ ...inst, affixes: [...inst.affixes] });
    }
    const oldSave = p as unknown as { moduleInventory?: Record<string, number>; damagedModuleHp?: unknown };
    if (oldSave.moduleInventory && typeof oldSave.moduleInventory === "object") {
      for (const [baseId, count] of Object.entries(oldSave.moduleInventory)) {
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
      delete oldSave.moduleInventory;
    }
    if (oldSave.damagedModuleHp) delete oldSave.damagedModuleHp;
    if (!p.moduleHp || typeof p.moduleHp !== "object") p.moduleHp = { turret: [], high: [], med: [], low: [] };
    if (!p.slotActive || typeof p.slotActive !== "object") p.slotActive = { turret: [], high: [], med: [], low: [] };
    if (!Array.isArray(p.moduleCargo)) p.moduleCargo = [];
    if (!Array.isArray(p.contracts)) p.contracts = [];
    if (!Array.isArray(p.craftQueue)) p.craftQueue = [];
    if (!Array.isArray(p.hubQueue)) p.hubQueue = [];
    if (!p.hubOutput || typeof p.hubOutput !== "object") p.hubOutput = { loot: {}, ore: {}, refined: {}, modules: [] };
    if (!p.hubOutput.refined) p.hubOutput.refined = {};
    if (!p.hubDeposit || typeof p.hubDeposit !== "object") p.hubDeposit = { raw: [], ore: {}, loot: {}, modules: [] };
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
    return p;
  } catch {
    return makePlayer();
  }
}

export function savePlayer() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(getState().player));
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
      floatText(p.x, p.y - 50, `✦ LEVEL ${p.level} ✦`, "#ffe066");
      spawnParticles(p.x, p.y, "#ffe066", 6, 70);
      logEvent(`Level up! You are now level ${p.level}`, "system");
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
      floatText(p.x, p.y - 45, `${icon} ${name} Lv ${newLvl}`, "#ffe066");
      spawnParticles(p.x, p.y, "#ffe066", 4, 60);
      logEvent(`${name} improved to level ${newLvl}!`, "system");
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
