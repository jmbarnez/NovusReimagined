export interface AffixTier {
  minIlvl: number;
  minRoll: number;
  maxRoll: number;
}

export interface AffixDef {
  id: string;
  name: string;
  affectedStat: string;
  tiers: AffixTier[];
  /** Which racks this affix can appear on. Empty = all racks. */
  allowedRacks?: string[];
  /** Which module categories this affix is restricted to. Empty = all. */
  allowedTypes?: string[];
}

export interface RolledAffix {
  id: string;
  name: string;
  affectedStat: string;
  value: number;
}

/** Rack-specific affix groups for coherent loot drops. */
const RACK_COMBAT = ["turret"];
const RACK_UTILITY = ["high", "med"];
const RACK_RIG = ["low"];
const ALL_RACKS = [...RACK_COMBAT, ...RACK_UTILITY, ...RACK_RIG];

const TYPE_WEAPON = ["weapon"];

export const AFFIXES: Record<string, AffixDef> = {
  // ── Combat (turret) ──────────────────────────────────────────────────────
  dmg: {
    id: "dmg", name: "Weapon Damage", affectedStat: "weaponDamagePct",
    tiers: [{ minIlvl: 1, minRoll: 0.05, maxRoll: 0.15 }, { minIlvl: 10, minRoll: 0.15, maxRoll: 0.30 }],
    allowedRacks: RACK_COMBAT,
    allowedTypes: TYPE_WEAPON,
  },
  range: {
    id: "range", name: "Weapon Range", affectedStat: "weaponRangePct",
    tiers: [{ minIlvl: 1, minRoll: 0.05, maxRoll: 0.10 }, { minIlvl: 10, minRoll: 0.10, maxRoll: 0.20 }],
    allowedRacks: RACK_COMBAT,
    allowedTypes: TYPE_WEAPON,
  },
  tracking: {
    id: "tracking", name: "Projectile Speed", affectedStat: "weaponProjectileSpeedPct",
    tiers: [{ minIlvl: 1, minRoll: 0.05, maxRoll: 0.15 }, { minIlvl: 10, minRoll: 0.15, maxRoll: 0.30 }],
    allowedRacks: RACK_COMBAT,
    allowedTypes: TYPE_WEAPON,
  },
  cycle: {
    id: "cycle", name: "Cycle Speed", affectedStat: "weaponCyclePct",
    tiers: [{ minIlvl: 1, minRoll: 0.04, maxRoll: 0.10 }, { minIlvl: 10, minRoll: 0.10, maxRoll: 0.20 }],
    allowedRacks: RACK_COMBAT,
    allowedTypes: TYPE_WEAPON,
  },
  cap_efficiency: {
    id: "cap_efficiency", name: "Capacitor Efficiency", affectedStat: "weaponCapCostPct",
    tiers: [{ minIlvl: 1, minRoll: 0.04, maxRoll: 0.10 }, { minIlvl: 10, minRoll: 0.10, maxRoll: 0.18 }],
    allowedRacks: RACK_COMBAT,
    allowedTypes: TYPE_WEAPON,
  },

  // ── Utility (high/med slots) ──────────────────────────────────────────────
  shield: {
    id: "shield", name: "Shield Capacity", affectedStat: "hullEhpMultBonus",
    tiers: [{ minIlvl: 1, minRoll: 0.05, maxRoll: 0.10 }, { minIlvl: 10, minRoll: 0.10, maxRoll: 0.20 }],
    allowedRacks: RACK_UTILITY,
  },
  cap: {
    id: "cap", name: "Capacitor", affectedStat: "capacitorPctBonus",
    tiers: [{ minIlvl: 1, minRoll: 0.05, maxRoll: 0.10 }, { minIlvl: 10, minRoll: 0.10, maxRoll: 0.20 }],
    allowedRacks: RACK_UTILITY,
  },
  cap_regen: {
    id: "cap_regen", name: "Cap Recharge", affectedStat: "capRechargePctBonus",
    tiers: [{ minIlvl: 1, minRoll: 0.05, maxRoll: 0.12 }, { minIlvl: 10, minRoll: 0.12, maxRoll: 0.25 }],
    allowedRacks: RACK_UTILITY,
  },
  shield_regen: {
    id: "shield_regen", name: "Shield Regen", affectedStat: "shieldRegenFlat",
    tiers: [{ minIlvl: 1, minRoll: 0.5, maxRoll: 1.5 }, { minIlvl: 10, minRoll: 1.5, maxRoll: 3.0 }],
    allowedRacks: RACK_UTILITY,
  },
  evasion: {
    id: "evasion", name: "Evasion", affectedStat: "evasionMultBonus",
    tiers: [{ minIlvl: 1, minRoll: 0.03, maxRoll: 0.08 }, { minIlvl: 10, minRoll: 0.08, maxRoll: 0.15 }],
    allowedRacks: RACK_UTILITY,
  },

  thrust: {
    id: "thrust", name: "Thrust", affectedStat: "simThrustPctBonus",
    tiers: [{ minIlvl: 1, minRoll: 0.03, maxRoll: 0.08 }, { minIlvl: 10, minRoll: 0.08, maxRoll: 0.15 }],
    allowedRacks: RACK_UTILITY,
  },

  // ── Rigs (low slots) ─────────────────────────────────────────────────────
  speed: {
    id: "speed", name: "Max Speed", affectedStat: "simMaxSpeedPctBonus",
    tiers: [{ minIlvl: 1, minRoll: 0.02, maxRoll: 0.05 }, { minIlvl: 10, minRoll: 0.05, maxRoll: 0.10 }],
    allowedRacks: RACK_RIG,
  },
  turn: {
    id: "turn", name: "Turn Rate", affectedStat: "simTurnPctBonus",
    tiers: [{ minIlvl: 1, minRoll: 0.03, maxRoll: 0.08 }, { minIlvl: 10, minRoll: 0.08, maxRoll: 0.15 }],
    allowedRacks: RACK_RIG,
  },
  mass_reduce: {
    id: "mass_reduce", name: "Mass Reduction", affectedStat: "structuralMassMult",
    tiers: [{ minIlvl: 1, minRoll: -0.05, maxRoll: -0.02 }, { minIlvl: 10, minRoll: -0.10, maxRoll: -0.05 }],
    allowedRacks: RACK_RIG,
  },
  hull: {
    id: "hull", name: "Hull Reinforcement", affectedStat: "hullEhpMultBonus",
    tiers: [{ minIlvl: 1, minRoll: 0.03, maxRoll: 0.08 }, { minIlvl: 10, minRoll: 0.08, maxRoll: 0.15 }],
    allowedRacks: RACK_RIG,
  },

  // ── Universal (any rack) ─────────────────────────────────────────────────
  cpu: {
    id: "cpu", name: "CPU Load", affectedStat: "cpu",
    tiers: [{ minIlvl: 1, minRoll: -0.05, maxRoll: -0.02 }, { minIlvl: 10, minRoll: -0.10, maxRoll: -0.05 }],
  },
  pg: {
    id: "pg", name: "Powergrid", affectedStat: "addPowergrid",
    tiers: [{ minIlvl: 1, minRoll: 1, maxRoll: 3 }, { minIlvl: 10, minRoll: 3, maxRoll: 6 }],
  },
  mining: {
    id: "mining", name: "Mining Yield", affectedStat: "miningMultBonus",
    tiers: [{ minIlvl: 1, minRoll: 0.05, maxRoll: 0.15 }, { minIlvl: 10, minRoll: 0.15, maxRoll: 0.30 }],
    allowedRacks: RACK_COMBAT,
  },
  mining_range: {
    id: "mining_range", name: "Mining Range", affectedStat: "miningRangePctBonus",
    tiers: [{ minIlvl: 1, minRoll: 0.05, maxRoll: 0.12 }, { minIlvl: 10, minRoll: 0.12, maxRoll: 0.22 }],
    allowedRacks: RACK_COMBAT,
  },
};
