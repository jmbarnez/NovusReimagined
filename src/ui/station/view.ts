import { Client, type Player } from "../../state.js";
import { fmtKey } from "../../utils/format.js";
import { getCurrentTutorialStep } from "../../data/tutorial.js";
import { getTutorialSnapshot } from "../../tutorial/index.js";
import type { Station } from "../../types/world.js";
import { stationState } from "./shared.js";
import { renderHangar } from "./hangar.js";
import { renderMarket } from "./market.js";
import { renderContracts } from "./contracts.js";
import { renderFabrication, renderIndustry } from "./industry.js";
import { mountInventoryInPane, resetInventoryUI } from "../inventory/index.js";
import { syncTutorialVisuals, clearTutorialVisuals } from "../tutorial/visuals.js";
import { activateStationTab, type StationTabId } from "./tabs.js";
import { t } from "../../utils/i18n.js";
import { getState } from "../../state-access.js";
import { on } from "../../events.js";
import { getElement, query, setText, setHtml, toggleClass } from "../dom-helpers.js";

function syncTutorialVisualsFromActiveStep(): void {
  const step = getCurrentTutorialStep(getState().player)?.id;
  if (step !== "hangar-high" && step !== "hangar-turrets" && step !== "industry") {
    clearTutorialVisuals();
    return;
  }
  syncTutorialVisuals();
}

function preferredTutorialStationTab(st: Station): StationTabId | null {
  const step = getCurrentTutorialStep(getState().player)?.id;
  if (step === "industry" && st.services.includes("industry")) return "industry";
  if (step === "hangar-high" || step === "hangar-turrets") return "hangar";
  return null;
}

let stationTutorialEventsBound = false;
let stationRefreshEventsBound = false;
let lastStationRefreshSignature = "";

function syncStationStateFromActiveStation(): void {
  const station = Client.activeStation;
  const player = getState().player;
  stationState.craftQueue = player.craftQueue;
  stationState._stationContracts = station && player.stationOfferStationId === station.id
    ? player.stationOffers
    : [];
}

function signatureForPlayerRecord(record: Record<string, unknown> | undefined): string {
  return JSON.stringify(record ?? {});
}

function signatureForContracts(contracts: Player["contracts"]): string {
  return contracts
    .map((contract) => `${contract.id}:${contract.status}:${contract.objective.current}/${contract.objective.required}`)
    .join("|");
}

function signatureForStationOffers(offers: Player["stationOffers"], stationId: string | null): string {
  return `${stationId ?? ""}:${offers.map((contract) => `${contract.id}:${contract.status}`).join("|")}`;
}

function signatureForModules(player: Player): string {
  const cargo = player.moduleCargo
    .map((inst) => `${inst.uid}:${inst.baseId}:${inst.durability}/${inst.maxDurability}`)
    .join("|");
  return `${cargo}::${signatureForPlayerRecord(player.fitting)}::${signatureForPlayerRecord(player.moduleHp)}`;
}

function signatureForStationView(): string {
  const player = getState().player;
  return JSON.stringify({
    stationId: Client.activeStation?.id ?? null,
    stationOfferStationId: player.stationOfferStationId,
    credits: player.credits,
    hp: Math.round(player.hp),
    structure: Math.round(player.structure),
    shield: Math.round(player.shield),
    homeSysIdx: player.homeSysIdx,
    ore: player.ore,
    loot: player.loot,
    components: player.components,
    ammo: player.ammo,
    blueprints: player.blueprints,
    mixedOreCargo: player.mixedOreCargo,
    bulkMaterialsCargo: player.bulkMaterialsCargo,
    refineryStorage: player.refineryStorage,
    hubOutput: player.hubOutput,
    craftQueue: player.craftQueue,
    modules: signatureForModules(player),
    contracts: signatureForContracts(player.contracts),
    stationOffers: signatureForStationOffers(player.stationOffers, player.stationOfferStationId),
  });
}

function refreshStationViewFromSnapshot(): void {
  if (!Client.stationOpen || !Client.activeStation) return;
  const el = getElement("station-overlay");
  if (!el) return;

  const nextSignature = signatureForStationView();
  if (nextSignature === lastStationRefreshSignature) return;

  syncStationStateFromActiveStation();
  renderStationView();
  lastStationRefreshSignature = nextSignature;
}

