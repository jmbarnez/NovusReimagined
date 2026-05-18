import "./styles/station-base.css";
import { G, Client } from "../state.js";
import { MODULES } from "../data/modules.js";
import { ORE_MARKET_BUY, COMPONENT_MARKET_BUY } from "../data/marketCatalog.js";
import { getStats, invalidate } from "../player/player-stats.js";
import { syncSlotHeat } from "../player/player-fitting.js";
import { ensureAmmoDefaults } from "../player/player-data.js";
import { closeStation, undockStation } from "../dock.js";
import { sfxBlip, sfxConfirm, sfxError } from "../audio/procedural.js";
import { MODULE_HP_MAX } from "../constants.js";
import { on, emit } from "../events.js";
import { generateContractsForStation } from "../data/missions.js";
import { logEvent } from "./hud-overlay.js";
import { getRecipe, createCraftJob, type IndustryPool } from "../data/industryRecipes.js";
import { ModuleRarity, RARITY_CONFIG } from "../data/moduleRarity.js";
import { generateModuleInstance } from "../loot/generateModule.js";
import { fmtKey } from "../utils/format.js";
import { getInstance, invalidateInstanceCache } from "../utils/items.js";

// Re-export and import shared and tab specific logic
import { stationState, MAX_ACTIVE_CONTRACTS } from "./station/shared.js";
import { renderHangar, setPreview, updateStatsGrid } from "./station/hangar.js";
import { renderMarket } from "./station/market.js";
import { renderFitting } from "./station/fitting.js";
import { renderIndustry } from "./station/industry.js";
import { renderContracts } from "./station/contracts.js";

