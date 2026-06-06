import { Client } from "../../state.js";
import { sfxBlip } from "../../audio/procedural.js";
import { stationState } from "./shared.js";
import { setPreview, updateStatsGrid } from "./hangar.js";
import { renderMarket } from "./market.js";
import { activateStationTab, type StationTabId } from "./tabs.js";
import {
  handleIndustryAction,
  handleIndustryFieldEvent,
} from "./industry.js";

function bindTabClicks(el: HTMLElement): void {
  el.querySelectorAll(".st-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      if ((btn as HTMLButtonElement).disabled) return;
      sfxBlip(720, 0.05);
      activateStationTab((btn as HTMLElement).dataset.tab as StationTabId, el);
    });
  });
}

function bindClickActions(el: HTMLElement, onStationAction: (e: Event) => void): void {
  el.addEventListener("click", (e: Event) => {
    const target = e.target as HTMLElement | null;
    const actionBtn = target?.closest("[data-action]") as HTMLElement | null;
    if (actionBtn?.dataset.action && handleIndustryAction(actionBtn.dataset.action, actionBtn)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onStationAction(e);
  });
}

function bindSlotHover(el: HTMLElement): void {
  el.addEventListener("mouseover", (e: MouseEvent) => {
    if (!Client.stationOpen) return;
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const btn = target.closest("[data-action='unfit'], [data-action='swapMod'], [data-action='fit']");
    if (!btn) return;
    const slot = (btn as HTMLElement).closest(".slot");
    if (!slot) return;
    const rack = (slot as HTMLElement).dataset.rack as "turret" | "high" | "med" | "low";
    const idx = parseInt((slot as HTMLElement).dataset.idx || "0", 10);
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
}

function bindFieldEvents(el: HTMLElement): void {
  el.addEventListener("input", (e: Event) => {
    if (handleIndustryFieldEvent(e.target)) return;
    const target = e.target as HTMLInputElement | null;
    if (!target) return;
    if (target.id === "mkt-search-input") {
      stationState.mktSearch = target.value;
      renderMarket();
    }
  });

  el.addEventListener("change", (e: Event) => {
    if (handleIndustryFieldEvent(e.target)) return;
    const target = e.target as HTMLSelectElement | HTMLInputElement | null;
    if (!target) return;
    if (target.id === "mkt-sort-select") {
      stationState.mktSort = target.value;
      renderMarket();
      return;
    }
    if (target.tagName === "SELECT" && (target.id.startsWith("sel-") || target.id.startsWith("swap-"))) {
      const slot = target.closest(".slot");
      if (slot) {
        const rack = (slot as HTMLElement).dataset.rack as "turret" | "high" | "med" | "low";
        const idx = parseInt((slot as HTMLElement).dataset.idx || "0", 10);
        if (rack) setPreview(rack, idx, (target as HTMLSelectElement).value);
      }
    }
  });
}

export function bindStationDomEvents(el: HTMLElement, onStationAction: (e: Event) => void): void {
  bindTabClicks(el);
  bindClickActions(el, onStationAction);
  bindSlotHover(el);
  bindFieldEvents(el);
}
