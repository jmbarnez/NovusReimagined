import { getState } from "../../state-access.js";
import type { Station } from "../../types/world.js";
import { dst } from "../../utils/math.js";
import { curSys } from "../../utils/game.js";
import { sfxBlip } from "../../audio/procedural.js";
import { closeHudWindow, isOpen, openHudWindow } from "../hud/windows.js";
import { hasHubOutput, fmtDuration, getSmeltRecipeForOre, getProcessFee, getSmeltFee, getFloatingDeposits } from "../../hub.js";
import { getRecipe } from "../../data/industryRecipes.js";
import { ORE } from "../../data/resources.js";
import {
  renderIndustry,
  handleIndustryAction,
  handleIndustryFieldEvent,
} from "../station/industry.js";
import { t } from "../../utils/i18n.js";
import { queueFrameAction } from "../../sim/input.js";

let hubRefreshTimer: ReturnType<typeof setInterval> | null = null;
let hubListenersBound = false;
let hubActiveTab: "processing" | "industry" = "processing";
let hubShellReady = false;

function getHubWindowBody(): HTMLElement {
  let body = document.getElementById("hub-window-body");
  if (!body) {
    body = document.createElement("div");
    body.id = "hub-window-body";
    body.style.cssText = "padding:10px;color:var(--hud-text-main);font-size:11px;pointer-events:auto;";
  }
  ensureHubShell(body);
  return body;
}

function ensureHubShell(body: HTMLElement) {
  if (hubShellReady && body.querySelector("#hub-tab-processing")) return;
  body.innerHTML = `
    <div class="hub-panel-shell">
      <div class="hub-tab-bar">
        <button type="button" class="hub-tab-btn active" data-hub-tab="processing">${t("hud.processing")}</button>
        <button type="button" class="hub-tab-btn" data-hub-tab="industry">${t("hud.industry")}</button>
      </div>
      <div id="hub-tab-processing"></div>
      <div id="hub-tab-industry" hidden></div>
    </div>`;
  hubShellReady = true;
}

function applyHubWindowSize() {
  const win = document.getElementById("hud-win-industrial-hub");
  const body = document.getElementById("hub-window-body");
  if (!win || !body) return;
  if (hubActiveTab === "industry") {
    body.style.minWidth = "720px";
    body.style.maxWidth = "860px";
    win.style.width = "740px";
  } else {
    body.style.minWidth = "300px";
    body.style.maxWidth = "380px";
    win.style.width = "";
  }
}

function renderHubWindow(body: HTMLElement) {
  ensureHubShell(body);
  const proc = body.querySelector("#hub-tab-processing") as HTMLElement | null;
  const ind = body.querySelector("#hub-tab-industry") as HTMLElement | null;
  if (!proc || !ind) return;

  body.querySelectorAll(".hub-tab-btn").forEach((btn) => {
    const tab = btn.getAttribute("data-hub-tab");
    btn.classList.toggle("active", tab === hubActiveTab);
  });

  if (hubActiveTab === "processing") {
    proc.hidden = false;
    ind.hidden = true;
    renderHubProcessingContent(proc);
  } else {
    proc.hidden = true;
    ind.hidden = false;
    renderIndustry(ind);
  }
  applyHubWindowSize();
}

function setHubTab(tab: "processing" | "industry") {
  hubActiveTab = tab;
  const body = document.getElementById("hub-window-body");
  if (body) renderHubWindow(body);
}

function stopHubRefresh() {
  if (hubRefreshTimer) {
    clearInterval(hubRefreshTimer);
    hubRefreshTimer = null;
  }
}

function startHubRefresh() {
  stopHubRefresh();
  hubRefreshTimer = setInterval(() => {
    if (!isOpen("industrial-hub")) {
      stopHubRefresh();
      return;
    }
    const body = document.getElementById("hub-window-body");
    if (body) renderHubWindow(body);
  }, 1000);
}

export function closeHubWindow() {
  stopHubRefresh();
  closeHudWindow("industrial-hub");
}

function openHubWindow() {
  hubActiveTab = "processing";
  const div = getHubWindowBody();
  renderHubWindow(div);
  openHudWindow("industrial-hub", t("hud.hubTitle"), div, stopHubRefresh);
  ensureHubWindowListeners();
  startHubRefresh();
}

