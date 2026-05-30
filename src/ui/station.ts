import "./styles/station-base.css";
import { Client } from "../state.js";
import { getState } from "../state-access.js";
import { undockStation } from "../dock.js";
import { sfxBlip, sfxConfirm, sfxError } from "../audio/procedural.js";
import { on } from "../events.js";
import { generateContractsForStation } from "../data/missions.js";
import { logEvent } from "./hud-overlay.js";
import { fmtKey } from "../utils/format.js";
import type { Station } from "../types/world.js";
import {
  repairShipAction,
  buyModuleAction,
  sellModuleAction,
  buyAmmunitionAction,
  sellCargoResourceAction,
  fitModuleAction,
  unfitModuleAction,
  swapModuleAction,
  queueIndustryJobAction,
  cancelIndustryJobAction,
  buyBlueprintAction,
  setHomeSystemAction,
  acceptContractAction,
  turnInContractAction,
  abandonContractAction
} from "../state/actions.js";

// Re-export and import shared and tab specific logic
import { stationState, MAX_ACTIVE_CONTRACTS } from "./station/shared.js";
import { renderHangar, setPreview, updateStatsGrid } from "./station/hangar.js";
import { renderMarket } from "./station/market.js";
import { renderIndustry } from "./station/industry.js";
import { renderContracts } from "./station/contracts.js";

export { renderHangar, renderMarket, renderIndustry, renderContracts };

export function ensureStationUI() {
  if (document.getElementById("station-overlay")) return;
  const el = document.createElement("div");
  el.id = "station-overlay";
  el.innerHTML = `
    <div id="st-ui">
      <aside id="st-sidebar">
        <div id="st-station-info">
          <div id="st-name"></div>
          <div id="st-meta"></div>
          <div id="st-sec-badge"></div>
        </div>
        <div id="st-wallet">
          <div id="st-cr"></div>

        </div>
        <nav id="st-tabs">
          <button class="st-tab" data-tab="hangar">Hangar</button>
          <button class="st-tab" data-tab="market">Market</button>
          <button class="st-tab" data-tab="industry">Industry</button>
          <button class="st-tab" data-tab="contracts">Contracts</button>

        </nav>
        <button id="st-undock" data-action="undock">⏏ Undock <kbd class="st-kbd" id="st-undock-key"></kbd></button>
      </aside>
      <main id="st-body">
        <div class="panel" id="panel-hangar"></div>
        <div class="panel" id="panel-market"></div>
        <div class="panel" id="panel-industry"></div>
        <div class="panel" id="panel-contracts"></div>

      </main>
    </div>`;
  el.querySelectorAll(".st-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      if ((btn as HTMLButtonElement).disabled) return;
      sfxBlip(720, 0.05);
      el.querySelectorAll(".st-tab").forEach(b => b.classList.remove("active"));
      el.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      el.querySelector(`#panel-${(btn as HTMLElement).dataset.tab}`)?.classList.add("active");
    });
  });
  el.addEventListener("click", onStationAction);
  
  // Delegated hover listeners for fitting preview on action buttons only
  el.addEventListener("mouseover", (e: MouseEvent) => {
    if (!Client.stationOpen) return;
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const btn = target.closest("[data-action='unfit'], [data-action='swapMod'], [data-action='fit']");
    if (!btn) return;
    const slot = (btn as HTMLElement).closest(".slot");
    if (!slot) return;
    const rack = (slot as HTMLElement).dataset.rack as "turret" | "high" | "med" | "low";
    const idx = parseInt((slot as HTMLElement).dataset.idx!, 10);
    if (!rack) return;
    const action = (btn as HTMLElement).dataset.action;
    if (action === "unfit") {
      setPreview(rack, idx, null);
    } else {
      const select = slot.querySelector("select");
      if (select) setPreview(rack, idx, (select as HTMLSelectElement).value);
    }
  });

  el.addEventListener("mouseout", (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && target.closest("[data-action='unfit'], [data-action='swapMod'], [data-action='fit']")) {
      stationState.previewFitting = null;
      updateStatsGrid();
    }
  });

  el.addEventListener("input", (e: Event) => {
    const target = e.target as HTMLInputElement | null;
    if (!target) return;
    if (target.id === "mkt-search-input") {
      stationState.mktSearch = target.value;
      renderMarket();
    }
    if (target.id === "ind-search-input") {
      stationState.indSearch = target.value;
      renderIndustry();
    }
  });

  el.addEventListener("change", (e: Event) => {
    const target = e.target as HTMLSelectElement | HTMLInputElement | null;
    if (!target) return;
    if (target.id === "mkt-sort-select") {
      stationState.mktSort = target.value;
      renderMarket();
      return;
    }
    if (target.id === "ind-sort-select") {
      stationState.indSort = target.value;
      renderIndustry();
      return;
    }
    if (target.id === "ind-qty-sel") {
      stationState.craftQty = parseInt((target as HTMLSelectElement).value, 10);
      renderIndustry();
      return;
    }
    if (target.tagName === "SELECT" && (target.id.startsWith("sel-") || target.id.startsWith("swap-"))) {
      const slot = target.closest(".slot");
      if (slot) {
        const rack = (slot as HTMLElement).dataset.rack as "turret" | "high" | "med" | "low";
        const idx = parseInt((slot as HTMLElement).dataset.idx!, 10);
        if (rack) setPreview(rack, idx, (target as HTMLSelectElement).value);
      }
    }
  });

  document.body.appendChild(el);
  on("ui:close-overlays", () => {
    el.style.display = "none";
    stationState.previewFitting = null;
    Client.stationOpen = false;
    Client.activeStation = null;
  });
}

