import { getState } from "../../state-access.js";
import type { Station } from "../../types/world.js";
import { dst } from "../../utils/math.js";
import { curSys } from "../../utils/game.js";
import { sfxBlip } from "../../audio/procedural.js";
import { closeHudWindow, isOpen, openHudWindow } from "../hud/windows.js";
import {
  alloyHubMaterial,
  collectHubOutput,
  fmtDuration,
  getAlloyFamilies,
  getCargoMixedOreInputs,
  getFloatingDeposits,
  getProcessFee,
  hasHubOutput,
} from "../../hub.js";
import {
  renderIndustry,
  handleIndustryAction,
  handleIndustryFieldEvent,
} from "../station/industry.js";
import { t } from "../../utils/i18n.js";
import { queueFrameAction } from "../../sim/input.js";
import { formatCompositionBreakdown } from "../../utils/ore-naming.js";

let hubRefreshTimer: ReturnType<typeof setInterval> | null = null;
let hubListenersBound = false;
let hubActiveTab: "processing" | "industry" = "processing";
let hubShellReady = false;

const HEAT_OPTIONS = [
  { id: "cool", label: "Cool" },
  { id: "stable", label: "Stable" },
  { id: "hot", label: "Hot" },
] as const;

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
    body.style.minWidth = "420px";
    body.style.maxWidth = "560px";
    win.style.width = "520px";
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

function selectedHeatMode(root: ParentNode, seed: string): "cool" | "stable" | "hot" {
  const select = root.querySelector(`[data-heat-for="${seed}"]`) as HTMLSelectElement | null;
  const value = select?.value;
  return value === "cool" || value === "hot" ? value : "stable";
}

function onHubWindowClick(e: Event) {
  if (!isOpen("industrial-hub")) return;
  const body = document.getElementById("hub-window-body");
  if (!body) return;

  const target = e.target as HTMLElement;
  const tabBtn = target.closest(".hub-tab-btn") as HTMLButtonElement | null;
  if (tabBtn) {
    e.preventDefault();
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
    return;
  }

  const processBtn = target.closest(".hub-process-btn") as HTMLButtonElement | null;
  if (processBtn && !processBtn.disabled) {
    e.preventDefault();
    const itemId = processBtn.dataset.itemId;
    if (!itemId) return;
    queueFrameAction({ type: "processHubFloatingItem", payload: { itemId } });
    sfxBlip(680, 0.04);
    return;
  }

  const cargoBtn = target.closest(".hub-cargo-process-btn") as HTMLButtonElement | null;
  if (cargoBtn && !cargoBtn.disabled) {
    e.preventDefault();
    const cargoIndex = parseInt(cargoBtn.dataset.cargoIndex ?? "", 10);
    const qtyInput = body.querySelector(`.hub-cargo-qty[data-cargo-index="${cargoIndex}"]`) as HTMLInputElement | null;
    let qty = qtyInput ? parseInt(qtyInput.value, 10) : 1;
    if (!Number.isFinite(qty) || qty < 1) qty = 1;
    queueFrameAction({
      type: "processHubMixedOre",
      payload: {
        cargoIndex,
        qty,
        heatMode: selectedHeatMode(body, `cargo-${cargoIndex}`),
      },
    });
    sfxBlip(680, 0.04);
    return;
  }

  const separateBtn = target.closest(".hub-separate-btn") as HTMLButtonElement | null;
  if (separateBtn && !separateBtn.disabled) {
    e.preventDefault();
    const materialId = separateBtn.dataset.materialId;
    if (!materialId) return;
    queueFrameAction({
      type: "separateHubMaterial",
      payload: { materialId, heatMode: selectedHeatMode(body, materialId) },
    });
    sfxBlip(680, 0.04);
    return;
  }

  const alloyBtn = target.closest(".hub-alloy-btn") as HTMLButtonElement | null;
  if (alloyBtn && !alloyBtn.disabled) {
    e.preventDefault();
    const materialId = alloyBtn.dataset.materialId;
    const targetAlloyFamilyId = alloyBtn.dataset.alloyFamilyId || undefined;
    if (!materialId) return;
    queueFrameAction({
      type: "alloyHubMaterial",
      payload: {
        materialId,
        targetAlloyFamilyId,
        heatMode: selectedHeatMode(body, materialId),
      },
    });
    sfxBlip(680, 0.04);
    return;
  }

  const collectBtn = target.closest("#hub-collect-btn");
  if (collectBtn) {
    e.preventDefault();
    queueFrameAction({ type: "collectHubOutput" });
    sfxBlip(680, 0.04);
  }
}