function ensureHubWindowListeners() {
  if (hubListenersBound) return;
  const host = document.getElementById("hud-win-body-industrial-hub");
  if (!host) return;
  host.addEventListener("click", onHubWindowClick);
  host.addEventListener("input", (e) => { handleIndustryFieldEvent(e.target); });
  host.addEventListener("change", (e) => { handleIndustryFieldEvent(e.target); });
  hubListenersBound = true;
}

function onHubWindowClick(e: Event) {
  if (!isOpen("industrial-hub")) return;
  const body = document.getElementById("hub-window-body");
  if (!body) return;

  const target = e.target as HTMLElement;

  const tabBtn = target.closest(".hub-tab-btn") as HTMLButtonElement | null;
  if (tabBtn) {
    e.preventDefault();
    e.stopPropagation();
    const tab = tabBtn.getAttribute("data-hub-tab");
    if (tab === "processing" || tab === "industry") {
      sfxBlip(680, 0.04);
      setHubTab(tab);
    }
    return;
  }

  const actionBtn = target.closest("[data-action]") as HTMLElement | null;
  if (actionBtn?.dataset.action && handleIndustryAction(actionBtn.dataset.action, actionBtn)) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }

  const proc = body.querySelector("#hub-tab-processing") as HTMLElement | null;
  if (!proc) return;

  const processBtn = target.closest(".hub-process-btn") as HTMLButtonElement | null;
  if (processBtn && !processBtn.disabled) {
    e.preventDefault();
    e.stopPropagation();
    const itemId = processBtn.dataset.itemId;
    if (!itemId) return;
    queueFrameAction({ type: "processHubFloatingItem", payload: { itemId } });
    sfxBlip(680, 0.04);
    return;
  }

  const smeltBtn = target.closest(".hub-smelt-btn") as HTMLButtonElement | null;
  if (smeltBtn && !smeltBtn.disabled) {
    e.preventDefault();
    e.stopPropagation();
    const oreKey = smeltBtn.dataset.ore;
    if (!oreKey) return;
    const qtyInput = proc.querySelector(`.hub-smelt-qty[data-ore="${oreKey}"]`) as HTMLInputElement | null;
    const max = qtyInput ? parseInt(qtyInput.max, 10) || 1 : 1;
    let qty = qtyInput ? parseInt(qtyInput.value, 10) : 1;
    if (!Number.isFinite(qty) || qty < 1) qty = 1;
    if (qty > max) qty = max;
    queueFrameAction({ type: "smeltHubOre", payload: { oreKey, qty } });
    sfxBlip(680, 0.04);
    return;
  }

  const collectBtn = target.closest("#hub-collect-btn");
  if (collectBtn) {
    e.preventDefault();
    e.stopPropagation();
    queueFrameAction({ type: "collectHubOutput" });
    sfxBlip(680, 0.04);
  }
}

