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

export function renderMaterialHoldSection(): string {
  const cargoMaterials = aggregateCargoMaterials();
  const totalVolume = cargoMaterials.reduce((sum, entry) => sum + entry.volumeM3, 0);
  const totalMass = cargoMaterials.reduce((sum, entry) => sum + entry.massKg, 0);
  const storageUnits = refineryStorageUnits();
  const storedEntries = storageUnits.flatMap((unit) => unit.entries ?? []);
  const storedVolume = storedEntries.reduce((sum, entry) => sum + entry.volumeM3, 0);
  const storedMass = storedEntries.reduce((sum, entry) => sum + entry.massKg, 0);
  return `
    <section class="ind-queue-section">
      <div class="ind-queue-section-title">Refinery Reservoirs</div>
      <div class="ind-material-hold">
        <div class="ind-material-hold-summary">
          <div class="ind-material-hold-stat"><span>Tanks</span><strong>${storageUnits.length}</strong></div>
          <div class="ind-material-hold-stat"><span>Stored</span><strong>${formatVolume(storedVolume)}</strong></div>
          <div class="ind-material-hold-stat"><span>Mass</span><strong>${formatMass(storedMass)}</strong></div>
        </div>
        <div class="ind-material-hold-list">
          ${storageUnits.map((unit) => {
            const summary = refineryStorageSummary(unit);
            const entries = unit.entries ?? [];
            return `
              <div class="ind-storage-unit" style="${compositionAccentVars(aggregateStorageComposition(unit))}">
                <div class="ind-material-row-top">
                  <span>${escHtml(unit.label)}</span>
                  <span>${formatVolume(summary.usedM3)} / ${formatVolume(unit.capacityM3)}</span>
                </div>
                <div class="ind-queue-progress-track"><div class="ind-queue-progress-fill" style="width:${Math.round(summary.fillPct * 100)}%"></div></div>
                <div class="ind-material-row-bottom">
                  <span>${escHtml(unit.kind)} · ${entries.length} stacks</span>
                  <span>${escHtml(summary.dominantLabel)}</span>
                </div>
                <div class="ind-material-row-tags">${escHtml(summary.compositionText || "Empty")}</div>
                ${entries.slice(0, 3).map((entry) => `
                  <div class="ind-material-row-bottom">
                    <span>${escHtml(entry.label)}</span>
                    <span>${formatVolume(entry.volumeM3)} · ${formatMass(entry.massKg)}</span>
                  </div>
                `).join("")}
                ${entries.length > 3 ? `<div class="ind-material-row-tags">+${entries.length - 3} more stacks</div>` : ""}
              </div>
            `;
          }).join("")}
        </div>
      </div>
    </section>
    <section class="ind-queue-section">
      <div class="ind-queue-section-title">Cargo Material Hold</div>
      <div class="ind-material-hold">
        <div class="ind-material-hold-summary">
          <div class="ind-material-hold-stat"><span>Stacks</span><strong>${cargoMaterials.length}</strong></div>
          <div class="ind-material-hold-stat"><span>Volume</span><strong>${formatVolume(totalVolume)}</strong></div>
          <div class="ind-material-hold-stat"><span>Mass</span><strong>${formatMass(totalMass)}</strong></div>
        </div>
        <div class="ind-material-hold-list">
          ${cargoMaterials.length ? cargoMaterials.map((entry) => `
            <div class="ind-material-row" style="${compositionAccentVars(entry.composition)}">
              <div class="ind-material-row-top">
                <span>${escHtml(entry.label)}</span>
                <span>${formatVolume(entry.volumeM3)}</span>
              </div>
              <div class="ind-material-row-bottom">
                <span>${escHtml(entry.purpose)}</span>
                <span>${formatMass(entry.massKg)}</span>
              </div>
              ${entry.tags.length ? `<div class="ind-material-row-tags">${escHtml(entry.tags.slice(0, 3).join(" · "))}</div>` : ""}
            </div>
          `).join("") : `<div class="ind-queue-empty">No bulk material in cargo.</div>`}
        </div>
      </div>
    </section>
  `;
}

export function renderMaterialDossierSection(): string {
  const discoveries = getState().player.alloyCodex?.discoveries ?? [];
  const ready = fabricationReadyMaterials();
  const candidates = groupRefineryMaterials("processed");
  let highlightedDiscoveryId: string | null = null;
  if (currentStage() === "alloy" && discoveries.length) {
    let bestFit = 0;
    for (const material of candidates) {
      const selectedSourceIds = new Set(stationState.indAlloySelections[material.representativeId] ?? []);
      const selectedBlendSources = candidates.filter((entry) => selectedSourceIds.has(entry.representativeId));
      const preview = buildBlendPreview([material, ...selectedBlendSources]);
      const match = preview.discoveryMatch;
      if (!match) continue;
      const discovery = discoveries.find((entry) => entry.label === match.label);
      if (discovery && match.fitPct > bestFit) {
        bestFit = match.fitPct;
        highlightedDiscoveryId = discovery.id;
      }
    }
  }
  const visibleEntries = discoveries.length
    ? discoveries
    : ready.map((entry) => ({
      id: `ready-${entry.key}`,
      label: entry.label,
      composition: entry.composition,
      purpose: entry.purpose,
      tags: entry.tags,
      compatibleFamilyIds: entry.compatibleFamilyIds,
      densityKgPerM3: entry.massKg / Math.max(0.01, entry.volumeM3),
      seenCount: 0,
    }));
  return `
    <section class="ind-queue-section">
      <div class="ind-queue-section-title">Dossier</div>
      <div class="ind-material-hold ind-material-hold--dossier">
        <div class="ind-material-hold-list ind-material-hold-list--dossier">
          ${visibleEntries.length ? visibleEntries.slice(0, 4).map((entry) => `
            <div class="ind-codex-chip ind-codex-chip--dossier${entry.id === highlightedDiscoveryId ? " active" : ""}" style="${compositionAccentVars(entry.composition)}">
              <div class="ind-codex-chip-head">
                <div>
                  <strong>${escHtml(entry.label)}</strong>
                  <span>${escHtml(entry.purpose)}</span>
                </div>
                <div class="ind-codex-chip-meta">
                  <b>${entry.seenCount > 0 ? `${entry.seenCount}x` : "Ready"}</b>
                  <small>${entry.seenCount > 0 ? "known" : "use"}</small>
                </div>
              </div>
              ${renderCompositionBars(entry.composition)}
              <div class="ind-codex-chip-grid">
                <div>
                  <span>Use</span>
                  <strong>${entry.compatibleFamilyIds.length ? escHtml(entry.compatibleFamilyIds.map((familyId) => getAlloyFamilies().find((family) => family.id === familyId)?.label ?? familyId).join(" / ")) : "Experimental only"}</strong>
                </div>
                <div>
                  <span>Density</span>
                  <strong>${Math.round(entry.densityKgPerM3).toLocaleString()} kg/m³</strong>
                </div>
              </div>
              <small>${escHtml((entry.tags ?? []).join(" · "))}</small>
            </div>
          `).join("") : `<div class="ind-queue-empty">No discovered or fabrication-relevant materials yet.</div>`}
        </div>
      </div>
    </section>
  `;
}

