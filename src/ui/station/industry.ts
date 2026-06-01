import "../styles/station-industry.css";
import { getState } from "../../state-access.js";
import { MACHINES, RECIPES, poolItemLabel, type IndustryPool } from "../../data/industryRecipes.js";
import { escHtml } from "../../utils/format.js";
import { stationState, iconSvg } from "./shared.js";
import { sfxBlip, sfxConfirm, sfxError } from "../../audio/procedural.js";
import { queueFrameAction } from "../../sim/input.js";
import { t } from "../../utils/i18n.js";

let lastContainer: HTMLElement | null = null;

function resolveIndustryContainer(container?: HTMLElement): HTMLElement | null {
  if (container) return container;
  const stationPanel = document.getElementById("panel-industry");
  if (stationPanel?.classList.contains("active")) return stationPanel;
  if (lastContainer?.isConnected) return lastContainer;
  return stationPanel;
}

function playerPool(pool: IndustryPool): Record<string, number> {
  if (pool === "ore")       return getState().player.ore;
  if (pool === "refined")   return getState().player.refined;
  if (pool === "loot")      return getState().player.loot;
  if (pool === "component") return getState().player.components;
  return {};
}

function stockOf(pool: IndustryPool, key: string): number {
  return playerPool(pool)[key] || 0;
}

function ioPill(pool: IndustryPool, key: string, qty: number, showStock: boolean): string {
  const label = escHtml(poolItemLabel(pool, key));
  const stock = stockOf(pool, key);
  const icon = iconSvg(key, 14);
  const insufficient = showStock && stock < qty;
  const stockText = showStock ? ` <em>(${stock})</em>` : "";
  return `<span class="io-pill io-pill--${pool} ${insufficient ? 'insufficient' : ''}">${icon}${qty}× ${label}${stockText}</span>`;
}

function canAffordRecipe(recipeId: string, qty: number): boolean {
  const recipe = RECIPES.find(r => r.id === recipeId);
  if (!recipe) return false;
  return recipe.inputs.every(inp => stockOf(inp.pool, inp.key) >= inp.qty * qty);
}

function formatTime(seconds: number): string {
  if (seconds < 1) return "<1s";
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  return `${m}m ${s}s`;
}

export function updateIndustryProgress() {
  if (lastContainer?.isConnected) renderIndustry(lastContainer);
}

