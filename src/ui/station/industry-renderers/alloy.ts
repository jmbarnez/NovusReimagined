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
export function renderAlloyStage(): string {
  const codex = getState().player.alloyCodex;
  const candidates = groupRefineryMaterials("processed");
  const cards = candidates.map((material) => {
    const selectedSourceIds = new Set(stationState.indAlloySelections[material.representativeId] ?? []);
    const blendOptions = candidates.filter((entry) => entry.representativeId !== material.representativeId);
    const selectedBlendSources = blendOptions.filter((entry) => selectedSourceIds.has(entry.representativeId));
    const blendPreview = buildBlendPreview([material, ...selectedBlendSources]);
    const targetStorageId = stationState.indAlloyTargetStorage[material.representativeId] ?? "";
    const showMoreFits = stationState.indAlloyShowMore[material.representativeId] ?? false;
    const compatibleFamilies = blendPreview.familyMatches.filter((entry) => entry.status !== "off").slice(0, 2);
    const bestMatch = blendPreview.familyMatches[0];
    const primaryButtonMatches = blendPreview.familyMatches
      .filter((entry) => entry.status !== "off")
      .slice(0, 2);
    const fallbackPrimaryMatches = primaryButtonMatches.length ? primaryButtonMatches : blendPreview.familyMatches.slice(0, 2);
    const secondaryMatches = blendPreview.familyMatches.filter((entry) => !fallbackPrimaryMatches.some((primary) => primary.family.id === entry.family.id));
    const discoveryLabel = blendPreview.discoveryMatch
      ? `${blendPreview.discoveryMatch.label} ${blendPreview.discoveryMatch.fitPct.toFixed(0)}%`
      : "No close codex match";
    return `
      <div class="ind-feed-card" style="${compositionAccentVars(material.composition)}">
        <div class="ind-feed-head">
          <div>
            <div class="ind-feed-title">${escHtml(material.label)}</div>
            <div class="ind-feed-subtitle">${escHtml(formatCompositionBreakdown(material.composition))}</div>
          </div>
          <div class="ind-feed-badge">${material.count} source stacks</div>
        </div>
        <div class="ind-feed-layout ind-feed-layout--alloy">
          <div>
            <div class="ind-feed-stats">
              <div><span>Volume</span><strong>${formatVolume(material.volumeM3)}</strong></div>
              <div><span>Mass</span><strong>${formatMass(material.massKg)}</strong></div>
              <div><span>Mode</span><strong>Family resolution</strong></div>
            </div>
            ${renderCompositionBars(material.composition)}
            <div class="ind-alloy-summary-grid">
              <div class="ind-alloy-summary-card">
                <span>Use</span>
                <strong>${compatibleFamilies.length ? escHtml(compatibleFamilies.map((entry) => entry.family.label).join(" / ")) : "Experimental only"}</strong>
              </div>
              <div class="ind-alloy-summary-card">
                <span>Codex</span>
                <strong>${escHtml(discoveryLabel)}</strong>
              </div>
            </div>
          </div>
          <div class="ind-alloy-match-panel">
            <div class="ind-alloy-match-head">
              <span>Preview</span>
              <span>${selectedBlendSources.length ? `${selectedBlendSources.length + 1} sources` : "1 source"}</span>
            </div>
            ${renderCompositionRibbon([
              {
                label: "Base",
                composition: material.composition,
                meta: `${formatVolume(material.volumeM3)} · ${formatMass(material.massKg)}`,
                tone: "source",
              },
              ...(selectedBlendSources.length ? [{
                label: "Added",
                composition: buildBlendPreview(selectedBlendSources).composition,
                meta: `${selectedBlendSources.length} extra feeds`,
                tone: "blend" as const,
              }] : []),
              {
                label: bestMatch?.status === "match" || bestMatch?.status === "near" ? bestMatch.family.label : "Custom output",
                composition: blendPreview.composition,
                meta: bestMatch ? `${bestMatch.fitPct.toFixed(0)}% fit` : "Experimental",
                tone: "result",
              },
            ])}
            <div class="ind-process-preview-grid ind-process-preview-grid--blend">
              <div><span>Blend mass</span><strong>${formatMass(blendPreview.massKg)}</strong></div>
              <div><span>Blend volume</span><strong>${formatVolume(blendPreview.volumeM3)}</strong></div>
            </div>
            ${renderCompositionBars(blendPreview.composition)}
            <div class="ind-alloy-match-head ind-alloy-match-head--secondary">
              <span>Best fit</span>
              <span>${bestMatch ? `${bestMatch.fitPct.toFixed(0)}%` : "None"}</span>
            </div>
            <div class="ind-alloy-match-list">
              ${blendPreview.familyMatches.slice(0, 3).map((assessment) => `
                <div class="ind-alloy-match-row">
                  <div class="ind-alloy-match-copy">
                    <strong>${escHtml(assessment.family.label)}</strong>
                    <small>${escHtml(assessment.family.purpose)}</small>
                  </div>
                  <div class="ind-alloy-fit ${assessment.status}">
                    <span>${assessment.status === "match" ? "match" : assessment.status === "near" ? "near" : "off"}</span>
                    <b>${assessment.fitPct.toFixed(0)}%</b>
                  </div>
                </div>
              `).join("")}
            </div>
          </div>
        </div>
        <div class="ind-feed-actions ind-feed-actions--stacked ind-feed-actions--sticky ind-feed-actions--alloy">
          <div class="ind-action-tray">
            <div class="ind-action-tray-copy">
              <span>Run</span>
              <strong>Choose the target and start the blend.</strong>
            </div>
          ${renderRunRoute(["Stock", "Alloy", "Queue"])}
          <div class="ind-alloy-control-grid">
            ${blendOptions.length ? `
              <div class="ind-feed-source-select ind-feed-source-select--alloy">
              <div class="ind-feed-source-title">Add stock</div>
              <div class="ind-feed-source-list">
                ${blendOptions.map((entry) => `
                  <label class="ind-source-check ${selectedSourceIds.has(entry.representativeId) ? "active" : ""}" style="${compositionAccentVars(entry.composition)}">
                    <input type="checkbox" data-alloy-source-for="${material.representativeId}" value="${entry.representativeId}" ${selectedSourceIds.has(entry.representativeId) ? "checked" : ""}>
                    <span>${escHtml(entry.label)} · ${formatVolume(entry.volumeM3)} · ${entry.count} stacks</span>
                  </label>
                `).join("")}
              </div>
              </div>
            ` : ""}
            <div class="ind-alloy-action-stack">
              <div class="ind-alloy-action-row">
                <label class="ind-heat-control">
                  <span>To</span>
                  <select class="ind-storage-select" data-alloy-target="${material.representativeId}">
                    ${(refineryStorageUnits().filter((unit) => unit.kind === "alloy")).map((unit) => `
                      <option value="${unit.id}" ${targetStorageId === unit.id ? "selected" : ""}>${escHtml(unit.label)}</option>
                    `).join("")}
                  </select>
                </label>
                ${renderHeatSelect(material.representativeId)}
              </div>
              <div class="ind-alloy-grid">
                ${fallbackPrimaryMatches.map((assessment) => {
                  const family = assessment.family;
                  return `
                    <button class="ind-alloy-btn ${assessment?.status ?? "off"}" data-action="alloyStock" data-material-id="${material.representativeId}" data-alloy-family-id="${family.id}">
                      <div class="ind-alloy-btn-top">
                        <span>${escHtml(family.label)}</span>
                        <b>${assessment?.fitPct.toFixed(0) ?? "0"}%</b>
                      </div>
                      <small>${escHtml(assessment?.family.purpose ?? family.purpose)}</small>
                      <em>${assessment?.status === "match" ? "good fit" : assessment?.status === "near" ? "close fit" : "weak fit"}</em>
                    </button>
                  `;
                }).join("")}
                <button class="ind-alloy-btn ind-alloy-btn--custom" data-action="alloyStock" data-material-id="${material.representativeId}">
                  <div class="ind-alloy-btn-top">
                    <span>Custom Blend</span>
                    <b>Free mix</b>
                  </div>
                  <small>${blendPreview.discoveryMatch ? `Near ${escHtml(blendPreview.discoveryMatch.label)}` : "Keep the mix as-is."}</small>
                  <em>${blendPreview.discoveryMatch ? escHtml(blendPreview.discoveryMatch.purpose) : "Use this when fits are weak."}</em>
                </button>
              </div>
              ${secondaryMatches.length ? `
                <div class="ind-alloy-more">
                  <button class="ind-alloy-more-toggle" data-action="toggleAlloyMore" data-material-id="${material.representativeId}">
                    ${showMoreFits ? "Hide more" : `More fits (${secondaryMatches.length})`}
                  </button>
                  ${showMoreFits ? `
                    <div class="ind-alloy-grid ind-alloy-grid--secondary">
                      ${secondaryMatches.map((assessment) => {
                        const family = assessment.family;
                        return `
                          <button class="ind-alloy-btn ${assessment.status}" data-action="alloyStock" data-material-id="${material.representativeId}" data-alloy-family-id="${family.id}">
                            <div class="ind-alloy-btn-top">
                              <span>${escHtml(family.label)}</span>
                              <b>${assessment.fitPct.toFixed(0)}%</b>
                            </div>
                            <small>${escHtml(family.purpose)}</small>
                            <em>${assessment.status === "match" ? "good fit" : assessment.status === "near" ? "close fit" : "weak fit"}</em>
                          </button>
                        `;
                      }).join("")}
                    </div>
                  ` : ""}
                </div>
              ` : ""}
            </div>
          </div>
          </div>
        </div>
      </div>
    `;
  }).join("");

  return `
    <section class="ind-stage-panel">
      <div class="ind-panel-head">
        <div class="ind-panel-title">Alloy</div>
        <div class="ind-panel-subtitle">Blend stock into an alloy.</div>
      </div>
      ${renderStageWorkspace("alloy", `
        <div class="ind-stage-dock-head">
          <div>
            <div class="ind-panel-title">Blend</div>
            <div class="ind-panel-subtitle">Build the mix and start it.</div>
          </div>
        </div>
        ${renderDockOperatorStrip(
          "Blend bench",
          candidates.length ? `${candidates.length} stock sources` : "No blend sources",
          candidates.length ? "Select add-on sources inside each material card." : "Process mixed ore before alloying.",
          [
            { label: "Route", value: "Stock -> Alloy" },
            { label: "Codex", value: String(codex.discoveries.length) },
          ],
        )}
        <div class="ind-stage-grid ind-stage-grid--dock">
          ${cards || renderRefineryStockEmpty("No processed stock is waiting for alloying. Process mixed ore first.")}
        </div>
      `)}
    </section>
  `;
}

