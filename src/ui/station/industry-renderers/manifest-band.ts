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
} from "../industry-model.js";

export function renderManifestBand(): string {
  const cargoMaterials = aggregateCargoMaterials();
  if (!cargoMaterials.length) {
    return `
      <section class="ind-stockband ind-stockband--empty">
        <div class="ind-stockband-title">Cargo Material Manifest</div>
        <div class="ind-stockband-empty">No bulk materials in cargo yet. Process or collect stock to start building alloy inventory.</div>
      </section>
    `;
  }
  return `
    <section class="ind-stockband">
      <div class="ind-stockband-head">
        <div class="ind-stockband-title">Cargo Material Manifest</div>
        <div class="ind-stockband-subtitle">Bulk stock already transferred into ship cargo.</div>
      </div>
      <div class="ind-stockband-grid">
        ${cargoMaterials.map((entry) => `
          <div class="ind-stock-chip">
            <div class="ind-stock-chip-top">
              <span>${escHtml(entry.label)}</span>
              <span>${formatVolume(entry.volumeM3)}</span>
            </div>
            <div class="ind-stock-chip-mid">${escHtml(entry.purpose)}</div>
            <div class="ind-stock-chip-bot">${formatMass(entry.massKg)}</div>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

