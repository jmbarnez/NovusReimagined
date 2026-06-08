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

import { renderStageWorkspace, renderDockOperatorStrip, renderRunRoute } from "./workspace.js";
import { renderCompactHoldingsSummary, renderStorageSchematic } from "./overview.js";
export function renderProcessStage(): string {
  const mixed = getCargoMixedOreInputs(getState().player);
  const processedTargets = refineryStorageUnits().filter((unit) => unit.kind === "processed" || unit.kind === "intake");
  const selectedSourceId = mixed.some((slot) => String(slot.index) === stationState.indProcessSource)
    ? stationState.indProcessSource
    : (mixed[0] ? String(mixed[0].index) : null);
  const selectedSlot = mixed.find((slot) => String(slot.index) === selectedSourceId) ?? null;
  const cards = mixed.map((slot, idx) => {
    const isSelected = String(slot.index) === selectedSourceId;
    const qty = selectedProcessQty(slot.index, slot.qty);
    const heatMode = selectedHeatMode(`cargo-${slot.index}`);
    const sourceMassKg = estimateMixedOreCargoMassKg(qty, slot.composition);
    const preview = processMixedSource({
      sourceMassKg,
      composition: slot.composition,
      richness: slot.richness,
      skillLevel: getState().player.skills.refining ?? 0,
      heatMode,
    });
    const retainedPct = sourceMassKg > 0 ? Math.round((preview.massKg / sourceMassKg) * 100) : 0;
    const holdings = refineryHoldingsSummary();
    const compactAfterStock = holdings.processedVolumeM3 + preview.volumeM3;
    return `
      <div class="ind-feed-card ind-feed-card--process${isSelected ? " is-selected" : " is-compact"}" ${isSelected ? `id="refinery-process-source"` : ""} style="${compositionAccentVars(slot.composition)}">
        <div class="ind-feed-head">
          <div>
            <div class="ind-feed-title">${escHtml(slot.label)}</div>
            <div class="ind-feed-subtitle">${escHtml(formatCompositionBreakdown(slot.composition))}</div>
          </div>
          <div class="ind-feed-badge">${isSelected ? "active" : `rich ${slot.richness.toFixed(1)}`}</div>
        </div>
        <div class="ind-feed-layout ind-feed-layout--process">
          <div class="ind-feed-stats">
            <div><span>Ore</span><strong>${slot.qty}</strong></div>
            <div><span>Mass</span><strong>${formatMass(slot.massKg)}</strong></div>
            <div><span>Output</span><strong>Stock</strong></div>
          </div>
          ${isSelected ? `
            <div class="ind-process-preview">
              <div class="ind-process-preview-head">
                <span>Result</span>
                <span>${retainedPct}% kept</span>
              </div>
              <div class="ind-process-preview-grid">
                <div><span>Batch</span><strong>${formatMass(sourceMassKg)}</strong></div>
                <div><span>Stock</span><strong>${formatVolume(preview.volumeM3)}</strong></div>
                <div><span>Kept</span><strong>${formatMass(preview.massKg)}</strong></div>
                <div><span>Waste</span><strong>${formatMass(preview.wasteMassKg)}</strong></div>
              </div>
              <div class="ind-stage-outcome">
                <span>After</span>
                <strong>${formatVolume(compactAfterStock)} stock</strong>
              </div>
            </div>
          ` : `
            <div class="ind-process-compact-summary">
              <div><span>Run</span><strong>${formatMass(sourceMassKg)}</strong></div>
              <div><span>Keep</span><strong>${retainedPct}%</strong></div>
              <div><span>After</span><strong>${formatVolume(compactAfterStock)}</strong></div>
            </div>
          `}
        </div>
        ${isSelected ? `
          <div class="ind-feed-actions ind-feed-actions--sticky tutorial-hangar-highlight-anchor" id="refinery-process-controls">
            <div class="ind-action-tray ind-action-tray--process">
              <div class="ind-action-tray-copy">
                <span>Run</span>
                <strong>Batch, route, heat, start.</strong>
              </div>
              ${renderRunRoute(["Cargo", "Stock", "Queue"])}
              <div class="ind-action-tray-grid">
                <div class="ind-action-step" data-step="01">
                  <label class="ind-qty-wrap">
                    <span>Batch</span>
                    <input type="number" class="ind-qty-input" data-cargo-index="${slot.index}" min="1" max="${slot.qty}" value="${qty}">
                  </label>
                </div>
                <div class="ind-action-step" data-step="02">
                  <label class="ind-heat-control">
                    <span>To</span>
                    <select class="ind-storage-select" data-process-target="${slot.index}">
                      ${processedTargets.map((unit) => `<option value="${unit.id}" ${stationState.indProcessTarget[String(slot.index)] === unit.id ? "selected" : ""}>${escHtml(unit.label)}</option>`).join("")}
                    </select>
                  </label>
                </div>
                <div class="ind-action-step" data-step="03">
                  ${renderHeatSelect(`cargo-${slot.index}`)}
                </div>
                <div class="ind-action-step ind-action-step--button" data-step="04">
                  <button class="ind-btn ind-btn--primary" data-action="processMixedCargo" data-cargo-index="${slot.index}">Start</button>
                </div>
              </div>
            </div>
          </div>
        ` : `
          <div class="ind-feed-actions ind-feed-actions--compact">
            <button class="ind-btn ind-btn--ghost" data-action="selectProcessSource" data-cargo-index="${slot.index}">Use</button>
          </div>
        `}
      </div>
    `;
  }).join("");

  return `
    <section class="ind-stage-panel">
      <div class="ind-panel-head">
        <div class="ind-panel-title">Ore In</div>
        <div class="ind-panel-subtitle">Turn ore into stock.</div>
      </div>
      ${renderStageWorkspace("processed", `
        <div class="ind-stage-dock-head">
          <div>
            <div class="ind-panel-title">Input</div>
            <div class="ind-panel-subtitle">Pick ore and start.</div>
          </div>
        </div>
        ${renderDockOperatorStrip(
          "Selected ore",
          selectedSlot?.label ?? "No ore selected",
          selectedSlot ? `${selectedSlot.qty} batches · ${formatMass(selectedSlot.massKg)}` : "Mine or transfer mixed ore to begin.",
          [
            { label: "Route", value: "Cargo -> Stock" },
            { label: "Sources", value: String(mixed.length) },
          ],
        )}
        <div id="refinery-process-list" class="ind-stage-grid ind-stage-grid--dock">
          ${cards || `<div class="ind-stage-empty">No mixed ore cargo available for processing.</div>`}
        </div>
      `)}
    </section>
  `;
}

