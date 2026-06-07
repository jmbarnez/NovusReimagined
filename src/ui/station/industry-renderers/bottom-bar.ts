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
import { renderHubQueueSection } from "./assembly.js";
import { renderTransferSection } from "./transfer.js";
import { renderMaterialDossierSection } from "./material-sections.js";

export function renderBottomBar(): string {
  const pulseActive = stationState.indRailPulseUntil > Date.now();
  const queue = getState().player.hubQueue ?? [];
  const output = getState().player.hubOutput;
  const discoveries = getState().player.alloyCodex?.discoveries ?? [];
  const readyCount = (output.materials?.length ?? 0)
    + Object.values(output.loot ?? {}).filter((qty) => qty > 0).length
    + (output.modules?.length ?? 0);

  const tabs: Array<{ id: typeof stationState.indRailTab; icon: string; count: number }> = [
    { id: "queue", icon: "⏳", count: queue.length },
    { id: "output", icon: "📦", count: readyCount },
    { id: "dossier", icon: "📖", count: discoveries.length },
  ];

  let panelHtml = "";
  if (stationState.indRailTab === "queue") panelHtml = renderHubQueueSection();
  else if (stationState.indRailTab === "output") panelHtml = renderTransferSection() || `<section class="ind-queue-section"><div class="ind-queue-empty">No refinery output is ready.</div></section>`;
  else if (stationState.indRailTab === "dossier") panelHtml = renderMaterialDossierSection();

  return `
    <div class="ind-bottom-bar">
      <div class="ind-bottom-popover${panelHtml ? " is-open" : ""}">
        ${panelHtml}
      </div>
      <div class="ind-bottom-strip">
        ${tabs.map((tab) => `
          <button class="ind-bottom-btn${stationState.indRailTab === tab.id ? " active" : ""}${pulseActive && stationState.indRailPulseTab === tab.id ? " pulse" : ""}" data-action="indRailTab" data-rail-tab="${tab.id}" title="${tab.id}">
            <span class="ind-bottom-icon">${tab.icon}</span>
            ${tab.count > 0 ? `<span class="ind-bottom-badge">${tab.count}</span>` : ""}
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

export function renderRightRailTabs(): string {
  const pulseActive = stationState.indRailPulseUntil > Date.now();
  const tabs: Array<{ id: typeof stationState.indRailTab; label: string }> = [
    { id: "hold", label: "Hold" },
    { id: "dossier", label: "Dossier" },
    { id: "queue", label: "Queue" },
    { id: "output", label: "Output" },
  ];
  return `
    <div class="ind-rail-tabs">
      ${tabs.map((tab) => `
        <button class="ind-rail-tab${stationState.indRailTab === tab.id ? " active" : ""}${pulseActive && stationState.indRailPulseTab === tab.id ? " pulse" : ""}" data-action="indRailTab" data-rail-tab="${tab.id}">
          ${escHtml(tab.label)}
        </button>
      `).join("")}
    </div>
  `;
}

