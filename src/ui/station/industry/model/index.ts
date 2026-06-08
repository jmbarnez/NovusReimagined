export type { RefiningStage, StageMeta } from "./state.js";
export {
  STAGES,
  HEAT_OPTIONS,
  MACHINE_META,
  RECIPE_NOTES,
  currentStage,
  stageMeta,
  selectedHeatMode,
  selectedProcessQty,
  playerPool,
  materialStacks,
  refineryStorageUnits,
  refineryMaterials,
  stockOf,
} from "./state.js";

export {
  formatVolume,
  formatMass,
  formatQty,
  formatTime,
  machineLabel,
  oreColor,
  renderHeatSelect,
  ioPill,
  renderRefineryStockEmpty,
} from "./formatting.js";

export {
  aggregateCargoMaterials,
  refineryZoneSummaries,
  refineryHoldingsSummary,
  refineryStorageSummary,
} from "./holdings.js";

export {
  canAffordRecipe,
  filteredAssemblyRecipes,
  fabricationReadyMaterials,
} from "./recipes.js";

export type { GroupedRefineryMaterial, BlendPreview } from "./composition.js";
export {
  dominantOreKey,
  compositionGradient,
  compositionAccentVars,
  renderCompositionBars,
  renderCompositionRibbon,
  groupRefineryMaterials,
  buildBlendPreview,
} from "./composition.js";
