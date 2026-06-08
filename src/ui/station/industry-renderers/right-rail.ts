import { getState } from "../../../state-access.js";
import { fmtDuration, getAlloyFamilies, getCargoMixedOreInputs, hasHubOutput } from "../../../hub.js";
import { MACHINES, RECIPES, poolItemLabel, type Recipe } from "../../../data/industryRecipes.js";
import { aggregateStorageComposition, estimateMixedOreCargoMassKg, processMixedSource, separateMaterial } from "../../../refining.js";
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

import { renderRightRailTabs } from "./bottom-bar.js";
import { renderMaterialHoldSection, renderMaterialDossierSection } from "./material-sections.js";
import { renderHubQueueSection, renderAssemblyQueueSection } from "./assembly.js";
import { renderTransferSection } from "./transfer.js";
export function renderRightRail(): string {
  const pulseActive = stationState.indRailPulseUntil > Date.now();
  let body = "";
  if (stationState.indRailTab === "hold") body = renderMaterialHoldSection();
  else if (stationState.indRailTab === "dossier") body = renderMaterialDossierSection();
  else if (stationState.indRailTab === "queue") body = renderHubQueueSection();
  else body = renderTransferSection() || `
    <section class="ind-queue-section">
      <div class="ind-queue-section-title">Ready Output</div>
      <div class="ind-queue-empty">No refinery output is ready.</div>
    </section>
  `;
  return `
    <aside id="refinery-right-rail" class="ind-queue-panel${pulseActive && stationState.indRailPulseTab === stationState.indRailTab ? " ind-queue-panel--pulse" : ""}">
      ${renderRightRailTabs()}
      <div class="ind-rail-panel-body">
        ${body}
      </div>
    </aside>
  `;
}

