// Refining domain — barrel export
// Split from the former monolithic src/refining.ts and src/hub.ts

// Alloy families & heat constants
export { ALLOY_FAMILIES, HEAT_EFFICIENCY, oreDensityKgPerM3 } from "./families.js";
export type { AlloyFamily } from "./families.js";

// Composition, volume, mass estimation
export {
  averageOreUnitVolumeM3,
  averageDensityKgPerM3,
  estimateMixedOreCargoVolumeM3,
  estimateMixedOreCargoMassKg,
  estimateCargoMaterialMassKg,
  normalizeCompositionKey,
  stackSignature,
  discoverySignatureKey,
  materialLabelForComposition,
} from "./composition.js";

// Alloy assessment & discovery
export {
  makeDefaultAlloyCodex,
  createDiscoveredAlloy,
  assessAlloyFamilies,
  resolveAlloyFamily,
  upsertDiscoveredAlloy,
} from "./assessment.js";
export type { AlloyFamilyAssessment } from "./assessment.js";

// Storage helpers
export {
  makeDefaultRefineryStorage,
  flattenStorageMaterials,
  storageUsedVolumeM3,
  storageFillPct,
  aggregateStorageComposition,
  materialMatchesRecipeMaterial,
  preferredStorageForMaterial,
} from "./storage.js";

// Processing operations
export { processMixedSource, separateMaterial, alloyMaterial } from "./processing.js";

// Hub core
export { getHub, updateHub } from "./hub-core.js";

// Hub state helpers (internal, but exported for tests/advanced use)
export {
  DEFAULT_HEAT_MODE,
  createMaterialStack,
  asteroidMatterMassKg,
  processJobDuration,
  refinementHeatMode,
  skillUnlockBonus,
  findHubMaterial,
  storeRefineryMaterial,
  logStorageOverflow,
  blendMaterials,
} from "./hub-state.js";

// Hub job completion handlers
export {
  completeAsteroidProcessing,
  completeMixedOreProcessing,
  completeSeparation,
  completeAlloying,
  completeDebrisProcessing,
} from "./hub-jobs.js";

// Hub cargo actions
export {
  processFloatingItem,
  processMixedOreCargo,
  separateHubMaterial,
  alloyHubMaterial,
} from "./hub-cargo.js";

// Hub output & queue
export {
  tickHubQueue,
  collectHubOutput,
  hasHubDeposit,
  hasHubOutput,
} from "./hub-output.js";

// Hub queries & formatting
export {
  getDropZoneCenter,
  fmtDuration,
  getProcessFee,
  getFloatingDeposits,
  getCargoMixedOreInputs,
  getAlloyFamilies,
} from "./hub-queries.js";
