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

export function renderAssemblyRecipeCard(recipe: Recipe, selectedRecipeId: string | null): string {
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

export function renderHubQueueSection(): string {
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
          const route = job.kind === "processMixed"
            ? "Cargo -> Processed tank"
            : job.kind === "separateStock"
              ? "Processed tank -> Ore bins"
              : job.kind === "alloyStock"
                ? "Processed tank -> Alloy reservoir"
                : job.kind === "debris"
                  ? "Wreck bay -> Salvage store"
                  : "Asteroid ring -> Processed tank";
          const detail = job.kind === "processMixed"
            ? `${Math.max(1, Math.round(job.sourceQty ?? 0))} chunk${Math.round(job.sourceQty ?? 0) === 1 ? "" : "s"}`
            : `${Math.max(1, Math.round(job.mass)).toLocaleString()} kg`;
          return `
            <div class="ind-queue-job ind-queue-job--${job.kind}${isReady ? " ready" : ""}">
              <div class="ind-queue-job-head">
                <div class="ind-queue-job-main">
                  <span class="ind-queue-job-kind">${label}</span>
                  <div class="ind-queue-job-name">${route}</div>
                </div>
                <div class="ind-queue-job-state">
                  <b class="ind-queue-job-status">${isReady ? "Ready" : "Running"}</b>
                  <div class="ind-queue-time">${isReady ? "Stores next tick" : fmtDuration(remaining)}</div>
                </div>
              </div>
              <div class="ind-queue-progress-track"><div class="ind-queue-progress-fill" style="width:${pct}%"></div></div>
              <div class="ind-queue-job-footer">
                <span class="ind-queue-pct">${pct}%</span>
                <span class="ind-queue-job-meta">${detail} · ${Math.max(1, Math.round(job.duration))}s line</span>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

export function renderAssemblyQueueSection(): string {
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