export function renderIndustry(container?: HTMLElement) {
  const div = resolveIndustryContainer(container);
  if (!div) return;
  lastContainer = div;

  const q = stationState.indSearch.trim().toLowerCase();
  let filtered = RECIPES.filter(r => r.machine === stationState.indTab);
  if (q) filtered = filtered.filter(r => r.label.toLowerCase().includes(q));

  if (stationState.indSort === "affordable") {
    filtered = [...filtered].sort((a, b) => {
      const ca = canAffordRecipe(a.id, stationState.craftQty) ? 0 : 1;
      const cb = canAffordRecipe(b.id, stationState.craftQty) ? 0 : 1;
      return ca - cb || a.label.localeCompare(b.label);
    });
  } else {
    filtered = [...filtered].sort((a, b) => a.label.localeCompare(b.label));
  }

  const tabBtns = MACHINES.map(m =>
    `<button class="ind-tab-btn${stationState.indTab===m.id?" active":""}" data-action="indTab" data-tab="${m.id}">${escHtml(m.label)}</button>`
  ).join("");

  const sortOpts = [["name", t("common.name")],["affordable", t("market.affordable")]].map(
    ([v,l]) => `<option value="${v}"${stationState.indSort===v?" selected":""}>${l}</option>`
  ).join("");

  const sidebarHeader = `
    <div class="ind-sidebar-controls">
      <div class="ind-tab-group">${tabBtns}</div>
      <div class="ind-controls-row">
        <input class="ind-search-input" id="ind-search-input" type="text" placeholder="${escHtml(t("common.search"))}" value="${escHtml(stationState.indSearch)}">
        <select class="ind-sort-sel" id="ind-sort-select">${sortOpts}</select>
      </div>
    </div>
  `;

  const recipeList = filtered.map(r => {
    const isActive = stationState.selectedRecipeId === r.id;
    const needsBP = r.requiresBlueprint && !getState().player.blueprints[r.id];
    return `
      <div class="ind-item ${isActive ? 'active' : ''} ${needsBP ? 'locked' : ''}" data-action="selectRecipe" data-recipe="${r.id}">
        <div class="ind-item-icon">${iconSvg(r.outputs[0].key, 12)}</div>
        <div class="ind-item-label">${escHtml(r.label)}</div>
      </div>
    `;
  }).join("") || `<div class="ind-empty-list">${escHtml(t("industry.noRecipes"))}</div>`;

  let detailsHtml = `
      <div class="ind-details-empty">
        <div class="ind-empty-icon">⚒</div>
        <div>${escHtml(t("industry.selectRecipe"))}</div>
      </div>
  `;

  const selected = RECIPES.find(r => r.id === stationState.selectedRecipeId);

  if (selected) {
    const needsBP = selected.requiresBlueprint && !getState().player.blueprints[selected.id];
    const affordable = canAffordRecipe(selected.id, stationState.craftQty);
    const skillMult = selected.outputSkill ? 1 + (getState().player.skills[selected.outputSkill] || 0) * 0.05 : 1;
    const duration = selected.duration ?? 10;
    const totalTime = duration * stationState.craftQty;
    const machine = MACHINES.find(m => m.id === selected.machine);

    const inputPills = selected.inputs.map(i => ioPill(i.pool, i.key, i.qty * stationState.craftQty, true)).join("");
    const outputPills = selected.outputs.map(o => ioPill(o.pool, o.key, Math.floor(o.qty * skillMult * stationState.craftQty), false)).join("");

    let actionHtml = "";
    if (needsBP) {
      actionHtml = `<button class="ind-btn ind-btn-primary" data-action="buyBP" data-recipe="${selected.id}">${escHtml(t("industry.unlock", { cost: selected.blueprintCost ?? 0 }))}</button>`;
    } else {
      const qtyOptions = [1, 5, 10, 25, 50].map(n =>
        `<option value="${n}"${stationState.craftQty===n?" selected":""}>×${n}</option>`
      ).join("");
      actionHtml = `
        <div class="ind-qty-row">
          <select class="ind-qty-sel" id="ind-qty-sel">${qtyOptions}</select>
          <button class="ind-btn ind-btn-primary" ${affordable ? "" : "disabled"} data-action="queueJob" data-recipe="${selected.id}">${escHtml(t("industry.queueJob"))}</button>
        </div>
        <div class="ind-time-estimate">${stationState.craftQty > 1 ? `${stationState.craftQty}× ` : ""}${formatTime(totalTime)} total</div>
      `;
    }

    detailsHtml = `
      <div class="ind-details-card">
        <div class="ind-details-header">
          <div class="ind-details-title">${escHtml(selected.label)}</div>
          <div class="ind-details-subtitle">${escHtml(machine?.label || selected.machine)} · ${duration}s per unit</div>
        </div>

        <div class="ind-section">
          <div class="ind-section-title">${escHtml(t("industry.required"))}</div>
          <div class="ind-pill-list">${inputPills}</div>
        </div>

        <div class="ind-section">
          <div class="ind-section-title">${escHtml(t("industry.output"))}</div>
          <div class="ind-pill-list">${outputPills}</div>
          ${selected.outputSkill ? `<div class="ind-skill-bonus">+${((skillMult-1)*100).toFixed(0)}% from ${selected.outputSkill} skill</div>` : ""}
        </div>

        <div class="ind-actions-group">
          ${actionHtml}
        </div>
      </div>
    `;
  }

  const queueHtml = renderQueuePanel();

  div.innerHTML = `
    <div class="ind-container">
      <div class="ind-sidebar">
        ${sidebarHeader}
        <div class="ind-list-scroll">
          ${recipeList}
        </div>
      </div>
      <div class="ind-main">
        ${detailsHtml}
      </div>
      <div class="ind-queue-panel">
        ${queueHtml}
      </div>
    </div>
  `;
}

