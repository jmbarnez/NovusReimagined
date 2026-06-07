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

export function renderTransferSection(): string {
  if (!hasHubOutput(getState().player)) return "";
  const output = getState().player.hubOutput;
  const deposit = getState().player.hubDeposit;
  const stored = refineryStorageUnits().flatMap((unit) => unit.entries ?? []);
  const materialCount = (output.materials?.length ?? 0) + stored.length;
  const readyMass = [
    ...(output.materials ?? []),
    ...stored,
  ].reduce((sum, entry) => sum + entry.massKg, 0);
  const lootStreamCount = Object.values(output.loot ?? {}).filter((qty) => qty > 0).length + Object.values(deposit.loot ?? {}).filter((qty) => qty > 0).length;
  return `
    <section class="ind-queue-section">
      <div class="ind-queue-section-title">Stored Output</div>
      <div class="ind-transfer-card">
        <div class="ind-transfer-grid">
          <div class="ind-transfer-summary">
            <span>Materials</span>
            <strong>${materialCount}</strong>
          </div>
          <div class="ind-transfer-summary">
            <span>Loot</span>
            <strong>${lootStreamCount}</strong>
          </div>
          <div class="ind-transfer-summary">
            <span>Mass</span>
            <strong>${formatMass(readyMass)}</strong>
          </div>
        </div>
        <button class="ind-btn" data-action="collectRefinedOutput">Transfer Stored Materials To Cargo</button>
      </div>
    </section>
  `;
}

