/**
 * Station module catalog. Racks: turret, high, med, low (EVE-style).
 * Bonuses are fractional adds applied on top of hull stats (e.g. +0.05 = +5% to that subsystem).
 */

export type Rack = "turret" | "high" | "med" | "low";
export type WeaponDelivery = "projectile" | "beam" | "missile";

export interface ModuleEffects {
  weaponMultBonus?: number;
  miningMultBonus?: number;
  hullEhpMultBonus?: number;
  addPowergrid?: number;
  mainEngineMN?: number;
  structuralMassMult?: number;
  simThrustPctBonus?: number;
  simMaxSpeedPctBonus?: number;
  simTurnPctBonus?: number;
  simDragDelta?: number;
  capacitorFlat?: number;
  capacitorPctBonus?: number;
  capRechargePctBonus?: number;
  shieldRegenFlat?: number;
  miningRangePctBonus?: number;
  miningRangeKmBonus?: number;
  lockScanBonus?: number;
  evasionMultBonus?: number;
  [key: string]: number | undefined;
}

export interface DamageProfile {
  em?: number;
  therm?: number;
  kin?: number;
  exp?: number;
  [key: string]: number | undefined;
}

export interface ModuleDef {
  id: string;
  name: string;
  short: string;
  desc: string;
  rack: Rack;
  price: number;
  powergrid: number;
  cpu: number;
  massKg: number;
  effects: ModuleEffects;
  weaponDelivery?: WeaponDelivery;
  projectileKmPerTick?: number;
  trackingSpeed?: number;
  optimalRange?: number;
  falloff?: number;
  damageProfile?: DamageProfile;
  mining?: boolean;
  isActive?: boolean;
  capDrainPerSec?: number;
  isSalvager?: boolean;
  salvageRollBonus?: number;
  isTractor?: boolean;
  tractorMaxMassKg?: number;
  tractorPullAccel?: number;
  isShield?: boolean;
  /**
   * If set, activating this module via hotkey fires the named ability
   * (see src/player/abilities.ts) instead of toggling slot power. The module
   * is otherwise treated as a passive: its `effects` always apply while fitted.
   */
  ability?: string;
  isComms?: boolean;
}

/** Packed module volume when stored as cargo units (purchase / unfit). */
export const MODULE_HOLD_VOLUME_M3 = 4;

