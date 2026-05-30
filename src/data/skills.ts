/**
 * Player skills — only the ones wired into actual mechanics.
 * Levels are derived from skill XP (not stored directly).
 */

export const SKILL_IDS = [
  "ballistics",
  "beam_weapons",
  "missile_guidance",
  "engineering",
  "mining",
  "refining",
  "salvage",
  "metallurgy",
  "surveying",
  "decryption",
] as const;

/** Weapon delivery → required combat skill mapping. */
export type WeaponDelivery = "projectile" | "beam" | "missile";
export const WEAPON_SKILL: Record<WeaponDelivery, SkillId> = {
  projectile: "ballistics",
  beam: "beam_weapons",
  missile: "missile_guidance",
};

export type SkillId = (typeof SKILL_IDS)[number];

export const SKILL_CATEGORIES = [
  "combat",
  "industry",
] as const;

export type SkillCategory = (typeof SKILL_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<SkillCategory, string> = {
  combat: "⚔ Combat",
  industry: "⛏ Industry",
};

export const CATEGORY_COLORS: Record<SkillCategory, string> = {
  combat: "#cc4444",
  industry: "#cc8844",
};

export interface SkillDef {
  name: string;
  desc: string;
  icon: string;
  category: SkillCategory;
  color: string;
}

export const SKILL_DEF: Record<SkillId, SkillDef> = {
  ballistics: {
    name: "Ballistics",
    desc: "Kinetic projectile mastery — autocannons, blasters, railguns hit harder.",
    icon: "⌖",
    category: "combat",
    color: "#cc4444",
  },
  beam_weapons: {
    name: "Beam Weapons",
    desc: "Energy turret discipline — ion projectors and pulse beams cycle for more damage.",
    icon: "☀",
    category: "combat",
    color: "#cc66aa",
  },
  missile_guidance: {
    name: "Missile Guidance",
    desc: "Ordnance targeting — warheads track better and detonate for more damage.",
    icon: "➹",
    category: "combat",
    color: "#cc8844",
  },
  engineering: {
    name: "Engineering",
    desc: "Reactor capacity, capacitor regen, hull integrity, and shield recharge tuning.",
    icon: "⚙️",
    category: "combat",
    color: "#cc6644",
  },
  mining: {
    name: "Mining",
    desc: "Laser extraction cycles — faster ore yield and longer mining range.",
    icon: "⛏️",
    category: "industry",
    color: "#88cc44",
  },
  refining: {
    name: "Refining",
    desc: "Smelter throughput — more output per ore at the station.",
    icon: "🌡️",
    category: "industry",
    color: "#cc8844",
  },
  salvage: {
    name: "Salvage",
    desc: "Wreck harvesting and component recovery techniques.",
    icon: "🏗️",
    category: "industry",
    color: "#88aacc",
  },
  metallurgy: {
    name: "Metallurgy",
    desc: "Field processing of salvage into refined components via the station processor.",
    icon: "⚗️",
    category: "industry",
    color: "#00e8c8",
  },
  surveying: {
    name: "Surveying",
    desc: "Signal analysis and sector survey operations.",
    icon: "⌁",
    category: "industry",
    color: "#66aacc",
  },
  decryption: {
    name: "Decryption",
    desc: "Encrypted site breach and trace resistance.",
    icon: "◇",
    category: "industry",
    color: "#aa88ff",
  },
};

export const MAX_SKILL_LEVEL = 20;

export function xpForSkillLevel(lvl: number): number {
  if (lvl <= 0) return 0;
  return Math.floor(200 * Math.pow(lvl, 1.75));
}

export function levelForSkillXp(xp: number): number {
  let lvl = 0;
  while (xp >= xpForSkillLevel(lvl + 1) && lvl < MAX_SKILL_LEVEL) {
    lvl++;
  }
  return lvl;
}

export function xpToNextSkillLevel(skillId: SkillId, currentXp: number): number {
  const lvl = levelForSkillXp(currentXp);
  if (lvl >= MAX_SKILL_LEVEL) return 0;
  return xpForSkillLevel(lvl + 1) - currentXp;
}
