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

export function renderOverview(): string {
  const stage = stageMeta(currentStage());
  const player = getState().player;
  const holdings = refineryHoldingsSummary();
  const queueCount = player.hubQueue?.length ?? 0;
  const readyCount = (player.hubOutput.materials?.length ?? 0)
    + Object.values(player.hubOutput.loot ?? {}).filter((qty) => qty > 0).length
    + (player.hubOutput.modules?.length ?? 0);
  return `
    <section class="ind-refinery-header">
      <div class="ind-refinery-header-copy">
        <div class="ind-overline">Station Refining</div>
        <div class="ind-refinery-header-row">
          <h2 class="ind-refinery-title">${escHtml(stage.label)}</h2>
          <div class="ind-refinery-chips">
            <span class="ind-status-chip"><b>${holdings.mixedOreQty}</b> ore</span>
            <span class="ind-status-chip"><b>${formatVolume(holdings.processedVolumeM3 + holdings.separatedVolumeM3 + holdings.alloyVolumeM3)}</b> refinery</span>
            <span class="ind-status-chip"><b>${queueCount + readyCount}</b> jobs</span>
          </div>
        </div>
        <p class="ind-refinery-body">${escHtml(stage.body)}</p>
      </div>
    </section>
  `;
}

export function renderCompactHoldingsSummary(): string {
  const holdings = refineryHoldingsSummary();
  return `
    <section class="ind-holdings-band ind-holdings-band--compact">
      <div class="ind-holdings-grid ind-holdings-grid--compact">
        <div class="ind-holdings-card"><span>Ore</span><strong>${holdings.mixedOreQty}</strong><small>in cargo</small></div>
        <div class="ind-holdings-card ind-holdings-card--processed"><span>Stock</span><strong>${formatVolume(holdings.processedVolumeM3)}</strong><small>mixed</small></div>
        <div class="ind-holdings-card ind-holdings-card--separated"><span>Streams</span><strong>${formatVolume(holdings.separatedVolumeM3)}</strong><small>split</small></div>
        <div class="ind-holdings-card ind-holdings-card--alloy"><span>Alloy</span><strong>${formatVolume(holdings.alloyVolumeM3)}</strong><small>ready</small></div>
      </div>
    </section>
  `;
}

export function renderStorageSchematic(activeKind?: "intake" | "processed" | "separated" | "alloy"): string {
  const zones = refineryZoneSummaries();
  const focusKind = activeKind;
  const activeRoute = activeKind === "processed"
    ? ["intake", "processed"]
    : activeKind === "separated"
      ? ["processed", "separated"]
      : activeKind === "alloy"
        ? ["processed", "alloy"]
        : [];
  const routeLabels: Record<"intake" | "processed" | "separated" | "alloy", string> = {
    intake: "Intake",
    processed: "Processed",
    separated: "Separated",
    alloy: "Alloy",
  };
  const kindColors: Record<"intake" | "processed" | "separated" | "alloy", string> = {
    intake: "#6d8ea8",
    processed: "#5f9f7b",
    separated: "#b08a4e",
    alloy: "#9a6fbf",
  };
  const totalVolume = zones.reduce((sum, z) => sum + z.totalVolumeM3, 0);

  return `
    <section id="refinery-pipeline" class="ind-pipeline-bar ind-pipeline-bar--${activeKind ?? "idle"}">
      <div class="ind-pipeline-strip">
        ${zones.map((zone, index, array) => {
          const isActive = activeRoute.includes(zone.kind);
          const isFocus = focusKind === zone.kind;
          const isRouteEdge = index < array.length - 1 && activeRoute.includes(zone.kind) && activeRoute.includes(array[index + 1]!.kind);
          const pct = totalVolume > 0 ? Math.min(100, (zone.totalVolumeM3 / totalVolume) * 100) : 0;
          return `
            <div class="ind-pipeline-node${isActive ? " active" : ""}${isFocus ? " focus" : ""}${activeRoute.length && !isActive ? " muted" : ""}">
              <div class="ind-pipeline-node-head">
                <span class="ind-pipeline-label">${routeLabels[zone.kind]}</span>
                <strong>${formatVolume(zone.totalVolumeM3)}</strong>
              </div>
              <div class="ind-pipeline-track">
                <div class="ind-pipeline-fill" style="width:${Math.max(2, pct)}%;background:${kindColors[zone.kind]}"></div>
              </div>
              ${index < array.length - 1 ? `<i class="ind-pipeline-arrow${isRouteEdge ? " active" : ""}"></i>` : ""}
            </div>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

