import "../../styles/ship-panel.css";
import { sfxBlip } from "../../../audio/procedural.js";
import { renderInventoryHTML } from "../../inventory/index.js";
import { t } from "../../../utils/i18n.js";
import { renderStatsTabHTML, rebuildStatsTab } from "./stats.js";
import {
  activeShipTab,
  setActiveShipTab,
  resetLiveState,
  turretCardNodes
} from "./state.js";
import { createElement, setHtml, setStyle, onClick } from "../../dom-helpers.js";

/** Builds the multi-tab SHIP HUD panel container structure */
export function buildShipPanelShell(): HTMLElement {
  setActiveShipTab("cargo");
  resetLiveState();
  turretCardNodes.clear();

  const root = createElement("div", "sp-root");
  root.id = "ship-panel-root";
  setStyle(root, { height: "100%", width: "100%", display: "flex", flexDirection: "column", overflow: "hidden" });

  setHtml(root, `
    <div class="sp-tabs">
      <button class="sp-tab active" data-tab="cargo">${t("ship.cargo")}</button>
      <button class="sp-tab"        data-tab="stats">${t("ship.stats")}</button>
    </div>
    <div class="sp-body" style="flex:1; min-height:0; position:relative;">
      <div class="sp-tab-panel active" data-tab-panel="cargo">
        <div id="bridge-pane-cargo" class="br-pane" style="height:100%;width:100%;display:flex;flex-direction:column;overflow:hidden;">
          ${renderInventoryHTML()}
        </div>
      </div>
      <div class="sp-tab-panel" data-tab-panel="stats">
        <div class="sp-scroll" id="ship-stats-scroll">
          ${renderStatsTabHTML()}
        </div>
      </div>
    </div>
  `);

  return root;
}

/** Attaches click listeners for active tab toggles */
export function attachShipPanelListeners(root: HTMLElement) {
  const tabs = root.querySelectorAll(".sp-tab");
  for (const tab of tabs) {
    onClick(tab, () => {
      sfxBlip();
      const targetTab = (tab as HTMLElement).dataset.tab as "cargo" | "stats";
      if (activeShipTab === targetTab) return;

      setActiveShipTab(targetTab);

      // Toggle tab classes
      for (const t of tabs) {
        t.classList.toggle("active", t === tab);
      }

      // Toggle panel panels
      const panels = root.querySelectorAll(".sp-tab-panel");
      for (const p of panels) {
        const isTarget = (p as HTMLElement).dataset.tabPanel === targetTab;
        p.classList.toggle("active", isTarget);
      }

      // If switched to Stats, rebuild its static content and cache refs
      if (targetTab === "stats") {
        resetLiveState();
        rebuildStatsTab();
      }
    });
  }
}