function renderHeatSelect(seed: string): string {
  return `
    <select data-heat-for="${seed}" style="font-size:10px;padding:2px 4px;background:#111a24;border:1px solid #334455;color:#d6e2ef;border-radius:2px;">
      ${HEAT_OPTIONS.map((option) => `<option value="${option.id}" ${option.id === "stable" ? "selected" : ""}>${option.label}</option>`).join("")}
    </select>
  `;
}

function renderHubProcessingContent(container: HTMLElement) {
  const now = Date.now() / 1000;
  const player = getState().player;
  const queue = player.hubQueue ?? [];
  const deposit = player.hubDeposit ?? { raw: [], ore: {}, materials: [], loot: {}, modules: [] };
  const output = player.hubOutput ?? { loot: {}, ore: {}, materials: [], modules: [] };
  const hub = curSys()?.stations.find((s: Station) => s.isProcessingHub);
  const floating = hub ? getFloatingDeposits(hub, player) : [];
  const cargoMixed = getCargoMixedOreInputs(player);
  const alloys = getAlloyFamilies();

  let html = "";

  html += `<div style="margin-bottom:8px;color:#9aa7b6;text-transform:uppercase;letter-spacing:1px;font-size:9px;">Bay Intake</div>`;
  if (floating.length > 0) {
    for (const item of floating) {
      const massTons = Math.round(item.mass / 100) / 10;
      const fee = getProcessFee(item.mass);
      const canAfford = player.credits >= fee;
      html += `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;padding:8px;background:#121820;border:1px solid #2a3848;border-radius:4px;">
          <div>
            <div style="color:#d8e8f8;">${item.label}</div>
            <div style="font-size:9px;color:#7f91a5;">${item.kind} · ${massTons}t${item.richness ? ` · richness ${(item.richness ?? 1).toFixed(1)}` : ""}</div>
          </div>
          <button type="button" class="hub-process-btn" data-item-id="${item.id}" ${canAfford ? "" : "disabled"}
            style="padding:4px 8px;background:${canAfford ? "#1a2840" : "#222"};border:1px solid ${canAfford ? "#4488cc" : "#444"};color:${canAfford ? "#88ccff" : "#666"};cursor:${canAfford ? "pointer" : "default"};border-radius:3px;font-size:10px;">
            Process (${fee}¢)
          </button>
        </div>`;
    }
  } else {
    html += `<div style="color:#667788;font-style:italic;margin-bottom:8px;">${t("hud.dropEmpty")}</div>`;
  }

  html += `<div style="margin-top:12px;margin-bottom:8px;color:#9aa7b6;text-transform:uppercase;letter-spacing:1px;font-size:9px;">Cargo Feedstock</div>`;
  if (cargoMixed.length > 0) {
    for (const slot of cargoMixed) {
      const fee = getProcessFee(slot.massKg / 100);
      const canAfford = player.credits >= fee;
      html += `
        <div style="margin-bottom:8px;padding:8px;background:#10171f;border:1px solid #233342;border-radius:4px;">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">
            <div>
              <div style="color:#d8e8f8;">${slot.label}</div>
              <div style="font-size:9px;color:#7f91a5;">${formatCompositionBreakdown(slot.composition)}</div>
              <div style="font-size:9px;color:#5f7387;">${slot.qty} chunks · ${slot.massKg.toFixed(0)} kg · richness ${slot.richness.toFixed(1)}</div>
            </div>
            <div style="display:flex;align-items:center;gap:4px;">
              <input type="number" class="hub-cargo-qty" data-cargo-index="${slot.index}" min="1" max="${slot.qty}" value="${Math.min(1, slot.qty)}"
                style="width:48px;font-size:10px;padding:2px 4px;background:#222;border:1px solid #555;color:#ddd;border-radius:2px;">
              ${renderHeatSelect(`cargo-${slot.index}`)}
              <button type="button" class="hub-cargo-process-btn" data-cargo-index="${slot.index}" ${canAfford ? "" : "disabled"}
                style="padding:4px 8px;background:${canAfford ? "#1f2b12" : "#222"};border:1px solid ${canAfford ? "#7ebc4a" : "#444"};color:${canAfford ? "#bde287" : "#666"};border-radius:3px;font-size:10px;">
                Refine (${fee}¢)
              </button>
            </div>
          </div>
        </div>`;
    }
  } else {
    html += `<div style="color:#667788;font-style:italic;margin-bottom:8px;">No mixed ore in cargo.</div>`;
  }

  html += `<div style="margin-top:12px;margin-bottom:8px;color:#9aa7b6;text-transform:uppercase;letter-spacing:1px;font-size:9px;">Stockpile</div>`;
  if ((deposit.materials?.length ?? 0) > 0) {
    for (const material of deposit.materials) {
      html += `
        <div style="margin-bottom:8px;padding:8px;background:#17140f;border:1px solid #3a2c18;border-radius:4px;">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">
            <div>
              <div style="color:#f2e7d8;">${material.label}</div>
              <div style="font-size:9px;color:#c2a77e;">${formatCompositionBreakdown(material.composition)}</div>
              <div style="font-size:9px;color:#8f7d65;">${material.volumeM3.toFixed(2)} m³ · ${Math.round(material.massKg).toLocaleString()} kg · ${material.kind}</div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:4px;justify-content:flex-end;max-width:240px;">
              ${renderHeatSelect(material.id)}
              <button type="button" class="hub-separate-btn" data-material-id="${material.id}"
                style="padding:3px 7px;background:#1a2530;border:1px solid #446c99;color:#97c6ff;border-radius:3px;font-size:10px;">
                Separate
              </button>
              ${alloys.map((family) => `
                <button type="button" class="hub-alloy-btn" data-material-id="${material.id}" data-alloy-family-id="${family.id}"
                  style="padding:3px 7px;background:#2a1d10;border:1px solid #b8863b;color:#f0cb83;border-radius:3px;font-size:10px;">
                  ${family.label}
                </button>`).join("")}
              <button type="button" class="hub-alloy-btn" data-material-id="${material.id}"
                style="padding:3px 7px;background:#25182c;border:1px solid #8c64a8;color:#d6b1ef;border-radius:3px;font-size:10px;">
                Custom Blend
              </button>
            </div>
          </div>
        </div>`;
    }
  } else if (Object.values(deposit.loot ?? {}).some((value) => value > 0) || deposit.modules.length > 0) {
    html += `<div style="padding:8px;background:#101820;border:1px solid #203040;border-radius:4px;margin-bottom:8px;">`;
    for (const [key, value] of Object.entries(deposit.loot)) {
      if (value > 0) html += `<div>${key}: <b style="color:#88ccff;">${value}</b></div>`;
    }
    for (const inst of deposit.modules) {
      html += `<div>Module: <b style="color:#99aaff;">${inst.baseId}</b></div>`;
    }
    html += `</div>`;
  } else {
    html += `<div style="color:#667788;font-style:italic;margin-bottom:8px;">No processed stock ready.</div>`;
  }

  html += `<div style="margin-top:12px;margin-bottom:8px;color:#9aa7b6;text-transform:uppercase;letter-spacing:1px;font-size:9px;">Queue</div>`;
  if (queue.length > 0) {
    for (const job of queue) {
      const elapsed = now - job.startTime;
      const pct = Math.min(100, Math.floor((elapsed / job.duration) * 100));
      const remaining = Math.max(0, job.duration - elapsed);
      const label = job.kind === "debris"
        ? "Salvaging"
        : job.kind === "asteroid"
          ? "Crushing"
          : job.kind === "processMixed"
            ? "Feedstock Processing"
            : job.kind === "separateStock"
              ? "Separation"
              : "Alloying";
      const color = job.kind === "alloyStock" ? "#ffad55" : job.kind === "separateStock" ? "#78b7ff" : "#6dd6a7";
      html += `
        <div style="margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
            <span>${label}</span>
            <span style="color:#888;">${remaining < 1 ? "Ready" : fmtDuration(remaining)}</span>
          </div>
          <div style="background:#1a1a1a;border:1px solid #333;height:6px;border-radius:2px;overflow:hidden;">
            <div style="width:${pct}%;height:100%;background:${color};transition:width 0.5s;"></div>
          </div>
        </div>`;
    }
  } else {
    html += `<div style="color:#667788;font-style:italic;margin-bottom:8px;">No active refinery jobs.</div>`;
  }

  if (hasHubOutput(player)) {
    html += `<div style="margin-top:8px;margin-bottom:6px;color:#9aa7b6;text-transform:uppercase;letter-spacing:1px;font-size:9px;">Ready To Transfer</div>`;
    html += `<div style="background:#1e1a10;border:1px solid #4a3800;padding:8px;border-radius:4px;margin-bottom:8px;">`;
    for (const material of [...(deposit.materials ?? []), ...(output.materials ?? [])]) {
      html += `<div>${material.label}: <b style="color:#ffcc88;">${material.volumeM3.toFixed(2)} m³</b></div>`;
    }
    for (const [key, value] of Object.entries(output.loot)) {
      if (value > 0) html += `<div>${key}: <b style="color:#ffcc44;">${value}</b></div>`;
    }
    html += `</div>`;
    html += `<button type="button" id="hub-collect-btn" style="width:100%;padding:6px;background:#3a2a05;border:1px solid #ff9922;color:#ffcc44;cursor:pointer;border-radius:3px;font-size:11px;">Transfer To Cargo</button>`;
  }

  html += `<div style="margin-top:8px;font-size:9px;color:#556677;text-align:right;">Wallet: ${player.credits.toLocaleString()}¢</div>`;
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
