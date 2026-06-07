import { getState } from "../../state-access.js";
import { fmtDuration, getAlloyFamilies, getCargoMixedOreInputs, hasHubOutput } from "../../hub.js";
import { MACHINES, RECIPES, poolItemLabel, type Recipe } from "../../data/industryRecipes.js";
import { aggregateStorageComposition, estimateMixedOreCargoMassKg, processMixedSource, separateMaterial } from "../../refining.js";
import { formatCompositionBreakdown } from "../../utils/ore-naming.js";
import { escHtml } from "../../utils/format.js";
import { stationState, iconSvg } from "./shared.js";
import { t } from "../../utils/i18n.js";
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
} from "./industry-model.js";

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

function renderCompactHoldingsSummary(): string {
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

function renderStorageSchematic(activeKind?: "intake" | "processed" | "separated" | "alloy"): string {
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

function renderStageWorkspace(activeKind: "processed" | "separated" | "alloy", controlsHtml: string): string {
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

function renderDockOperatorStrip(
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

function renderRunRoute(labels: string[]): string {
  return `
    <div class="ind-run-route" aria-hidden="true">
      ${labels.map((label, index) => `
        <span>${escHtml(label)}</span>
        ${index < labels.length - 1 ? "<i></i>" : ""}
      `).join("")}
    </div>
  `;
}

export function renderStageTabs(): string {
  return `
    <section class="ind-stage-tabs ind-stage-tabs--compact">
      ${STAGES.map((stage) => `
        <button class="ind-stage-btn${currentStage() === stage.id ? " active" : ""}" data-action="indStage" data-stage="${stage.id}">
          <span>${escHtml(stage.label)}</span>
        </button>
      `).join("")}
    </section>
  `;
}

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

function renderSeparationPreview(material: {
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

export function renderFabricationOverview(): string {
  const cargoMaterials = aggregateCargoMaterials();
  const totalCargoMass = cargoMaterials.reduce((sum, entry) => sum + entry.massKg, 0);
  const componentCount = Object.values(getState().player.components).reduce((sum, qty) => sum + qty, 0);
  const activeJobs = getState().player.craftQueue.length;
  return `
    <section class="ind-hero">
      <div class="ind-hero-copy">
        <div class="ind-overline">Station Fabrication</div>
        <h2 class="ind-hero-title">Fabrication</h2>
        <p class="ind-hero-body">Consume alloy stock and recovered parts to build practical assemblies without dragging refinery internals into the same workflow.</p>
      </div>
      <div class="ind-metric-strip">
        <div class="ind-metric"><span class="ind-metric-label">Alloy families</span><strong>${cargoMaterials.length}</strong></div>
        <div class="ind-metric"><span class="ind-metric-label">Cargo mass</span><strong>${formatMass(totalCargoMass)}</strong></div>
        <div class="ind-metric"><span class="ind-metric-label">Components</span><strong>${componentCount}</strong></div>
        <div class="ind-metric"><span class="ind-metric-label">Active jobs</span><strong>${activeJobs}</strong></div>
      </div>
    </section>
  `;
}

function renderAssemblyRecipeCard(recipe: Recipe, selectedRecipeId: string | null): string {
  const active = recipe.id === selectedRecipeId;
  const locked = recipe.requiresBlueprint && !getState().player.blueprints[recipe.id];
  const affordable = canAffordRecipe(recipe.id, stationState.craftQty);
  return `
    <button class="ind-catalog-card${active ? " active" : ""}${locked ? " locked" : ""}" data-action="selectRecipe" data-recipe="${recipe.id}">
      <div class="ind-catalog-card-head">
        <span class="ind-lane-chip ind-lane-chip--${recipe.machine}">${escHtml(machineLabel(recipe.machine))}</span>
        <span class="ind-catalog-state ${locked ? "locked" : affordable ? "ready" : "waiting"}">${locked ? "Locked" : affordable ? "Ready" : "Missing feed"}</span>
      </div>
      <div class="ind-catalog-title-row">
        <span class="ind-catalog-icon">${iconSvg(recipe.outputs[0]?.key ?? recipe.id, 18)}</span>
        <span class="ind-catalog-title">${escHtml(recipe.label)}</span>
      </div>
      <div class="ind-catalog-output">${escHtml(poolItemLabel(recipe.outputs[0]?.pool ?? "component", recipe.outputs[0]?.key ?? recipe.id))} · ${formatTime(recipe.duration ?? 10)}</div>
    </button>
  `;
}

function renderAssemblyMachineTabs(): string {
  const machineButtons = MACHINES.map((machine) => `
    <button class="ind-tab-btn${stationState.indTab === machine.id ? " active" : ""}" data-action="indTab" data-tab="${machine.id}">
      <span>${escHtml(machine.label)}</span>
      <small>${escHtml(MACHINE_META[machine.id]?.kicker ?? machine.id)}</small>
    </button>
  `).join("");
  return `<div class="ind-tab-group">${machineButtons}</div>`;
}

function renderAssemblySortControls(): string {
  const sortOpts = [["name", t("common.name")], ["affordable", t("market.affordable")]]
    .map(([value, label]) => `<option value="${value}"${stationState.indSort === value ? " selected" : ""}>${label}</option>`)
    .join("");
  return `
    <div class="ind-controls-row">
      <input class="ind-search-input" id="ind-search-input" type="text" placeholder="${escHtml(t("common.search"))}" value="${escHtml(stationState.indSearch)}">
      <select class="ind-sort-sel" id="ind-sort-select">${sortOpts}</select>
    </div>
  `;
}

function renderAssemblyEmptyDetails(): string {
  return `
    <div class="ind-details-empty">
      <div class="ind-empty-icon">▣</div>
      <div>${escHtml(t("industry.selectRecipe"))}</div>
    </div>
  `;
}

function renderAssemblyActionArea(recipe: Recipe, affordable: boolean, totalTime: number): string {
  const needsBlueprint = recipe.requiresBlueprint && !getState().player.blueprints[recipe.id];
  if (needsBlueprint) {
    return `<button class="ind-btn" data-action="buyBP" data-recipe="${recipe.id}">${escHtml(t("industry.unlock", { cost: recipe.blueprintCost ?? 0 }))}</button>`;
  }
  const qtyOptions = [1, 5, 10, 25, 50]
    .map((qty) => `<option value="${qty}"${stationState.craftQty === qty ? " selected" : ""}>×${qty}</option>`)
    .join("");
  return `
    <div class="ind-action-row">
      <label class="ind-qty-wrap">
        <span>Batch</span>
        <select class="ind-qty-sel" id="ind-qty-sel">${qtyOptions}</select>
      </label>
      <button class="ind-btn" ${affordable ? "" : "disabled"} data-action="queueJob" data-recipe="${recipe.id}">${escHtml(t("industry.queueJob"))}</button>
    </div>
    <div class="ind-action-foot">${stationState.craftQty > 1 ? `${stationState.craftQty}× ` : ""}${formatTime(totalTime)} total</div>
  `;
}

function renderAssemblyRecipeDetails(recipe: Recipe | null): string {
  if (!recipe) return renderAssemblyEmptyDetails();
  const affordable = canAffordRecipe(recipe.id, stationState.craftQty);
  const skillMult = recipe.outputSkill ? 1 + (getState().player.skills[recipe.outputSkill] || 0) * 0.05 : 1;
  const duration = recipe.duration ?? 10;
  const totalTime = duration * stationState.craftQty;
  const inputs = recipe.inputs.map((input) => ioPill(input.pool, input.key, input.qty * stationState.craftQty, true)).join("");
  const outputs = recipe.outputs.map((output) => ioPill(output.pool, output.key, Math.floor(output.qty * skillMult * stationState.craftQty), false)).join("");
  return `
    <section class="ind-focus-card">
      <div class="ind-focus-head">
        <div>
          <div class="ind-overline">${escHtml(MACHINE_META[recipe.machine]?.kicker ?? recipe.machine)}</div>
          <h3 class="ind-focus-title">${escHtml(recipe.label)}</h3>
        </div>
        <div class="ind-focus-meta">
          <span class="ind-lane-chip ind-lane-chip--${recipe.machine}">${escHtml(machineLabel(recipe.machine))}</span>
          <span>${formatTime(duration)}</span>
        </div>
      </div>
      <p class="ind-focus-body">${escHtml(RECIPE_NOTES[recipe.id] ?? MACHINE_META[recipe.machine]?.body ?? "")}</p>
      <div class="ind-focus-grid">
        <section class="ind-section-panel">
          <div class="ind-section-title">Required feed</div>
          <div class="ind-pill-list">${inputs}</div>
        </section>
        <section class="ind-section-panel">
          <div class="ind-section-title">Output line</div>
          <div class="ind-pill-list">${outputs}</div>
          ${recipe.outputSkill ? `<div class="ind-skill-bonus">+${((skillMult - 1) * 100).toFixed(0)}% output from ${recipe.outputSkill} skill</div>` : ""}
        </section>
      </div>
      <div class="ind-actions-group">${renderAssemblyActionArea(recipe, affordable, totalTime)}</div>
    </section>
  `;
}

function renderAssemblyCatalog(filtered: Recipe[]): string {
  return `
    <aside class="ind-catalog">
      <div class="ind-panel-head">
        <div class="ind-panel-title">Line Catalog</div>
        <div class="ind-panel-subtitle">${filtered.length} entries</div>
      </div>
      <div class="ind-catalog-list">
        ${filtered.map((recipe) => renderAssemblyRecipeCard(recipe, stationState.selectedRecipeId)).join("") || `<div class="ind-empty-list">${escHtml(t("industry.noRecipes"))}</div>`}
      </div>
    </aside>
  `;
}

export function renderAssemblyStage(): string {
  const filtered = filteredAssemblyRecipes();
  const selectedRecipe = stationState.selectedRecipeId
    ? (filtered.find((recipe) => recipe.id === stationState.selectedRecipeId) ?? null)
    : null;

  return `
    <section class="ind-stage-panel">
      <div class="ind-panel-head">
        <div class="ind-panel-title">Fabrication Lanes</div>
        <div class="ind-panel-subtitle">Build finished assemblies from alloy stock, salvage, and recovered components.</div>
      </div>
      <div class="ind-toolbar ind-toolbar--nested">
        ${renderAssemblyMachineTabs()}
        ${renderAssemblySortControls()}
      </div>
      <div class="ind-workspace ind-workspace--assembly">
        ${renderAssemblyCatalog(filtered)}
        <main class="ind-focus">${renderAssemblyRecipeDetails(selectedRecipe)}</main>
      </div>
    </section>
  `;
}

function renderHubQueueSection(): string {
  const queue = getState().player.hubQueue ?? [];
  if (!queue.length) {
    return `
      <section class="ind-queue-section">
        <div class="ind-queue-section-title">Queue</div>
        <div class="ind-queue-empty">No refinery jobs running.</div>
      </section>
    `;
  }
  const now = Date.now() / 1000;
  return `
    <section class="ind-queue-section">
      <div class="ind-queue-section-title">Queue</div>
      <div class="ind-queue-list">
        ${queue.map((job) => {
          const elapsed = now - job.startTime;
          const pct = Math.min(100, Math.floor((elapsed / job.duration) * 100));
          const remaining = Math.max(0, job.duration - elapsed);
          const isReady = remaining < 1;
          const label = job.kind === "processMixed"
            ? "Process"
            : job.kind === "separateStock"
              ? "Separate"
              : job.kind === "alloyStock"
                ? "Alloy"
                : job.kind === "debris"
                  ? "Salvage"
                  : "Asteroid";
          return `
            <div class="ind-queue-job ind-queue-job--${job.kind}${isReady ? " ready" : ""}">
              <div class="ind-queue-job-head">
                <div class="ind-queue-job-main">
                  <span class="ind-queue-job-kind">${label}</span>
                  <div class="ind-queue-job-name">${job.kind === "processMixed" ? "Ore to stock" : job.kind === "separateStock" ? "Split stock" : job.kind === "alloyStock" ? "Blend stock" : job.kind === "debris" ? "Recover salvage" : "Process asteroid"}</div>
                </div>
                <div class="ind-queue-job-state">
                  <b class="ind-queue-job-status">${isReady ? "Ready" : "Running"}</b>
                  <div class="ind-queue-time">${isReady ? "Stores next tick" : fmtDuration(remaining)}</div>
                </div>
              </div>
              <div class="ind-queue-progress-track"><div class="ind-queue-progress-fill" style="width:${pct}%"></div></div>
              <div class="ind-queue-job-footer">
                <span class="ind-queue-pct">${pct}%</span>
                <span class="ind-queue-job-meta">${Math.max(1, Math.round(job.duration))}s line</span>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderAssemblyQueueSection(): string {
  const queue = getState().player.craftQueue;
  if (!queue.length) {
    return `
      <section class="ind-queue-section">
        <div class="ind-queue-section-title">${escHtml(t("industry.queue"))}</div>
        <div class="ind-queue-empty">${escHtml(t("industry.noJobs"))}</div>
      </section>
    `;
  }
  const now = Date.now();
  return `
    <section class="ind-queue-section">
      <div class="ind-queue-section-title">${escHtml(t("industry.queue"))}</div>
      <div class="ind-queue-list">
        ${queue.map((job) => {
          const recipe = RECIPES.find((entry) => entry.id === job.recipeId);
          if (!recipe) return "";
          const elapsed = now - job.startTime;
          const pct = Math.min(100, Math.floor((elapsed / job.duration) * 100));
          const remainingMs = Math.max(0, job.duration - elapsed);
          return `
            <div class="ind-queue-job" data-job-id="${job.id}">
              <div class="ind-queue-job-head">
                <div class="ind-queue-job-name">${escHtml(recipe.label)}${job.qty > 1 ? ` ×${job.qty}` : ""}</div>
                <button class="ind-queue-cancel" data-action="cancelJob" data-job-id="${job.id}" title="${escHtml(t("industry.cancelJob"))}">×</button>
              </div>
              <div class="ind-queue-progress-track"><div class="ind-queue-progress-fill" style="width:${pct}%"></div></div>
              <div class="ind-queue-job-footer">
                <span class="ind-queue-pct">${pct}%</span>
                <span class="ind-queue-time">${formatTime(remainingMs / 1000)} ${escHtml(t("industry.remaining"))}</span>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderTransferSection(): string {
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

function renderMaterialHoldSection(): string {
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

function renderRightRailTabs(): string {
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

function renderMaterialDossierSection(): string {
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

export function renderFabricationRail(): string {
  return `
    <aside class="ind-queue-panel">
      ${renderHubQueueSection()}
      ${renderAssemblyQueueSection()}
    </aside>
  `;
}