function bindStationTutorialEvents(): void {
  if (stationTutorialEventsBound) return;
  stationTutorialEventsBound = true;
  on("tutorial:step-change", () => {
    if (!Client.stationOpen || !Client.activeStation) return;
    const preferredTab = preferredTutorialStationTab(Client.activeStation);
    if (preferredTab) activateStationTab(preferredTab);
    syncTutorialVisualsFromActiveStep();
  });
}

function bindStationRefreshEvents(): void {
  if (stationRefreshEventsBound) return;
  stationRefreshEventsBound = true;
  on("inventory:changed", refreshStationViewFromSnapshot);
}

export function buildStationView(st: Station): void {
  const el = getElement("station-overlay");
  if (!el) return;
  bindStationTutorialEvents();
  bindStationRefreshEvents();

  const nameEl = query("#st-name", el);
  if (nameEl) setText(nameEl, st.name);
  const metaEl = query("#st-meta", el);
  if (metaEl) setText(metaEl, `Services: ${st.services.join(" · ")}`);
  const sys = getState().GALAXY[getState().player.sysIdx];
  const sec = sys?.security ?? 0.5;
  const secColor = sec >= 0.7 ? "var(--hud-positive)" : sec >= 0.4 ? "var(--hud-accent)" : "var(--hud-danger)";
  const secLabel = sec >= 0.7 ? t("station.highSec") : sec >= 0.4 ? t("station.midSec") : t("station.lowSec");
  const secBadgeEl = query("#st-sec-badge", el);
  if (secBadgeEl) setHtml(secBadgeEl, `<span style="color:${secColor}">●</span> ${secLabel} ${sec.toFixed(1)}`);

  el.querySelectorAll(".st-tab").forEach((btn) => {
    const tab = (btn as HTMLElement).dataset.tab;
    const avail = tab === "hangar"
      || tab === "contracts"
      || (tab === "fabrication" ? st.services.includes("industry") : st.services.includes(tab!));
    (btn as HTMLButtonElement).disabled = !avail;
    toggleClass(btn, "active", false);
  });
  el.querySelectorAll(".panel").forEach((panel) => toggleClass(panel, "active", false));

  const preferredTab = preferredTutorialStationTab(st);
  const first = preferredTab
    ? query(`.st-tab[data-tab="${preferredTab}"]:not([disabled])`, el)
    : query(".st-tab:not([disabled])", el);
  if (first) {
    stationState.activeTab = (first as HTMLElement).dataset.tab as StationTabId;
    activateStationTab(stationState.activeTab, el);
  }

  stationState.activeTab = stationState.activeTab || "hangar";
  stationState.indStage = "process";
  stationState.indRailTab = "queue";
  stationState.indRailPulseTab = null;
  stationState.indRailPulseUntil = 0;
  stationState.indHeatOverrides = {};
  stationState.indProcessSource = null;
  stationState.indProcessQty = {};
  stationState.indProcessTarget = {};
  stationState.indSeparateSource = null;
  stationState.indAlloyTargetStorage = {};
  stationState.indAlloySelections = {};
  stationState.indAlloyShowMore = {};
  stationState.selectedRecipeId = null;
  syncStationStateFromActiveStation();
  resetInventoryUI();
  renderStationView();
  lastStationRefreshSignature = signatureForStationView();
}

export function renderStationView(): void {
  const el = getElement("station-overlay");
  if (!el || !Client.stationOpen) return;
  syncStationStateFromActiveStation();
  const crEl = query("#st-cr", el);
  if (crEl) setText(crEl, `${getState().player.credits}¢`);
  const undockKey = getElement("st-undock-key");
  if (undockKey) setText(undockKey, fmtKey(Client.settings.keybinds.dock));

  renderHangar();
  mountInventoryInPane("hangar-pane-cargo");
  renderMarket();
  renderContracts();
  const industryPanel = getElement("panel-industry");
  if (industryPanel?.classList.contains("active")) {
    renderIndustry(industryPanel);
  }
  const fabricationPanel = getElement("panel-fabrication");
  if (fabricationPanel?.classList.contains("active")) {
    renderFabrication(fabricationPanel);
  }
  syncTutorialVisualsFromActiveStep();
}