export function buildStationUI(st: Station) {
  const el = document.getElementById("station-overlay");
  if (!el) return;
  el.querySelector("#st-name")!.textContent = st.name;
  el.querySelector("#st-meta")!.textContent = `Services: ${st.services.join(" · ")}`;
  const sys = getState().GALAXY[getState().player.sysIdx];
  const sec = sys?.security ?? 0.5;
  const secColor = sec >= 0.7 ? "var(--hud-positive)" : sec >= 0.4 ? "var(--hud-accent)" : "var(--hud-danger)";
  const secLabel = sec >= 0.7 ? "HIGH SEC" : sec >= 0.4 ? "MID SEC" : "LOW SEC";
  (el.querySelector("#st-sec-badge") as HTMLElement).innerHTML = `<span style="color:${secColor}">●</span> ${secLabel} ${sec.toFixed(1)}`;
  el.querySelectorAll(".st-tab").forEach(btn => { 
    const tab = (btn as HTMLElement).dataset.tab;
    const avail = tab === "hangar" || tab === "contracts" || st.services.includes(tab!); 
    (btn as HTMLButtonElement).disabled = !avail; 
    btn.classList.remove("active"); 
  });
  const first = el.querySelector(".st-tab:not([disabled])");
  if (first) {
    first.classList.add("active"); 
    el.querySelectorAll(".panel").forEach(p => p.classList.remove("active")); 
    el.querySelector(`#panel-${(first as HTMLElement).dataset.tab}`)!.classList.add("active");
  }
  stationState.selectedRecipeId = null;
  stationState.craftQueue = getState().player.craftQueue;
  const ring = getState().GALAXY[getState().player.sysIdx]?.ring ?? 0;
  stationState._stationContracts = generateContractsForStation(st, getState().player.sysIdx, ring);
  renderStationUI();
}

export function renderStationUI() {
  const el = document.getElementById("station-overlay");
  if (!el || !Client.stationOpen) return;
  el.querySelector("#st-cr")!.textContent = `${getState().player.credits}¢`;
  const undockKey = document.getElementById("st-undock-key");
  if (undockKey) undockKey.textContent = fmtKey(Client.settings.keybinds.dock);

  renderHangar();
  renderMarket();
  renderIndustry();
  renderContracts();
}

