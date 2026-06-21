import type { Player } from "../state.js";
import { SHIPS } from "../data/ships.js";
import { SKILL_IDS } from "../data/skills.js";
import {
  AMMO_START_HYBRID,
  AMMO_START_MISSILE,
} from "../constants.js";

const CURRENT_SAVE_VERSION = 2;
import { ModuleRarity } from "../data/moduleRarity.js";
import { ModuleInstance } from "../types/moduleInstance.js";
import { TUTORIAL_LOCAL_REGIONS } from "../data/tutorial-layout.js";
import { getHardpointSlotCount } from "../utils/hardpoints.js";
import { makeDefaultAlloyCodex, makeDefaultRefineryStorage } from "../refinery/index.js";
import { defaultFitting } from "./player-data.js";

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
  fit.med[0] = "start-me-ab1";
  fit.low[0] = "start-lo-dcu";
  fit.low[1] = "start-lo-battery";
  fit.high[2] = "start-tu-civ-scanner";
  fit.high[3] = "start-hi-comms";
  fit.med[1] = "start-me-shield";
  // Cannon and salvager are NOT pre-fitted so tutorial hangar-turrets step
  // can teach the player to fit them. ensurePlayerHasWeapon() adds a fallback
  // weapon later for non-tutorial paths.

  return {
    shipId: 'scout',
    homeSysIdx: 0,
    pendingHomeSpawn: true,
    x: 0, y: 0, vx: 0, vy: 0, va: 0, angle: 0, prevAngle: 0,
    px: 0, py: 0,
    hp: 100, maxHp: 100,
    shield: 0, shieldCd: 0,
    structure: 80, maxStructure: 80,
    targetLock: null,
    lockQueue: [],
    fireControlSlot: 0,
    netInputFrame: null,
    turretTargets: Array(hardpointCount).fill(null),
    highTargets: Array(fit.high?.length ?? 0).fill(null),
    turretCds: Array(hardpointCount).fill(0),
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
    blueprints: {},
    skills: Object.fromEntries(SKILL_IDS.map(id => [id, 0])),
    skillXp: Object.fromEntries(SKILL_IDS.map(id => [id, 0])),
    xp: 0, level: 1, kills: 0,
    shootCd: 0, mineCd: 0,
    invincible: 0,
    boostLockout: false,
    fitting: fit,

    contracts: [],
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