export const MODULES: Record<string, ModuleDef> = {
  "tu-civilian-cannon": {
    id: "tu-civilian-cannon",
    name: "Civilian Autocannon",
    short: "Civ Cannon",
    desc: "Scrap-built civilian weapon. Requires no ammo, but deals pitiful damage.",
    rack: "turret",
    weaponDelivery: "projectile",
    projectileKmPerTick: 3.0,
    price: 50,
    powergrid: 1,
    cpu: 2,
    massKg: 500,
    effects: { weaponMultBonus: 0.0 },
    trackingSpeed: 0.85,
    optimalRange: 20,
    falloff: 10,
    damageProfile: { kin: 1 },
  },
  "tu-civilian-miner": {
    id: "tu-civilian-miner",
    name: "Civilian Mining Laser",
    short: "Civ Miner",
    desc: "Weak mining tool found on civilian craft. Better than nothing.",
    rack: "turret",
    mining: true,
    price: 80,
    powergrid: 2,
    cpu: 4,
    massKg: 800,
    effects: { miningMultBonus: 0.02 },
    optimalRange: 180,
  },
  "tu-cannon": {
    id: "tu-cannon",
    name: "Light Autocannon I",
    short: "Cannon I",
    desc: "Rapid-firing kinetic projectile weapon. Excellent tracking and moderate range.",
    rack: "turret",
    weaponDelivery: "projectile",
    projectileKmPerTick: 3.5,
    price: 1200,
    powergrid: 5,
    cpu: 10,
    massKg: 1500,
    effects: { weaponMultBonus: 0.02 },
    trackingSpeed: 0.90,
    optimalRange: 28,
    falloff: 18,
    damageProfile: { kin: 9, exp: 3 },
  },
  "tu-neutron": {
    id: "tu-neutron",
    name: "Light Neutron Blaster I",
    short: "Neutron I",
    desc: "Close-range hybrid turret. Bonus to outgoing kinetic pressure on locked targets.",
    rack: "turret",
    weaponDelivery: "projectile",
    projectileKmPerTick: 2.85,
    price: 1500,
    powergrid: 7,
    cpu: 12,
    massKg: 2200,
    effects: { weaponMultBonus: 0.04 },
    trackingSpeed: 0.85,
    optimalRange: 22,
    falloff: 14,
    damageProfile: { kin: 8, therm: 4 },
  },
  "tu-ion": {
    id: "tu-ion",
    name: "Ion Particle Projector I",
    short: "Ion I",
    desc: "Standard hitscan turret. Moderate load on grid, steady DPS application.",
    rack: "turret",
    weaponDelivery: "beam",
    price: 1500,
    powergrid: 9,
    cpu: 16,
    massKg: 2800,
    effects: { weaponMultBonus: 0.07 },
    trackingSpeed: 0.48,
    optimalRange: 44,
    falloff: 22,
    damageProfile: { em: 6, therm: 6 },
  },
  "tu-gauss": {
    id: "tu-gauss",
    name: "Gauss Linear Driver I",
    short: "Gauss I",
    desc: "Heavy turret. High powergrid draw, strong cycle efficiency vs armor.",
    rack: "turret",
    weaponDelivery: "projectile",
    projectileKmPerTick: 1.35,
    price: 1500,
    powergrid: 14,
    cpu: 22,
    massKg: 5200,
    effects: { weaponMultBonus: 0.1 },
    trackingSpeed: 0.14,
    optimalRange: 72,
    falloff: 28,
    damageProfile: { kin: 6, exp: 8 },
  },
  "tu-missile": {
    id: "tu-missile",
    name: "Assault Missile Launcher I",
    short: "Missile I",
    desc: "Guided ordnance. Click to launch when the convergence needle is centered (HUD follows your cursor).",
    rack: "turret",
    weaponDelivery: "missile",
    price: 2200,
    powergrid: 11,
    cpu: 18,
    massKg: 3800,
    effects: { weaponMultBonus: 0.06 },
    optimalRange: 38,
    falloff: 20,
    damageProfile: { exp: 10, kin: 4 },
  },
  "tu-strip": {
    id: "tu-strip",
    name: "Strip Miner I",
    short: "Strip Miner I",
    desc: "Turret hardpoint class-A ore extractor. Feeds the laser convergence core.",
    rack: "turret",
    mining: true,
    price: 1500,
    powergrid: 11,
    cpu: 20,
    massKg: 6200,
    effects: { miningMultBonus: 0.1, miningRangePctBonus: 0.12 },
  },
  "tu-pulse": {
    id: "tu-pulse",
    name: "Pulse Core Beam I",
    short: "Pulse I",
    desc: "Balanced energy projector for both patrol and skirmish.",
    rack: "turret",
    weaponDelivery: "beam",
    price: 1500,
    powergrid: 8,
    cpu: 15,
    massKg: 3400,
    effects: { weaponMultBonus: 0.05, miningMultBonus: 0.04 },
    trackingSpeed: 0.68,
    optimalRange: 28,
    falloff: 14,
    damageProfile: { em: 5, therm: 3 },
  },
  "hi-cruise": {
    id: "hi-cruise",
    name: "Cruise Launcher (offline)",
    short: "Cruise L.",
    desc: "Missile bus — offline in this build; reserves high-slot calibration.",
    rack: "high",
    price: 800,
    powergrid: 8,
    cpu: 20,
    massKg: 3200,
    effects: { weaponMultBonus: 0.02 },
  },
  "hi-nos": {
    id: "hi-nos",
    name: "Small Energy Neutralizer I",
    short: "Neut S",
    desc: "Active slot drawing hostile capacitor — represented as weapon cycle smoothing.",
    rack: "high",
    price: 800,
    powergrid: 6,
    cpu: 18,
    massKg: 1800,
    effects: { weaponMultBonus: 0.03 },
  },
  "tu-civilian-salvager": {
    id: "tu-civilian-salvager",
    name: "Civilian Salvager",
    short: "Civ Salvage",
    desc: "Salvage tool scavenged from a derelict. Slow beam, minimal roll bonus — but it gets the job done.",
    rack: "turret",
    isActive: true,
    isSalvager: true,
    salvageRollBonus: 0.02,
    capDrainPerSec: 3.0,
    price: 60,
    powergrid: 1,
    cpu: 3,
    massKg: 600,
    effects: {},
  },
  "hi-salv": {
    id: "hi-salv",
    name: "Salvager I",
    short: "Salvage I",
    desc: "Active turret. Lock a wreck piece and assign it — beam fires continuously to break down debris and extract salvage.",
    rack: "turret",
    isActive: true,
    isSalvager: true,
    salvageRollBonus: 0.1,
    capDrainPerSec: 5.0,
    price: 800,
    powergrid: 3,
    cpu: 8,
    massKg: 1100,
    effects: {},
  },
  "tu-tractor": {
    id: "tu-tractor",
    name: "Tractor Beam I",
    short: "Tractor I",
    desc: "Pulls a single locked object toward your ship. Only works if the object's mass is within rated capacity.",
    rack: "turret",
    isActive: true,
    isTractor: true,
    tractorMaxMassKg: 3000,
    tractorPullAccel: 140,
    capDrainPerSec: 3,
    price: 600,
    powergrid: 3,
    cpu: 6,
    massKg: 1000,
    effects: {},
    optimalRange: 600,
  },
  "hi-comms": {
    id: "hi-comms",
    name: "Comms Relay Array",
    short: "Comms Array",
    desc: "Enables comms links and hailing with nearby neutral faction ships.",
    rack: "high",
    price: 950,
    powergrid: 2,
    cpu: 8,
    massKg: 600,
    effects: {},
    isComms: true,
  },
  "hi-link": {
    id: "hi-link",
    name: "Command Burst Link (passive)",
    short: "Link",
    desc: "Leadership uplink; buffers weapon convergence timing slightly.",
    rack: "high",
    price: 800,
    powergrid: 1,
    cpu: 6,
    massKg: 400,
    effects: { weaponMultBonus: 0.02, simTurnPctBonus: 0.04 },
  },
  "me-ab1": {
    id: "me-ab1",
    name: "1MN Afterburner I",
    short: "AB 1MN",
    desc: "Basic propulsion overdrive. Increases thrust envelope and top speed modestly. Drains capacitor while active.",
    rack: "med",
    price: 650,
    powergrid: 0,
    cpu: 6,
    massKg: 450,
    isActive: true,
    capDrainPerSec: 8.0,
    effects: {
      mainEngineMN: 1,
      simThrustPctBonus: 0.04,
      simMaxSpeedPctBonus: 0.05,
      simTurnPctBonus: 0.02,
    },
  },
  "me-mwd": {
    id: "me-mwd",
    name: "5MN Microwarpdrive I",
    short: "MWD 5MN",
    desc: "Propulsion. Active: short-range warp burst along current heading.",
    rack: "med",
    price: 1200,
    powergrid: 0,
    cpu: 10,
    massKg: 950,
    ability: "blink",
    effects: {
      evasionMultBonus: 0.05,
      weaponMultBonus: 0.01,
      mainEngineMN: 5,
      simThrustPctBonus: 0.06,
      simMaxSpeedPctBonus: 0.08,
    },
  },
  "me-shield": {
    id: "me-shield",
    name: "Medium Shield Extender I",
    short: "Med Ext",
    desc: "Shield envelope expansion. Active: emergency invulnerability burst.",
    rack: "med",
    price: 1200,
    powergrid: 0,
    cpu: 18,
    massKg: 2100,
    isShield: true,
    ability: "bulwark",
    effects: { hullEhpMultBonus: 0.04, shieldRegenFlat: 8 },
  },
  "me-cap": {
    id: "me-cap",
    name: "Capacitor Recharger I",
    short: "Recharger I",
    desc: "Stabilizes peak recharge — reduces perceived weapon cycle time.",
    rack: "med",
    price: 1200,
    powergrid: 0,
    cpu: 12,
    massKg: 1400,
    effects: { miningMultBonus: 0.03, weaponMultBonus: 0.02, capacitorPctBonus: 0.08, capRechargePctBonus: 0.12 },
  },
  "me-tract": {
    id: "me-tract",
    name: "Single Sensor Booster I",
    short: "SeBo I",
    desc: "Tighter lock; improves turret application slightly.",
    rack: "med",
    price: 1200,
    powergrid: 0,
    cpu: 14,
    massKg: 1300,
    effects: { weaponMultBonus: 0.04, lockScanBonus: 0.22 },
  },
  "lo-gyro": {
    id: "lo-gyro",
    name: "Gyrostabilizer I",
    short: "Gyro I",
    desc: "Rate-of-fire and damage modifier stack — classic low slot.",
    rack: "low",
    price: 1000,
    powergrid: 0,
    cpu: 8,
    massKg: 800,
    effects: { weaponMultBonus: 0.05 },
  },
  "lo-dcu": {
    id: "lo-dcu",
    name: "Damage Control Unit I",
    short: "DCU I",
    desc: "Uniform resist profile. Small hull integrity bonus in simulation.",
    rack: "low",
    price: 1000,
    powergrid: 0,
    cpu: 6,
    massKg: 600,
    effects: { hullEhpMultBonus: 0.05 },
  },
  "lo-battery": {
    id: "lo-battery",
    name: "Reactor Core I",
    short: "Core I",
    desc: "Auxiliary power routing — increases available powergrid when fitted.",
    rack: "low",
    price: 1000,
    powergrid: 0,
    cpu: 0,
    massKg: 2400,
    effects: { addPowergrid: 6, capacitorFlat: 18 },
  },
  "lo-nano": {
    id: "lo-nano",
    name: "Nanofiber I",
    short: "Nano I",
    desc: "Structure mass reduction — flimsier but nimbler. Mining yield micro bonus.",
    rack: "low",
    price: 1000,
    powergrid: 0,
    cpu: 4,
    massKg: 450,
    effects: {
      miningMultBonus: 0.04,
      weaponMultBonus: 0.01,
      structuralMassMult: 0.88,
    },
  },
  "lo-hull": {
    id: "lo-hull",
    name: "200mm Plating I",
    short: "Plate I",
    desc: "Armor plate. Adds effective structure — ties into repair costs indirectly.",
    rack: "low",
    price: 1000,
    powergrid: 6,
    cpu: 0,
    massKg: 12800,
    effects: { hullEhpMultBonus: 0.08 },
  },
  "lo-deadspace": {
    id: "lo-deadspace",
    name: "Abyssal Stabilizer (sim)",
    short: "Abyssal S.",
    desc: "Experimental low-slot — high CPU tax, big weapon bonus.",
    rack: "low",
    price: 1000,
    powergrid: 0,
    cpu: 32,
    massKg: 900,
    effects: { weaponMultBonus: 0.12, miningMultBonus: 0.04 },
  },
  "tu-npc-sentry-cannon": {
    id: "tu-npc-sentry-cannon",
    name: "Sentry Cannon",
    short: "Sentry Cannon",
    desc: "Long range artillery.",
    rack: "turret",
    weaponDelivery: "projectile",
    projectileKmPerTick: 4.0,
    price: 0,
    powergrid: 0,
    cpu: 0,
    massKg: 0,
    effects: {},
  },
  "tu-npc-mite-laser": {
    id: "tu-npc-mite-laser",
    name: "Mite Laser",
    short: "Mite Laser",
    desc: "Tiny weak laser.",
    rack: "turret",
    weaponDelivery: "beam",
    price: 0,
    powergrid: 0,
    cpu: 0,
    massKg: 0,
    effects: {},
  },
};

export function getModule(id: string): ModuleDef | null {
  return MODULES[id] || null;
}

export const ALL_MODULE_IDS = Object.keys(MODULES);

export function getModulesByRack(rack: Rack): ModuleDef[] {
  return ALL_MODULE_IDS.map((id) => MODULES[id]).filter((m) => m.rack === rack);
}

export const MODULE_FLAGS = {
  isActive: (m: ModuleDef | null | undefined) => !!m?.isActive,
  isWeapon: (m: ModuleDef | null | undefined) => !!m?.weaponDelivery,
  isMiningTurret: (m: ModuleDef | null | undefined) => !!m?.mining,
  isSalvager: (m: ModuleDef | null | undefined) => !!m?.isSalvager,
  isTractor: (m: ModuleDef | null | undefined) => !!m?.isTractor,
  isBeam: (m: ModuleDef | null | undefined) => m?.weaponDelivery === "beam",
  isProjectile: (m: ModuleDef | null | undefined) => m?.weaponDelivery === "projectile",
  isMissile: (m: ModuleDef | null | undefined) => m?.weaponDelivery === "missile",
  isShield: (m: ModuleDef | null | undefined) => !!m?.isShield,
  isComms: (m: ModuleDef | null | undefined) => !!m?.isComms,
};
