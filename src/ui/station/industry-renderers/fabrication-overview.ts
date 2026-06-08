import { getState } from "../../../state-access.js";
import { fmtDuration, getAlloyFamilies, getCargoMixedOreInputs, hasHubOutput } from "../../../refinery/index.js";
import { MACHINES, RECIPES, poolItemLabel, type Recipe } from "../../../data/industryRecipes.js";
import { aggregateStorageComposition, estimateMixedOreCargoMassKg, processMixedSource, separateMaterial } from "../../../refinery/index.js";
import { formatCompositionBreakdown } from "../../../utils/ore-naming.js";
import { escHtml } from "../../../utils/format.js";
import { stationState, iconSvg } from "../shared.js";
import { t } from "../../../utils/i18n.js";
import {
  MACHINE_META,
  RECIPE_NOTES,
  STAGES,
  aggregateCargoMaterials,
  buildBlendPreview,
  canAffordRecipe,
  compositionAccentVars,
  currentStage,
  fabricationReadyMaterials,
  filteredAssemblyRecipes,
  formatMass,
  formatTime,
  formatVolume,
  groupRefineryMaterials,
  ioPill,
  machineLabel,
  refineryHoldingsSummary,
  refineryStorageSummary,
  refineryStorageUnits,
  refineryZoneSummaries,
  renderCompositionBars,
  renderCompositionRibbon,
  renderHeatSelect,
  renderRefineryStockEmpty,
  selectedHeatMode,
  selectedProcessQty,
  stageMeta,
} from "../industry/model/index.js";

import { renderAssemblyRecipeCard } from "./assembly.js";
export function renderFabricationOverview(): string {
  const cargoMaterials = aggregateCargoMaterials();
  const totalCargoMass = cargoMaterials.reduce((sum, entry) => sum + entry.massKg, 0);
  const componentCount = Object.values(getState().player.components).reduce((sum, qty) => sum + qty, 0);
  const activeJobs = getState().player.craftQueue.length;
  return `
    <section class="ind-hero">
      <div class="ind-hero-copy">
        <div class="ind-overline">Station Fabrication</div>
        <h2 class="ind-hero-title">Fabrication</h2>
        <p class="ind-hero-body">Consume alloy stock and recovered parts to build practical assemblies without dragging refinery internals into the same workflow.</p>
      </div>
      <div class="ind-metric-strip">
        <div class="ind-metric"><span class="ind-metric-label">Alloy families</span><strong>${cargoMaterials.length}</strong></div>
        <div class="ind-metric"><span class="ind-metric-label">Cargo mass</span><strong>${formatMass(totalCargoMass)}</strong></div>
        <div class="ind-metric"><span class="ind-metric-label">Components</span><strong>${componentCount}</strong></div>
        <div class="ind-metric"><span class="ind-metric-label">Active jobs</span><strong>${activeJobs}</strong></div>
      </div>
    </section>
  `;
}