function onStationAction(e: Event) {
  const target = e.target as HTMLElement | null;
  const btn = target?.closest("[data-action]");
  if (!btn) return;
  const action = (btn as HTMLElement).dataset.action;

  switch (action) {
    case "undock": {
      sfxBlip();
      undockStation();
      break;
    }
    case "repair": {
      const res = repairShipAction();
      if (!res.success) { sfxError(); return; }
      sfxConfirm();
      renderStationUI();
      break;
    }
    case "buyMod": {
      const id = (btn as HTMLElement).dataset.modId;
      if (!id) return;
      const res = buyModuleAction(id);
      if (!res.success) { sfxError(); return; }
      sfxConfirm();
      renderStationUI();
      break;
    }
    case "sellMod": {
      const id = (btn as HTMLElement).dataset.modId;
      if (!id) return;
      const res = sellModuleAction(id);
      if (!res.success) { sfxError(); return; }
      sfxConfirm();
      renderStationUI();
      break;
    }
    case "buyHybrid": {
      const res = buyAmmunitionAction("hybrid");
      if (!res.success) { sfxError(); return; }
      sfxConfirm();
      renderStationUI();
      break;
    }
    case "buyMissile": {
      const res = buyAmmunitionAction("missile");
      if (!res.success) { sfxError(); return; }
      sfxConfirm();
      renderStationUI();
      break;
    }
    case "sellOre": {
      const k = (btn as HTMLElement).dataset.ore!;
      const res = sellCargoResourceAction("ore", k);
      if (!res.success) { sfxError(); return; }
      sfxConfirm();
      renderStationUI();
      break;
    }
    case "sellLoot": {
      const k = (btn as HTMLElement).dataset.loot!;
      const res = sellCargoResourceAction("loot", k);
      if (!res.success) { sfxError(); return; }
      sfxConfirm();
      renderStationUI();
      break;
    }
    case "sellComp": {
      const k = (btn as HTMLElement).dataset.comp!;
      const res = sellCargoResourceAction("components", k);
      if (!res.success) { sfxError(); return; }
      sfxConfirm();
      renderStationUI();
      break;
    }
    case "fit": {
      const rack = (btn as HTMLElement).dataset.rack as "turret" | "high" | "med" | "low";
      const i = parseInt((btn as HTMLElement).dataset.idx!, 10);
      const select = (btn as HTMLElement).parentElement!.querySelector("select");
      const instanceId = select ? (select as HTMLSelectElement).value : "";
      const res = fitModuleAction(rack, i, instanceId);
      if (!res.success) { sfxError(); return; }
      sfxConfirm();
      renderStationUI();
      break;
    }
    case "unfit": {
      const rack = (btn as HTMLElement).dataset.rack as "turret" | "high" | "med" | "low";
      const i = parseInt((btn as HTMLElement).dataset.idx!, 10);
      const res = unfitModuleAction(rack, i);
      if (!res.success) { sfxError(); return; }
      sfxConfirm();
      renderStationUI();
      break;
    }
    case "queueJob": {
      const id = (btn as HTMLElement).dataset.recipe!;
      const qty = stationState.craftQty;
      const res = queueIndustryJobAction(id, qty);
      if (!res.success) { sfxError(); return; }
      sfxConfirm();
      if (res.label) logEvent(`Queued: ${res.label}`, "system");
      renderStationUI();
      break;
    }
    case "cancelJob": {
      const jobId = (btn as HTMLElement).dataset.jobId!;
      const res = cancelIndustryJobAction(jobId);
      if (!res.success) { sfxError(); return; }
      sfxBlip();
      if (res.label) logEvent(`Cancelled: ${res.label}`, "system");
      renderStationUI();
      break;
    }
    case "buyBP": {
      const id = (btn as HTMLElement).dataset.recipe!;
      const res = buyBlueprintAction(id);
      if (!res.success) { sfxError(); return; }
      sfxConfirm();
      renderStationUI();
      break;
    }
    case "setHome": {
      const res = setHomeSystemAction();
      if (!res.success) { sfxError(); return; }
      sfxConfirm();
      renderStationUI();
      break;
    }
    case "mktTab": {
      stationState.mktTab = (btn as HTMLElement).dataset.tab || "modules";
      sfxBlip(640, 0.04);
      renderMarket();
      break;
    }
    case "mktRack": {
      stationState.mktRack = (btn as HTMLElement).dataset.rack || "all";
      sfxBlip(640, 0.04);
      renderMarket();
      break;
    }
    case "indTab": {
      stationState.indTab = (btn as HTMLElement).dataset.tab || "all";
      stationState.selectedRecipeId = null;
      sfxBlip(640, 0.04);
      renderIndustry();
      break;
    }
    case "selectRecipe": {
      const id = (btn as HTMLElement).dataset.recipe;
      if (!id) return;
      stationState.selectedRecipeId = id;
      sfxBlip(780, 0.03);
      renderIndustry();
      break;
    }
    case "swapMod": {
      const rack = (btn as HTMLElement).dataset.rack as "turret" | "high" | "med" | "low";
      const i = parseInt((btn as HTMLElement).dataset.idx!, 10);
      const select = document.getElementById(`swap-${rack}-${i}`) as HTMLSelectElement;
      const newUid = select?.value;
      const res = swapModuleAction(rack, i, newUid);
      if (!res.success) { sfxError(); return; }
      sfxConfirm();
      renderStationUI();
      break;
    }
    case "acceptContract": {
      const id = (btn as HTMLElement).dataset.contractId;
      if (!id) return;
      const res = acceptContractAction(id, stationState._stationContracts);
      if (!res.success) { sfxError(); return; }
      sfxConfirm();
      if (res.label) logEvent(`Contract accepted: ${res.label}`, "system");
      renderContracts();
      break;
    }
    case "turnInContract": {
      const id = (btn as HTMLElement).dataset.contractId;
      if (!id) return;
      const res = turnInContractAction(id);
      if (!res.success) { sfxError(); return; }
      sfxConfirm();
      if (res.label && res.creditsEarned != null) logEvent(`Claimed ${res.creditsEarned} CR for: ${res.label}`, "loot");
      renderStationUI();
      break;
    }
    case "abandonContract": {
      const id = (btn as HTMLElement).dataset.contractId;
      if (!id) return;
      const res = abandonContractAction(id);
      if (!res.success) { sfxError(); return; }
      sfxBlip();
      renderContracts();
      break;
    }
    default:
      break;
  }
}
