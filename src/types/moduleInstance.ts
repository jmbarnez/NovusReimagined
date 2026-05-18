import { ModuleRarity } from "../data/moduleRarity.js";

export interface RolledAffix {
  id: string;
  name: string;
  affectedStat: string;
  value: number;
}

export interface ModuleInstance {
  uid: string;
  baseId: string;
  rarity: ModuleRarity;
  itemLevel: number;
  durability: number;
  maxDurability: number;
  affixes: RolledAffix[];
}
