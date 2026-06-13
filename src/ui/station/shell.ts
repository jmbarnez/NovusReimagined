import "../styles/station-base.css";
import { sfxBlip } from "../../audio/procedural.js";
import { on } from "../../events.js";
import { Client } from "../../state.js";
import { stationState } from "./shared.js";
import { bindStationDomEvents } from "./events.js";
import { stationActionHandlers } from "./actions.js";
import { t } from "../../utils/i18n.js";
import { closeHudWindow } from "../hud/windows.js";
import { getElement, createElement, setHtml, append } from "../dom-helpers.js";

function onStationAction(e: Event): void {
  const target = e.target as HTMLElement | null;
  const btn = target?.closest("[data-action]") as HTMLElement | null;
  if (!btn) return;
  const action = btn.dataset.action;
  if (!action) return;
  const handler = stationActionHandlers[action];
  if (handler) handler(btn);
}

export function ensureStationUI(): void {
  if (getElement("station-overlay")) return;
  const el = createElement("div");
  el.id = "station-overlay";
  setHtml(el, `
    <div class="st-win-head">
      <span class="st-win-meta" id="st-meta"></span>
      <span class="st-win-wallet"><span id="st-cr"></span></span>
      <button id="st-undock" data-action="undock">${t("station.undock")} <kbd class="st-kbd" id="st-undock-key"></kbd></button>
    </div>
    <nav id="st-tabs">
      <button class="st-tab" data-tab="hangar">${t("station.hangar")}</button>
      <button class="st-tab" data-tab="market">${t("station.market")}</button>
      <button class="st-tab" data-tab="industry">${t("station.industry")}</button>
      <button class="st-tab" data-tab="fabrication">${t("station.fabrication")}</button>
      <button class="st-tab" data-tab="contracts">${t("station.contracts")}</button>
    </nav>
    <main id="st-body">
      <div class="panel" id="panel-hangar"></div>
      <div class="panel" id="panel-market"></div>
      <div class="panel panel--tool" id="panel-industry"></div>
      <div class="panel panel--tool" id="panel-fabrication"></div>
      <div class="panel" id="panel-contracts"></div>
    </main>
    <div id="st-dimmer"></div>`);
  append(document.body, el);

  bindStationDomEvents(el, onStationAction);

  on("ui:close-overlays", () => {
    closeHudWindow("station");
    stationState.previewFitting = null;
    Client.stationOpen = false;
    Client.activeStation = null;
  });
}
