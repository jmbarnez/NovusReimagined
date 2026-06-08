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
export function renderSeparationPreview(material: {
  id: string;
  materialId: string;
  kind: "processed" | "alloy" | "customBlend";
  label: string;
  volumeM3: number;
  massKg: number;
  composition: Record<string, number>;
  alloyFamilyId?: string;
}): string {
  const preview = separateMaterial({
    material,
    skillLevel: getState().player.skills.refining ?? 0,
    heatMode: selectedHeatMode(material.id),
  });
  return `
    <div class="ind-process-preview">
      <div class="ind-process-preview-head">
        <span>Result</span>
        <span>${preview.outputs.length} streams</span>
      </div>
      ${renderCompositionRibbon([
        {
          label: "Source",
          composition: material.composition,
          meta: `${formatVolume(material.volumeM3)} · ${formatMass(material.massKg)}`,
          tone: "source",
        },
        {
          label: "Streams",
          composition: preview.outputs.reduce<Record<string, number>>((acc, output) => {
            for (const [oreKey, fraction] of Object.entries(output.composition)) {
              acc[oreKey] = Math.max(acc[oreKey] ?? 0, fraction);
            }
            return acc;
          }, {}),
          meta: `${preview.outputs.length} outputs · ${formatMass(preview.outputs.reduce((sum, output) => sum + output.massKg, 0))}`,
          tone: "result",
        },
      ])}
      <div class="ind-separate-streams">
        ${preview.outputs.map((output) => `
          <div class="ind-separate-stream">
            <div class="ind-separate-stream-head">
              <span>${escHtml(output.label)}</span>
              <span>${formatVolume(output.volumeM3)}</span>
            </div>
            <div class="ind-separate-stream-body">${escHtml(formatCompositionBreakdown(output.composition))}</div>
            <div class="ind-separate-stream-foot">${formatMass(output.massKg)}</div>
          </div>
        `).join("") || `<div class="ind-feed-block-empty">No recoverable streams at this heat setting.</div>`}
      </div>
      <div class="ind-process-preview-grid">
        <div><span>Kept</span><strong>${formatMass(preview.outputs.reduce((sum, output) => sum + output.massKg, 0))}</strong></div>
        <div><span>Waste</span><strong>${formatMass(preview.wasteMassKg)}</strong></div>
      </div>
    </div>
  `;
}

export function renderSeparateStage(): string {
  const processedOnly = groupRefineryMaterials("processed").filter((entry) => Object.keys(entry.composition).length > 1);
  const selectedSourceId = processedOnly.some((entry) => entry.representativeId === stationState.indSeparateSource)
    ? stationState.indSeparateSource
    : (processedOnly[0]?.representativeId ?? null);
  const selectedMaterial = processedOnly.find((entry) => entry.representativeId === selectedSourceId) ?? null;
  const cards = processedOnly.map((material) => {
    const isSelected = material.representativeId === selectedSourceId;
    const preview = separateMaterial({
      material: {
        id: material.representativeId,
        materialId: "processed_stock",
        kind: "processed",
        label: material.label,
        volumeM3: material.volumeM3,
        massKg: material.massKg,
        composition: material.composition,
      },
      skillLevel: getState().player.skills.refining ?? 0,
      heatMode: selectedHeatMode(material.representativeId),
    });
    const keptMassKg = preview.outputs.reduce((sum, output) => sum + output.massKg, 0);
    return `
    <div class="ind-feed-card ind-feed-card--process${isSelected ? " is-selected" : " is-compact"}" style="${compositionAccentVars(material.composition)}">
      <div class="ind-feed-head">
        <div>
          <div class="ind-feed-title">${escHtml(material.label)}</div>
          <div class="ind-feed-subtitle">${escHtml(formatCompositionBreakdown(material.composition))}</div>
        </div>
        <div class="ind-feed-badge">${material.count} stacks</div>
      </div>
      <div class="ind-feed-layout ind-feed-layout--split">
        <div>
          <div class="ind-feed-stats">
            <div><span>Volume</span><strong>${formatVolume(material.volumeM3)}</strong></div>
            <div><span>Mass</span><strong>${formatMass(material.massKg)}</strong></div>
            <div><span>Mode</span><strong>Split</strong></div>
          </div>
          ${renderCompositionBars(material.composition)}
        </div>
        ${isSelected ? renderSeparationPreview({
          id: material.representativeId,
          materialId: "processed_stock",
          kind: "processed",
          label: material.label,
          volumeM3: material.volumeM3,
          massKg: material.massKg,
          composition: material.composition,
        }) : `
          <div class="ind-process-compact-summary">
            <div><span>Streams</span><strong>${preview.outputs.length}</strong></div>
            <div><span>Kept</span><strong>${formatMass(keptMassKg)}</strong></div>
            <div><span>Waste</span><strong>${formatMass(preview.wasteMassKg)}</strong></div>
          </div>
        `}
      </div>
      ${isSelected ? `
        <div class="ind-feed-actions ind-feed-actions--sticky">
            <div class="ind-action-tray">
              <div class="ind-action-tray-copy">
                <span>Run</span>
                <strong>Heat, split, auto-route.</strong>
              </div>
              ${renderRunRoute(["Stock", "Ore bins", "Queue"])}
              <div class="ind-action-tray-grid ind-action-tray-grid--compact">
                <div class="ind-action-step" data-step="01">
                  ${renderHeatSelect(material.representativeId)}
                </div>
                <div class="ind-action-step ind-action-step--button" data-step="02">
                  <button class="ind-btn ind-btn--primary" data-action="separateStock" data-material-id="${material.representativeId}">Start</button>
                </div>
            </div>
          </div>
        </div>
      ` : `
        <div class="ind-feed-actions ind-feed-actions--compact">
          <button class="ind-btn ind-btn--ghost" data-action="selectSeparateSource" data-material-id="${material.representativeId}">Use</button>
        </div>
      `}
    </div>
  `;
  }).join("");

  return `
    <section class="ind-stage-panel">
      <div class="ind-panel-head">
        <div class="ind-panel-title">Split</div>
        <div class="ind-panel-subtitle">Break stock into simple streams; outputs auto-route to matching ore bins.</div>
      </div>
      ${renderStageWorkspace("separated", `
        <div class="ind-stage-dock-head">
          <div>
            <div class="ind-panel-title">Streams</div>
            <div class="ind-panel-subtitle">Pick stock and split it into persistent ore bins.</div>
          </div>
        </div>
        ${renderDockOperatorStrip(
          "Selected stock",
          selectedMaterial?.label ?? "No stock selected",
          selectedMaterial ? `${formatVolume(selectedMaterial.volumeM3)} · ${formatMass(selectedMaterial.massKg)}` : "Process mixed ore before splitting streams.",
          [
            { label: "Route", value: "Stock -> Streams" },
            { label: "Output", value: "Matching ore bins" },
            { label: "Sources", value: String(processedOnly.length) },
          ],
        )}
        <div class="ind-stage-grid ind-stage-grid--dock">
          ${cards || renderRefineryStockEmpty("No processed stock is waiting in the refinery. Process mixed ore first.")}
        </div>
      `)}
    </section>
  `;
}

