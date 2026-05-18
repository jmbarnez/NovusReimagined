import { ModuleRarity, RARITY_CONFIG } from "../data/moduleRarity.js";
import { AFFIXES, RolledAffix } from "../data/affixes.js";
import { ModuleInstance } from "../types/moduleInstance.js";
import { MODULES } from "../data/modules.js";
import { rpick, rf } from "../utils/math.js";

function generateUid(): string {
  return Math.random().toString(36).substring(2, 11);
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

  // 2. Filter affixes by module rack
  const possibleAffixes = Object.values(AFFIXES).filter(a => {
    if (a.allowedRacks && a.allowedRacks.length > 0) {
      return a.allowedRacks.includes(base.rack);
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
