import "../styles/station-base.css";
import { h, render } from "preact";
import { sfxBlip } from "../../audio/procedural.js";
import { on } from "../../events.js";
import { Client } from "../../state.js";
import { stationState } from "./shared.js";
import { bindStationDomEvents } from "./events.js";
import { stationActionHandlers } from "./actions.js";
import { closeHudWindow } from "../hud/windows.js";
import { getElement, createElement, append } from "../dom-helpers.js";
import { StationShellView } from "./shell-view.js";

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
  render(h(StationShellView, {}), el);
  append(document.body, el);

  bindStationDomEvents(el, onStationAction);

  on("ui:close-overlays", () => {
    closeHudWindow("station");
    stationState.previewFitting = null;
    Client.stationOpen = false;
    Client.activeStation = null;
  });
}