function renderQueuePanel(): string {
  const queue = getState().player.craftQueue;
  const now = Date.now();

  if (queue.length === 0) {
    return `
      <div class="ind-queue-header">${escHtml(t("industry.queue"))}</div>
      <div class="ind-queue-empty">
        <div class="ind-queue-empty-icon">◷</div>
        <div>${escHtml(t("industry.noJobs"))}</div>
      </div>
    `;
  }

  const jobsHtml = queue.map(job => {
    const recipe = RECIPES.find(r => r.id === job.recipeId);
    if (!recipe) return "";
    const elapsed = now - job.startTime;
    const progress = Math.min(1, elapsed / job.duration);
    const remainingMs = Math.max(0, job.duration - elapsed);
    const pct = Math.round(progress * 100);

    return `
      <div class="ind-queue-job" data-job-id="${job.id}">
        <div class="ind-queue-job-header">
          <div class="ind-queue-job-icon">${iconSvg(recipe.outputs[0].key, 10)}</div>
          <div class="ind-queue-job-name">${escHtml(recipe.label)}${job.qty > 1 ? ` ×${job.qty}` : ""}</div>
          <button class="ind-queue-cancel" data-action="cancelJob" data-job-id="${job.id}" title="${escHtml(t("industry.cancelJob"))}">×</button>
        </div>
        <div class="ind-queue-progress-track">
          <div class="ind-queue-progress-fill" style="width:${pct}%"></div>
        </div>
        <div class="ind-queue-job-footer">
          <span class="ind-queue-pct">${pct}%</span>
          <span class="ind-queue-time">${formatTime(remainingMs / 1000)} ${escHtml(t("industry.remaining"))}</span>
        </div>
      </div>
    `;
  }).join("");

  return `
    <div class="ind-queue-header">
      ${escHtml(t("industry.queue"))}
      <span class="ind-queue-count">${queue.length} ${escHtml(t(queue.length === 1 ? "industry.job" : "industry.jobs"))}</span>
    </div>
    <div class="ind-queue-list">
      ${jobsHtml}
    </div>
  `;
}

export function handleIndustryAction(action: string, btn: HTMLElement): boolean {
  if (action === "indTab") {
    const tab = btn.dataset.tab || "refinery";
    stationState.indTab = tab;
    sfxBlip(640, 0.04);
    renderIndustry();
    return true;
  }
  if (action === "selectRecipe") {
    const recipe = btn.dataset.recipe || "";
    stationState.selectedRecipeId = recipe;
    sfxBlip(640, 0.04);
    renderIndustry();
    return true;
  }
  if (action === "buyBP") {
    const recipeId = btn.dataset.recipe || "";
    const r = RECIPES.find(recipe => recipe.id === recipeId);
    const cost = r?.blueprintCost ?? 0;
    if (!r || getState().player.credits < cost) {
      sfxError();
      return true;
    }
    queueFrameAction({ type: "buyBlueprint", payload: { recipeId } });
    sfxConfirm();
    return true;
  }
  if (action === "queueJob") {
    const recipeId = btn.dataset.recipe || "";
    if (!canAffordRecipe(recipeId, stationState.craftQty)) {
      sfxError();
      return true;
    }
    queueFrameAction({ type: "queueIndustryJob", payload: { recipeId, qty: stationState.craftQty } });
    sfxConfirm();
    return true;
  }
  if (action === "cancelJob") {
    const jobId = btn.dataset.jobId || "";
    queueFrameAction({ type: "cancelIndustryJob", payload: { jobId } });
    sfxBlip();
    return true;
  }
  return false;
}

export function handleIndustryFieldEvent(target: EventTarget | null): boolean {
  if (!target) return false;
  const el = target as HTMLElement;
  if (el.id === "ind-search-input") {
    stationState.indSearch = (el as HTMLInputElement).value;
    renderIndustry();
    return true;
  }
  if (el.id === "ind-sort-select") {
    stationState.indSort = (el as HTMLSelectElement).value;
    renderIndustry();
    return true;
  }
  if (el.id === "ind-qty-sel") {
    stationState.craftQty = parseInt((el as HTMLSelectElement).value, 10) || 1;
    renderIndustry();
    return true;
  }
  return false;
}