function renderHubProcessingContent(container: HTMLElement) {
  const now = Date.now() / 1000;
  const queue = getState().player.hubQueue ?? [];
  const deposit = getState().player.hubDeposit ?? { raw: [], ore: {}, loot: {}, modules: [] };
  const output = getState().player.hubOutput ?? { loot: {}, ore: {}, refined: {}, modules: [] };

  const hub = curSys()?.stations.find((s: Station) => s.isProcessingHub);
  const floating = hub ? getFloatingDeposits(hub, getState().player) : [];

  let html = "";

  // Drop bay — unprocessed raw items
  html += `<div style="margin-bottom:8px;color:#aaa;text-transform:uppercase;letter-spacing:1px;font-size:9px;">${t("hud.dropBay")}</div>`;
  if (floating.length > 0) {
    for (const item of floating) {
      const massTons = Math.round(item.mass / 100) / 10;
      const fee = getProcessFee(item.mass);
      const canAfford = getState().player.credits >= fee;
      html += `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;padding:6px 8px;background:#121820;border:1px solid #2a3848;border-radius:3px;">
          <div>
            <div style="color:#ccddee;">${item.label}</div>
            <div style="font-size:9px;color:#778899;">${item.kind === "asteroid" ? t("hud.asteroid") : t("hud.debris")} · ${massTons}t</div>
          </div>
          <button type="button" class="hub-process-btn" data-item-id="${item.id}" ${canAfford ? "" : "disabled"}
            style="padding:3px 8px;background:${canAfford ? "#1a2840" : "#222"};border:1px solid ${canAfford ? "#4488cc" : "#444"};color:${canAfford ? "#88ccff" : "#666"};cursor:${canAfford ? "pointer" : "default"};border-radius:3px;font-size:10px;">
            ${t("hud.process", { fee })}
          </button>
        </div>`;
    }
  } else {
    html += `<div style="color:#666;font-style:italic;margin-bottom:8px;">${t("hud.dropEmpty")}</div>`;
  }

  // Stockpile — processed materials awaiting smelt/collect
  const hasDepositOre = Object.values(deposit.ore).some(v => v > 0);
  const hasDepositLoot = Object.values(deposit.loot).some(v => v > 0) || deposit.modules.length > 0;

  html += `<div style="margin-top:10px;margin-bottom:8px;color:#aaa;text-transform:uppercase;letter-spacing:1px;font-size:9px;">${t("hud.stockpile")}</div>`;

  if (hasDepositOre || hasDepositLoot) {
    if (hasDepositOre) {
      for (const [k, v] of Object.entries(deposit.ore)) {
        if (v <= 0) continue;
        const recipeId = getSmeltRecipeForOre(k);
        const recipe = recipeId ? getRecipe(recipeId) : null;
        const orePerBatch = recipe?.inputs.find(i => i.pool === "ore" && i.key === k)?.qty ?? 0;
        const maxBatches = orePerBatch > 0 ? Math.floor(v / orePerBatch) : 0;
        const label = ORE[k]?.label ?? k;
        const smeltFee = getSmeltFee(1);
        const canAffordSmelt = getState().player.credits >= smeltFee;
        html += `
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;padding:6px 8px;background:#1a1810;border:1px solid #443820;border-radius:3px;">
            <span>${label}: <b style="color:#ff9933;">${v}</b></span>
            ${recipe && maxBatches > 0 ? `
              <div style="display:flex;align-items:center;gap:4px;">
                <input type="number" class="hub-smelt-qty" data-ore="${k}" min="1" max="${maxBatches}" value="1"
                  style="width:42px;font-size:10px;padding:2px 4px;background:#222;border:1px solid #555;color:#ddd;border-radius:2px;">
                <button type="button" class="hub-smelt-btn" data-ore="${k}" ${canAffordSmelt ? "" : "disabled"}
                  style="padding:3px 8px;background:${canAffordSmelt ? "#3a2a05" : "#222"};border:1px solid ${canAffordSmelt ? "#ff9922" : "#444"};color:${canAffordSmelt ? "#ffcc44" : "#666"};cursor:${canAffordSmelt ? "pointer" : "default"};border-radius:3px;font-size:10px;">
                  ${t("hud.smelt", { fee: smeltFee })}
                </button>
              </div>
            ` : `<span style="color:#666;font-size:9px;">${t("hud.smeltDisabled")}</span>`}
          </div>`;
      }
    }
    if (hasDepositLoot) {
      html += `<div style="padding:6px 8px;background:#101820;border:1px solid #203040;border-radius:3px;margin-bottom:6px;">`;
      for (const [k, v] of Object.entries(deposit.loot)) {
        if (v > 0) html += `<div>${k}: <b style="color:#88ccff;">${v}</b></div>`;
      }
      for (const inst of deposit.modules) {
        html += `<div>Module: <b style="color:#99aaff;">${inst.baseId}</b></div>`;
      }
      html += `</div>`;
    }
  } else {
    html += `<div style="color:#666;font-style:italic;margin-bottom:8px;">${t("hud.processedEmpty")}</div>`;
  }

  // Processing queue
  html += `<div style="margin-top:10px;margin-bottom:8px;color:#aaa;text-transform:uppercase;letter-spacing:1px;font-size:9px;">${t("hud.processingQueue")}</div>`;
  if (queue.length > 0) {
    for (const job of queue) {
      const elapsed = now - job.startTime;
      const pct = Math.min(100, Math.floor((elapsed / job.duration) * 100));
      const remaining = Math.max(0, job.duration - elapsed);
      let label = t("hud.processingLabel");
      if (job.kind === "smelt" && job.smeltRecipeId) {
        label = getRecipe(job.smeltRecipeId)?.label ?? t("hud.smeltFallback");
        if (job.smeltQty && job.smeltQty > 1) label += ` ×${job.smeltQty}`;
      } else if (job.kind === "asteroid") {
        label = t("hud.crushing");
      } else if (job.kind === "debris") {
        label = t("hud.salvaging");
      }
      html += `
        <div style="margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
            <span>${label}</span>
            <span style="color:#888;">${remaining < 1 ? t("hud.readySoon") : fmtDuration(remaining)}</span>
          </div>
          <div style="background:#1a1a1a;border:1px solid #333;height:6px;border-radius:2px;overflow:hidden;">
            <div style="width:${pct}%;height:100%;background:${job.kind === "smelt" ? "#ff8c20" : job.kind === "asteroid" ? "#ff6620" : "#20aaff"};transition:width 0.5s;"></div>
          </div>
        </div>`;
    }
  } else {
    html += `<div style="color:#666;font-style:italic;margin-bottom:8px;">${t("hud.noJobs")}</div>`;
  }

  const hasOutput = hasHubOutput(getState().player);
  if (hasOutput) {
    html += `<div style="margin-top:8px;margin-bottom:6px;color:#aaa;text-transform:uppercase;letter-spacing:1px;font-size:9px;">${t("hud.readyToCollect")}</div>`;
    html += `<div style="background:#1e1a10;border:1px solid #4a3800;padding:6px 8px;border-radius:3px;margin-bottom:8px;">`;
    for (const [k, v] of Object.entries(output.loot)) {
      if (v > 0) html += `<div>${k}: <b style="color:#ffcc44;">${v}</b></div>`;
    }
    for (const [k, v] of Object.entries(deposit.loot)) {
      if (v > 0) html += `<div>${k}: <b style="color:#ffcc44;">${v}</b></div>`;
    }
    for (const [k, v] of Object.entries(output.ore)) {
      if (v > 0) html += `<div>${k} ore: <b style="color:#ff9933;">${v}</b></div>`;
    }
    for (const [k, v] of Object.entries(output.refined ?? {})) {
      if (v > 0) html += `<div>${k}: <b style="color:#ddeeff;">${v}</b></div>`;
    }
    for (const inst of [...output.modules, ...deposit.modules]) {
      html += `<div>Module: <b style="color:#99aaff;">${inst.baseId}</b></div>`;
    }
    html += `</div>`;
    html += `<button type="button" id="hub-collect-btn" style="width:100%;padding:6px;background:#3a2a05;border:1px solid #ff9922;color:#ffcc44;cursor:pointer;border-radius:3px;font-size:11px;">${t("hud.collectAll")}</button>`;
  }

  html += `<div style="margin-top:8px;font-size:9px;color:#556677;text-align:right;">${t("hud.wallet", { credits: getState().player.credits })}</div>`;

  container.innerHTML = html;
}

export function toggleHubWindow() {
  if (isOpen("industrial-hub")) {
    closeHubWindow();
    return;
  }
  openHubWindow();
}

export function updateHubWindowIfOpen() {
  if (!isOpen("industrial-hub")) return;
  const body = document.getElementById("hub-window-body");
  if (body) renderHubWindow(body);
}

export function maybeAutoCloseHubWindow() {
  const sys = curSys();
  if (!isOpen("industrial-hub")) return;
  const hubSt = sys?.stations.find((s: Station) => s.isProcessingHub);
  if (!hubSt || dst(getState().player.x, getState().player.y, hubSt.x, hubSt.y) > (hubSt.collectRadius ?? 220) + 80) {
    closeHubWindow();
  }
}

export function resetHubWindowState() {
  stopHubRefresh();
  hubListenersBound = false;
  hubShellReady = false;
  hubActiveTab = "processing";
}
