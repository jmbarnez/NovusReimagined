import { G } from "../state.js";
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
import { logEvent, showXpEarned } from "../ui/hud-overlay.js";
import { ModuleRarity } from "../data/moduleRarity.js";
import { ModuleInstance } from "../types/moduleInstance.js";

export function defaultFitting(shipId: string): Record<string, (string | null)[]> {
  const s = SHIPS[shipId];
  const out: Record<string, (string | null)[]> = {};
  for (const r of RACK_TYPES) out[r] = Array(s.fitting[r] || 0).fill(null);
  return out;
}

export function makePlayer(): Player {
  const fit = defaultFitting('scout');
  const startingModules: ModuleInstance[] = [
    { uid: "start-tu-cannon", baseId: "tu-cannon", rarity: ModuleRarity.Stock, itemLevel: 1, durability: 100, maxDurability: 100, affixes: [] },
    { uid: "start-tu-strip", baseId: "tu-strip", rarity: ModuleRarity.Stock, itemLevel: 1, durability: 100, maxDurability: 100, affixes: [] },
    { uid: "start-me-ab1", baseId: "me-ab1", rarity: ModuleRarity.Stock, itemLevel: 1, durability: 100, maxDurability: 100, affixes: [] },
  ];
  fit.turret[0] = "start-tu-cannon";
  fit.turret[1] = "start-tu-strip";
  fit.med[0] = "start-me-ab1";
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
    turretTargets: Array(fit.turret.length).fill(null),
    highTargets: Array(fit.high?.length ?? 0).fill(null),
    turretCds: Array(fit.turret.length).fill(0),
    turretPower: Array(fit.turret.length).fill(false),
    turretPowerCd: Array(fit.turret.length).fill(0),
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
    contracts: [],
    craftQueue: [],
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
    if (!Array.isArray(p.moduleCargo)) p.moduleCargo = [];
    if ((p as any).moduleInventory && typeof (p as any).moduleInventory === "object") {
      for (const [baseId, count] of Object.entries((p as any).moduleInventory)) {
        for (let i = 0; i < (count as number); i++) {
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
      delete (p as any).moduleInventory;
    }
    if ((p as any).damagedModuleHp) delete (p as any).damagedModuleHp;
    if (!p.moduleHp || typeof p.moduleHp !== "object") p.moduleHp = { turret: [], high: [], med: [], low: [] };
    if (!p.slotActive || typeof p.slotActive !== "object") p.slotActive = { turret: [], high: [], med: [], low: [] };
    if (!Array.isArray(p.moduleCargo)) p.moduleCargo = [];
    if (!Array.isArray(p.contracts)) p.contracts = [];
    if (!Array.isArray(p.craftQueue)) p.craftQueue = [];
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
    // Skill points were removed — strip the field from old saves.
    if ("skillPoints" in (p as object)) delete (p as { skillPoints?: number }).skillPoints;
    return p;
  } catch {
    return makePlayer();
  }
}

export function savePlayer() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(G.P));
  } catch (e) {
    console.warn("[save] localStorage failed:", e);
  }
}

export function ensureAmmoDefaults(p = G.P) {
  if (!p.ammo) p.ammo = { hybrid: AMMO_START_HYBRID, missile: AMMO_START_MISSILE };
  else {
    if (p.ammo.hybrid == null) p.ammo.hybrid = AMMO_START_HYBRID;
    if (p.ammo.missile == null) p.ammo.missile = AMMO_START_MISSILE;
  }
}

export function xpForLevel(lvl: number): number {
  return LEVEL_XP_BASE * lvl * lvl;
}

export function addXp(amount: number) {
  G.P.xp += amount;
  while (G.P.xp >= xpForLevel(G.P.level)) {
    G.P.xp -= xpForLevel(G.P.level);
    G.P.level++;
    invalidate();
    G.P.hp = Math.min(G.P.hp + 30, getStats().maxHp);
    floatText(G.P.x, G.P.y - 50, `✦ LEVEL ${G.P.level} ✦`, "#ffe066");
    spawnParticles(G.P.x, G.P.y, "#ffe066", 6, 70);
    logEvent(`Level up! You are now level ${G.P.level}`, "system");
  }
}

export function addSkillXp(skillId: string, amount: number) {
  if (!SKILL_IDS.includes(skillId as any)) return;
  if (amount <= 0) return;
  const prevXp = G.P.skillXp[skillId] || 0;
  const oldLvl = levelForSkillXp(prevXp);
  if (oldLvl >= MAX_SKILL_LEVEL) return;
  G.P.skillXp[skillId] = prevXp + amount;
  showXpEarned(skillId, amount);
  syncSkillsFromXp();
  const newLvl = levelForSkillXp(G.P.skillXp[skillId]);
  if (newLvl > oldLvl) {
    const def = SKILL_DEF[skillId as SkillId];
    const name = def?.name ?? skillId;
    const icon = def?.icon ?? "⭐";
    floatText(G.P.x, G.P.y - 45, `${icon} ${name} Lv ${newLvl}`, "#ffe066");
    spawnParticles(G.P.x, G.P.y, "#ffe066", 4, 60);
    logEvent(`${name} improved to level ${newLvl}!`, "system");
  }
}

function syncSkillsFromXp() {
  for (const id of SKILL_IDS) {
    G.P.skills[id] = levelForSkillXp(G.P.skillXp[id] || 0);
  }
}
