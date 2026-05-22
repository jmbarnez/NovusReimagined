import { rf, rpick } from "./math.js";
import { TAU } from "../constants.js";
import { ENEMY_DEFS } from "../data/enemies.js";
import { MODULES } from "../data/modules.js";
import { ModuleRarity } from "../data/moduleRarity.js";
import { generateModuleInstance } from "../loot/generateModule.js";
import type { ModuleInstance } from "../types/moduleInstance.js";
import type { SpawnZone } from "../data/enemy-spawns.js";
import type { System, Enemy, EnemyFitting } from "../types/world.js";

function makeStockInstance(baseId: string): ModuleInstance {
  return {
    uid: baseId + "-" + Math.random().toString(36).substring(2, 9),
    baseId,
    rarity: ModuleRarity.Stock,
    itemLevel: 1,
    durability: 100,
    maxDurability: 100,
    affixes: [],
  };
}

export function buildEnemyFitting(type: string, level: number, f: () => number): EnemyFitting {
  const def = ENEMY_DEFS[type];
  const fitting: Record<string, (string | null)[]> & { _tempInstances?: ModuleInstance[] } = { turret: [], high: [], med: [], low: [] };
  if (!def.slots) return fitting as EnemyFitting;

  const lootPool = def.moduleLoot?.map(l => l.id) || [];

  const pickSimple = (rack: string) => {
    const preferred = lootPool.filter(id => MODULES[id]?.rack === rack);
    if (preferred.length > 0) return rpick(f, preferred);
    return null;
  };

  const tempInstances: ModuleInstance[] = [];

  const fillRack = (rack: string, count: number = 1) => {
    for (let i = 0; i < count; i++) {
      const baseId = pickSimple(rack);
      if (baseId) {
        const inst = level <= 2
          ? makeStockInstance(baseId)
          : generateModuleInstance(baseId, level, level / 5);
        tempInstances.push(inst);
        fitting[rack].push(inst.uid);
      } else {
        fitting[rack].push(null);
      }
    }
  };

  if (def.slots.turret) fillRack("turret", def.slots.turret);
  if (def.slots.high) fillRack("high", def.slots.high);
  if (def.slots.med) fillRack("med", def.slots.med);
  if (def.slots.low) fillRack("low", def.slots.low);

  fitting._tempInstances = tempInstances;
  return fitting as EnemyFitting;
}

export function buildEnemyFromSpawn(sys: System, zone: SpawnZone, entry: { type: string; count: number; level: number }, idx: number, f: () => number): Enemy {
  const def = ENEMY_DEFS[entry.type];
  const ang = f() * TAU;
  const rad = Math.sqrt(f()) * zone.radius;
  const x = Math.round(zone.x + Math.cos(ang) * rad);
  const y = Math.round(zone.y + Math.sin(ang) * rad);

  const hp = Math.ceil((def.baseHp ?? 45) * (1 + entry.level * 0.2));
  const shield = Math.ceil((def.shield ?? 0) * (1 + entry.level * 0.2));
  const structure = Math.ceil((def.baseStructure ?? 0) * (1 + entry.level * 0.2));
  const credits = Math.floor((def.credits ?? 4) * (1 + entry.level * 0.5));

  const en: Enemy = {
    id: `en-${sys.id}-z${idx}`,
    type: entry.type,
    name: def.name,
    x, y,
    px: x, py: y,
    spawnX: x, spawnY: y,
    hp, maxHp: hp,
    shield, maxShield: shield,
    structure, maxStructure: structure,
    weaponMult: def.weaponMult ?? 1.0,
    vx: 0, vy: 0,
    angle: f() * TAU, prevAngle: f() * TAU,
    speed: def.speed ?? 100,
    credits,
    loot: { ...def.loot },
    turretCds: [],
    alive: true, respawnTimer: 0,
    aggroRange: 250 + entry.level * 30,
    weaponRange: def.weaponRange,
    sigRadius: def.sigRadius || 30,
    accuracy: def.accuracy ?? 1.0,
    fitting: buildEnemyFitting(entry.type, entry.level, f),
  };

  if (en.fitting.turret) {
    en.turretCds = new Array(en.fitting.turret.length).fill(0);
  }

  en.level = entry.level;
  return en;
}
