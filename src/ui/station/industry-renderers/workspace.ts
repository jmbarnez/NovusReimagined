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
import { renderCompactHoldingsSummary, renderStorageSchematic } from "./overview.js";

export function renderStageWorkspace(activeKind: "processed" | "separated" | "alloy", controlsHtml: string): string {
  return `
    <div class="ind-stage-surface">
      <aside id="refinery-stage-dock" class="ind-stage-dock">
        ${controlsHtml}
      </aside>
      <div class="ind-stage-machine">
        ${renderCompactHoldingsSummary()}
        ${renderStorageSchematic(activeKind)}
      </div>
    </div>
  `;
}

export function renderDockOperatorStrip(
  title: string,
  sourceLabel: string,
  detail: string,
  metrics: Array<{ label: string; value: string }>,
): string {
  return `
    <div class="ind-dock-status">
      <div class="ind-dock-status-main">
        <span>${escHtml(title)}</span>
        <strong>${escHtml(sourceLabel)}</strong>
        <small>${escHtml(detail)}</small>
      </div>
      <div class="ind-dock-status-metrics">
        ${metrics.map((metric) => `
          <div>
            <span>${escHtml(metric.label)}</span>
            <strong>${escHtml(metric.value)}</strong>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

export function renderRunRoute(labels: string[]): string {
  return `
    <div class="ind-run-route" aria-hidden="true">
      ${labels.map((label, index) => `
        <span>${escHtml(label)}</span>
        ${index < labels.length - 1 ? "<i></i>" : ""}
      `).join("")}
    </div>
  `;
}

