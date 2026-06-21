import { ModuleRarity, RARITY_CONFIG } from "../data/moduleRarity.js";
import { AFFIXES, RolledAffix } from "../data/affixes.js";
import { ModuleInstance } from "../types/moduleInstance.js";
import { MODULES, MODULE_FLAGS, type ModuleDef } from "../data/modules.js";
import { rpick, rf } from "../utils/math.js";

function generateUid(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function isPlayerWeaponModule(baseId: string): boolean {
  const base = MODULES[baseId];
  return !!base
    && MODULE_FLAGS.isWeapon(base)
    && !MODULE_FLAGS.isMiningTurret(base)
    && !baseId.startsWith("tu-npc-");
}

export function playerWeaponModuleIds(): string[] {
  return Object.keys(MODULES).filter(isPlayerWeaponModule);
}

function moduleTypeTags(base: ModuleDef): string[] {
  const tags: string[] = [];
  if (MODULE_FLAGS.isWeapon(base) && !MODULE_FLAGS.isMiningTurret(base)) tags.push("weapon");
  if (MODULE_FLAGS.isMiningTurret(base)) tags.push("mining");
  if (MODULE_FLAGS.isSalvager(base)) tags.push("salvage");
  if (MODULE_FLAGS.isTractor(base)) tags.push("tractor");
  if (base.ability) tags.push("ability");
  return tags;
}

export function generateModuleInstance(baseId: string, itemLevel: number, danger: number): ModuleInstance {
  const base = MODULES[baseId];
  if (!base) throw new Error(`Unknown module base: ${baseId}`);

  // 1. Roll Rarity
  const rarities = Object.values(ModuleRarity);
  const rarityWeights = rarities.map((r, i) => Math.pow(danger + 1, i));
  const totalWeight = rarityWeights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * totalWeight;
  let rarity = ModuleRarity.Stock;
  for (let i = 0; i < rarities.length; i++) {
    roll -= rarityWeights[i];
    if (roll <= 0) {
      rarity = rarities[i];
      break;
    }
  }

  // 2. Filter affixes by module rack/type
  const moduleTags = moduleTypeTags(base);
  const weaponOnlyRolls = moduleTags.includes("weapon");
  const possibleAffixes = Object.values(AFFIXES).filter(a => {
    if (a.allowedRacks && a.allowedRacks.length > 0) {
      if (!a.allowedRacks.includes(base.rack)) return false;
    }
    if (weaponOnlyRolls) {
      return !!a.allowedTypes?.includes("weapon");
    }
    if (a.allowedTypes && a.allowedTypes.length > 0) {
      return a.allowedTypes.some((tag) => moduleTags.includes(tag));
    }
    return true;
  });

  // 3. Roll Affixes
  const config = RARITY_CONFIG[rarity];
  const numAffixes = Math.floor(Math.random() * (config.affixCount[1] - config.affixCount[0] + 1)) + config.affixCount[0];

  const affixes: RolledAffix[] = [];
  const selected = new Set<string>();

  for (let i = 0; i < numAffixes; i++) {
    const candidates = possibleAffixes.filter(a => !selected.has(a.id));
    if (candidates.length === 0) break;
    const affixDef = rpick(() => Math.random(), candidates);
    if (!affixDef) continue;
    selected.add(affixDef.id);

    const validTiers = affixDef.tiers.filter(t => t.minIlvl <= itemLevel);
    const tier = validTiers.length > 0 ? validTiers[validTiers.length - 1] : affixDef.tiers[0];
    if (!tier) continue;
    const value = rf(() => Math.random(), tier.minRoll, tier.maxRoll);

    affixes.push({
      id: affixDef.id,
      name: affixDef.name,
      affectedStat: affixDef.affectedStat,
      value: value,
    });
  }

  return {
    uid: generateUid(),
    baseId,
    rarity,
    itemLevel,
    durability: 100,
    maxDurability: 100,
    affixes,
  };
}