export { renderHangar, renderMarket, renderFitting, renderIndustry, renderContracts };

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
  el.addEventListener("mouseover", (e: any) => {
    if (!Client.stationOpen) return;
    const btn = e.target.closest("[data-action='unfit'], [data-action='swapMod'], [data-action='fit']");
    if (!btn) return;
    const slot = (btn as HTMLElement).closest(".slot");
    if (!slot) return;
    const rack = (slot as HTMLElement).dataset.rack as any;
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

  el.addEventListener("mouseout", (e: any) => {
    if (e.target.closest("[data-action='unfit'], [data-action='swapMod'], [data-action='fit']")) {
      stationState.previewFitting = null;
      updateStatsGrid();
    }
  });

  el.addEventListener("input", (e: any) => {
    if (e.target.id === "mkt-search-input") {
      stationState.mktSearch = e.target.value;
      renderMarket();
    }
    if (e.target.id === "ind-search-input") {
      stationState.indSearch = e.target.value;
      renderIndustry();
    }
  });

  el.addEventListener("change", (e: any) => {
    if (e.target.id === "mkt-sort-select") {
      stationState.mktSort = e.target.value;
      renderMarket();
      return;
    }
    if (e.target.id === "ind-sort-select") {
      stationState.indSort = e.target.value;
      renderIndustry();
      return;
    }
    if (e.target.id === "ind-qty-sel") {
      stationState.craftQty = parseInt((e.target as HTMLSelectElement).value, 10);
      renderIndustry();
      return;
    }
    if (e.target.tagName === "SELECT" && (e.target.id.startsWith("sel-") || e.target.id.startsWith("swap-"))) {
      const slot = e.target.closest(".slot");
      if (slot) {
        const rack = slot.dataset.rack as any;
        const idx = parseInt(slot.dataset.idx, 10);
        if (rack) setPreview(rack, idx, e.target.value);
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

export function buildStationUI(st: any) {
  const el = document.getElementById("station-overlay");
  if (!el) return;
  el.querySelector("#st-name")!.textContent = st.name;
  el.querySelector("#st-meta")!.textContent = `Services: ${st.services.join(" · ")}`;
  const sys = G.GALAXY[G.P.sysIdx];
  const sec = sys?.security ?? 0.5;
  const secColor = sec >= 0.7 ? "#44ff88" : sec >= 0.4 ? "#ffcc44" : "#ff4444";
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
  stationState.craftQueue = G.P.craftQueue;
  const ring = G.GALAXY[G.P.sysIdx]?.ring ?? 0;
  stationState._stationContracts = generateContractsForStation(st, G.P.sysIdx, ring);
  renderStationUI();
}

export function renderStationUI() {
  const el = document.getElementById("station-overlay");
  if (!el || !Client.stationOpen) return;
  el.querySelector("#st-cr")!.textContent = `${G.P.credits}¢`;
  const undockKey = document.getElementById("st-undock-key");
  if (undockKey) undockKey.textContent = fmtKey(Client.settings.keybinds.dock);

  renderHangar();
  renderMarket();
  renderIndustry();
  renderContracts();
}

function onStationAction(e: any) {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const action = (btn as HTMLElement).dataset.action;

  switch (action) {
    case "undock": {
      sfxBlip();
      undockStation();
      break;
    }
    case "repair": {
      const st = getStats();
      const hullRep = Math.max(0, st.maxHp - G.P.hp);
      const structRep = Math.max(0, st.maxStructure - G.P.structure);
      const shieldRep = Math.max(0, st.maxShield - G.P.shield);
      let moduleDamageTotal = 0;
      for (const rack of ["turret", "high", "med", "low"] as const) {
        const slots = G.P.fitting?.[rack];
        if (!slots) continue;
        for (let i = 0; i < slots.length; i++) {
          const uid = slots[i];
          if (uid) {
            const inst = getInstance(uid);
            if (inst) {
              moduleDamageTotal += Math.max(0, inst.maxDurability - inst.durability);
            }
          }
        }
      }
      const cost = Math.max(0, Math.ceil((hullRep + structRep * 0.5 + shieldRep * 0.3 + moduleDamageTotal * 0.6) * 0.8));
      if (G.P.credits < cost) { sfxError(); return; }
      sfxConfirm();
      G.P.credits -= cost;
      G.P.hp = st.maxHp;
      G.P.structure = st.maxStructure;
      G.P.shield = st.maxShield;
      for (const inst of G.P.moduleCargo) {
        inst.durability = inst.maxDurability;
      }
      for (const rack of ["turret", "high", "med", "low"] as const) {
        const slots = G.P.fitting?.[rack];
        if (!slots) continue;
        for (let i = 0; i < slots.length; i++) {
          const uid = slots[i];
          if (uid) {
            const inst = getInstance(uid);
            if (inst) inst.durability = inst.maxDurability;
          }
        }
      }
      invalidate();
      renderStationUI();
      break;
    }
    case "buyMod": {
      const id = (btn as HTMLElement).dataset.modId;
      if (!id) return;
      const m = MODULES[id];
      if (!m || G.P.credits < m.price) { sfxError(); return; }
      sfxConfirm();
      G.P.credits -= m.price;
      const inst = generateModuleInstance(id, G.P.level, 0);
      inst.rarity = ModuleRarity.Stock;
      inst.affixes = [];
      G.P.moduleCargo.push(inst);
      invalidateInstanceCache();
      renderStationUI();
      break;
    }
    case "sellMod": {
      const id = (btn as HTMLElement).dataset.modId;
      if (!id) return;
      const m = MODULES[id];
      if (!m) return;
      // Only sell unfitted instances
      const fittedIds = new Set<string>();
      for (const r of ["turret", "high", "med", "low"] as const)
        for (const uid of G.P.fitting[r]) if (uid) fittedIds.add(uid);
      const instIdx = G.P.moduleCargo.findIndex(inst => inst.baseId === id && !fittedIds.has(inst.uid));
      if (instIdx === -1) { sfxError(); return; }
      sfxConfirm();
      const inst = G.P.moduleCargo[instIdx];
      const rarityMult = RARITY_CONFIG[inst.rarity].sellMult;
      const sellPrice = Math.floor(m.price * 0.6 * rarityMult);
      G.P.moduleCargo.splice(instIdx, 1);
      G.P.credits += sellPrice;
      invalidateInstanceCache();
      invalidate();
      renderStationUI();
      break;
    }
    case "buyHybrid": {
      ensureAmmoDefaults();
      if (G.P.credits < 40) { sfxError(); return; }
      sfxConfirm();
      G.P.credits -= 40;
      G.P.ammo.hybrid = (G.P.ammo.hybrid || 0) + 500;
      renderStationUI();
      break;
    }
    case "buyMissile": {
      ensureAmmoDefaults();
      if (G.P.credits < 95) { sfxError(); return; }
      sfxConfirm();
      G.P.credits -= 95;
      G.P.ammo.missile = (G.P.ammo.missile || 0) + 24;
      renderStationUI();
      break;
    }
    case "sellOre": {
      const k = (btn as HTMLElement).dataset.ore!;
      if (G.P.ore[k] <= 0) { sfxError(); return; }
      sfxConfirm();
      G.P.credits += G.P.ore[k] * (ORE_MARKET_BUY[k] || 0);
      G.P.ore[k] = 0;
      renderStationUI();
      break;
    }
    case "sellLoot": {
      const k = (btn as HTMLElement).dataset.loot!;
      if (G.P.loot[k] <= 0) { sfxError(); return; }
      sfxConfirm();
      const lootBuy: Record<string, number> = { scrap: 5, chip: 45, cell: 22, "intact-part": 30 };
      G.P.credits += G.P.loot[k] * (lootBuy[k!] || 0);
      G.P.loot[k] = 0;
      renderStationUI();
      break;
    }
    case "sellComp": {
      const k = (btn as HTMLElement).dataset.comp!;
      if (G.P.components[k] <= 0) { sfxError(); return; }
      sfxConfirm();
      G.P.credits += G.P.components[k] * (COMPONENT_MARKET_BUY[k] || 100);
      G.P.components[k] = 0;
      renderStationUI();
      break;
    }
    case "fit": {
      const rack = (btn as HTMLElement).dataset.rack as "turret" | "high" | "med" | "low";
      const i = parseInt((btn as HTMLElement).dataset.idx!, 10);
      const select = (btn as HTMLElement).parentElement!.querySelector("select");
      const instanceId = select ? (select as HTMLSelectElement).value : "";
      if (!instanceId) { sfxError(); return; }
      const inst = getInstance(instanceId);
      if (!inst) { sfxError(); return; }
      const m = MODULES[inst.baseId];
      if (!m) { sfxError(); return; }
      sfxConfirm();
      G.P.fitting[rack][i] = instanceId;
      G.P.moduleHp[rack][i] = Math.round((inst.durability / inst.maxDurability) * MODULE_HP_MAX);
      syncSlotHeat();
      invalidate();
      renderStationUI();
      break;
    }
    case "unfit": {
      const rack = (btn as HTMLElement).dataset.rack as "turret" | "high" | "med" | "low";
      const i = parseInt((btn as HTMLElement).dataset.idx!, 10);
      const uid = G.P.fitting[rack][i];
      if (!uid) { sfxError(); return; }
      const inst = getInstance(uid);
      if (!inst) { sfxError(); return; }
      sfxConfirm();
      const slotHp = G.P.moduleHp?.[rack]?.[i] ?? MODULE_HP_MAX;
      inst.durability = Math.round((slotHp / MODULE_HP_MAX) * inst.maxDurability);
      G.P.fitting[rack][i] = null;
      syncSlotHeat();
      invalidate();
      renderStationUI();
      break;
    }
    case "queueJob": {
      const id = (btn as HTMLElement).dataset.recipe!;
      const r = getRecipe(id);
      if (!r || (r.requiresBlueprint && !G.P.blueprints[id])) { sfxError(); return; }
      const qty = stationState.craftQty;
      const pool = (p: IndustryPool) =>
        p === "ore" ? G.P.ore : p === "refined" ? G.P.refined : p === "loot" ? G.P.loot : G.P.components;
      for (const inp of r.inputs) {
        if ((pool(inp.pool)[inp.key] || 0) < inp.qty * qty) { sfxError(); return; }
      }
      sfxConfirm();
      for (const inp of r.inputs) pool(inp.pool)[inp.key] -= inp.qty * qty;
      const job = createCraftJob(id, qty);
      G.P.craftQueue.push(job);
      stationState.craftQueue = G.P.craftQueue;
      logEvent(`Queued: ${r.label} ×${qty} (${job.duration / 1000}s)`, "system");
      renderStationUI();
      break;
    }
    case "cancelJob": {
      const jobId = (btn as HTMLElement).dataset.jobId!;
      const idx = G.P.craftQueue.findIndex(j => j.id === jobId);
      if (idx === -1) { sfxError(); return; }
      const job = G.P.craftQueue[idx];
      const r = getRecipe(job.recipeId);
      if (r) {
        const pool = (p: IndustryPool) =>
          p === "ore" ? G.P.ore : p === "refined" ? G.P.refined : p === "loot" ? G.P.loot : G.P.components;
        for (const inp of r.inputs) {
          pool(inp.pool)[inp.key] = (pool(inp.pool)[inp.key] || 0) + inp.qty * job.qty;
        }
      }
      G.P.craftQueue.splice(idx, 1);
      stationState.craftQueue = G.P.craftQueue;
      sfxBlip();
      logEvent(`Cancelled: ${r?.label || "job"}`, "system");
      renderStationUI();
      break;
    }
    case "buyBP": {
      const id = (btn as HTMLElement).dataset.recipe!;
      const r = getRecipe(id);
      const cost = r?.blueprintCost ?? 0;
      if (!r || !cost || G.P.credits < cost) { sfxError(); return; }
      sfxConfirm();
      G.P.credits -= cost;
      G.P.blueprints[id] = true;
      renderStationUI();
      break;
    }
    case "setHome": {
      sfxConfirm();
      G.P.homeSysIdx = G.P.sysIdx;
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
      if (!newUid) { sfxError(); return; }
      const newInst = getInstance(newUid);
      if (!newInst) { sfxError(); return; }
      const oldUid = G.P.fitting[rack][i];
      if (!oldUid) { sfxError(); return; }
      const oldInst = getInstance(oldUid);
      if (!oldInst) { sfxError(); return; }
      sfxConfirm();
      const slotHp = G.P.moduleHp?.[rack]?.[i] ?? MODULE_HP_MAX;
      oldInst.durability = Math.round((slotHp / MODULE_HP_MAX) * oldInst.maxDurability);
      G.P.fitting[rack][i] = newUid;
      G.P.moduleHp[rack][i] = Math.round((newInst.durability / newInst.maxDurability) * MODULE_HP_MAX);
      syncSlotHeat();
      invalidate();
      renderStationUI();
      break;
    }

    case "acceptContract": {
      const id = (btn as HTMLElement).dataset.contractId;
      if (!id) return;
      const contract = stationState._stationContracts.find(c => c.id === id);
      if (!contract) return;
      if (G.P.contracts.length >= MAX_ACTIVE_CONTRACTS) { sfxError(); return; }
      sfxConfirm();
      const accepted = { ...contract, status: "active" as const };
      G.P.contracts.push(accepted);
      emit("mission:accepted", { contract: accepted });
      logEvent(`Contract accepted: ${accepted.title}`, "system");
      renderContracts();
      break;
    }
    case "turnInContract": {
      const id = (btn as HTMLElement).dataset.contractId;
      if (!id) return;
      const idx = G.P.contracts.findIndex(c => c.id === id && c.status === "complete");
      if (idx === -1) { sfxError(); return; }
      const contract = G.P.contracts[idx];
      if (contract.stationId !== Client.activeStation?.id) { sfxError(); return; }
      sfxConfirm();
      G.P.credits += contract.reward;
      G.P.contracts.splice(idx, 1);
      logEvent(`Claimed ${contract.reward} CR for: ${contract.title}`, "loot");
      renderStationUI();
      break;
    }
    case "abandonContract": {
      const id = (btn as HTMLElement).dataset.contractId;
      if (!id) return;
      const idx = G.P.contracts.findIndex(c => c.id === id);
      if (idx === -1) return;
      sfxBlip();
      G.P.contracts.splice(idx, 1);
      renderContracts();
      break;
    }

    default:
      break;
  }
}
