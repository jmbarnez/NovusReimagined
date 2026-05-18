export enum ModuleRarity {
  Stock = "Stock",
  Modified = "Modified",
  Overclocked = "Overclocked",
  Experimental = "Experimental",
}

export const RARITY_CONFIG: Record<string, { color: string; affixCount: [number, number]; sellMult: number }> = {
  [ModuleRarity.Stock]: { color: "#ffffff", affixCount: [0, 0], sellMult: 1.0 },
  [ModuleRarity.Modified]: { color: "#4488ff", affixCount: [1, 2], sellMult: 1.2 },
  [ModuleRarity.Overclocked]: { color: "#ffcc44", affixCount: [2, 4], sellMult: 1.5 },
  [ModuleRarity.Experimental]: { color: "#cc88ff", affixCount: [4, 6], sellMult: 2.0 },
};
