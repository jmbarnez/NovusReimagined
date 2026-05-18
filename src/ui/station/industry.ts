import "../styles/station-industry.css";
import { G, Client } from "../../state.js";
import { MACHINES, RECIPES, poolItemLabel, type IndustryPool, createCraftJob, tickCraftJobs, CraftJob } from "../../data/industryRecipes.js";
import { escHtml } from "../../utils/format.js";
import { stationState, iconSvg } from "./shared.js";
import { sfxConfirm, sfxError } from "../../audio/procedural.js";
import { logEvent } from "../hud-overlay.js";

function playerPool(pool: IndustryPool): Record<string, number> {
  if (pool === "ore")       return G.P.ore;
  if (pool === "refined")   return G.P.refined;
  if (pool === "loot")      return G.P.loot;
  if (pool === "component") return G.P.components;
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

export function tickCraftQueue() {
  if (G.P.craftQueue.length === 0) return;

  const completed: CraftJob[] = [];
  G.P.craftQueue = tickCraftJobs(G.P.craftQueue, (job) => {
    completed.push(job);
  });

  for (const job of completed) {
    const recipe = RECIPES.find(r => r.id === job.recipeId);
    if (!recipe) continue;
    const skillMult = recipe.outputSkill ? 1 + (G.P.skills[recipe.outputSkill] || 0) * 0.05 : 1;
    for (const out of recipe.outputs) {
      const totalQty = Math.floor(out.qty * job.qty * skillMult);
      playerPool(out.pool)[out.key] = (playerPool(out.pool)[out.key] || 0) + totalQty;
    }
    const label = recipe.label;
    logEvent(`Crafting complete: ${label} ×${job.qty}`, "loot");
  }

  if (completed.length > 0) {
    const div = document.getElementById("panel-industry");
    if (div && Client.stationOpen) renderIndustry();
  }
}

export function renderIndustry() {
  const div = document.getElementById("panel-industry");
  if (!div) return;

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

  const sortOpts = [["name","Name"],["affordable","Affordable"]].map(
    ([v,l]) => `<option value="${v}"${stationState.indSort===v?" selected":""}>${l}</option>`
  ).join("");

  const sidebarHeader = `
    <div class="ind-sidebar-controls">
      <div class="ind-tab-group">${tabBtns}</div>
      <div class="ind-controls-row">
        <input class="ind-search-input" id="ind-search-input" type="text" placeholder="search…" value="${escHtml(stationState.indSearch)}">
        <select class="ind-sort-sel" id="ind-sort-select">${sortOpts}</select>
      </div>
    </div>
  `;

  const recipeList = filtered.map(r => {
    const isActive = stationState.selectedRecipeId === r.id;
    const needsBP = r.requiresBlueprint && !G.P.blueprints[r.id];
    return `
      <div class="ind-item ${isActive ? 'active' : ''} ${needsBP ? 'locked' : ''}" data-action="selectRecipe" data-recipe="${r.id}">
        <div class="ind-item-icon">${iconSvg(r.outputs[0].key, 12)}</div>
        <div class="ind-item-label">${escHtml(r.label)}</div>
      </div>
    `;
  }).join("") || `<div class="ind-empty-list">No recipes found.</div>`;

  let detailsHtml = `
    <div class="ind-details-empty">
      <div class="ind-empty-icon">⚒</div>
      <div>Select a recipe to begin crafting</div>
    </div>
  `;

  const selected = RECIPES.find(r => r.id === stationState.selectedRecipeId);

  if (selected) {
    const needsBP = selected.requiresBlueprint && !G.P.blueprints[selected.id];
    const affordable = canAffordRecipe(selected.id, stationState.craftQty);
    const skillMult = selected.outputSkill ? 1 + (G.P.skills[selected.outputSkill] || 0) * 0.05 : 1;
    const duration = selected.duration ?? 10;
    const totalTime = duration * stationState.craftQty;
    const machine = MACHINES.find(m => m.id === selected.machine);

    const inputPills = selected.inputs.map(i => ioPill(i.pool, i.key, i.qty * stationState.craftQty, true)).join("");
    const outputPills = selected.outputs.map(o => ioPill(o.pool, o.key, Math.floor(o.qty * skillMult * stationState.craftQty), false)).join("");

    let actionHtml = "";
    if (needsBP) {
      actionHtml = `<button class="ind-btn ind-btn-primary" data-action="buyBP" data-recipe="${selected.id}">Unlock Blueprint (${selected.blueprintCost}¢)</button>`;
    } else {
      const qtyOptions = [1, 5, 10, 25, 50].map(n =>
        `<option value="${n}"${stationState.craftQty===n?" selected":""}>×${n}</option>`
      ).join("");
      actionHtml = `
        <div class="ind-qty-row">
          <select class="ind-qty-sel" id="ind-qty-sel">${qtyOptions}</select>
          <button class="ind-btn ind-btn-primary" ${affordable ? "" : "disabled"} data-action="queueJob" data-recipe="${selected.id}">Queue Job</button>
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
          <div class="ind-section-title">Required Materials</div>
          <div class="ind-pill-list">${inputPills}</div>
        </div>

        <div class="ind-section">
          <div class="ind-section-title">Production Output</div>
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
  const queue = G.P.craftQueue;
  const now = Date.now();

  if (queue.length === 0) {
    return `
      <div class="ind-queue-header">Crafting Queue</div>
      <div class="ind-queue-empty">
        <div class="ind-queue-empty-icon">◷</div>
        <div>No active jobs</div>
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
          <button class="ind-queue-cancel" data-action="cancelJob" data-job-id="${job.id}" title="Cancel job">×</button>
        </div>
        <div class="ind-queue-progress-track">
          <div class="ind-queue-progress-fill" style="width:${pct}%"></div>
        </div>
        <div class="ind-queue-job-footer">
          <span class="ind-queue-pct">${pct}%</span>
          <span class="ind-queue-time">${formatTime(remainingMs / 1000)} remaining</span>
        </div>
      </div>
    `;
  }).join("");

  return `
    <div class="ind-queue-header">
      Crafting Queue
      <span class="ind-queue-count">${queue.length} job${queue.length !== 1 ? "s" : ""}</span>
    </div>
    <div class="ind-queue-list">
      ${jobsHtml}
    </div>
  `;
}
