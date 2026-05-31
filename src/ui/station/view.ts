import { Client } from "../../state.js";
import { fmtKey } from "../../utils/format.js";
import { getCurrentTutorialStep } from "../../data/tutorial.js";
import { getTutorialSnapshot } from "../../tutorial.js";
import type { Station } from "../../types/world.js";
import { stationState } from "./shared.js";
import { renderHangar } from "./hangar.js";
import { renderMarket } from "./market.js";
import { renderContracts } from "./contracts.js";
import { renderIndustry } from "./industry.js";
import { mountInventoryInPane, resetInventoryUI } from "../inventory/index.js";
import { syncHangarTutorialGuide, clearHangarTutorialGuide } from "../tutorial-hangar-guide.js";
import { t } from "../../utils/i18n.js";
import { getState } from "../../state-access.js";

function syncHangarTutorialGuideFromActiveStep(): void {
  const step = getCurrentTutorialStep(getState().player)?.id;
  if (step !== "hangar-high" && step !== "hangar-turrets") {
    clearHangarTutorialGuide();
    return;
  }
  syncHangarTutorialGuide(getTutorialSnapshot());
}

export function buildStationView(st: Station): void {
  const el = document.getElementById("station-overlay");
  if (!el) return;

  el.querySelector("#st-name")!.textContent = st.name;
  el.querySelector("#st-meta")!.textContent = `Services: ${st.services.join(" · ")}`;
  const sys = getState().GALAXY[getState().player.sysIdx];
  const sec = sys?.security ?? 0.5;
  const secColor = sec >= 0.7 ? "var(--hud-positive)" : sec >= 0.4 ? "var(--hud-accent)" : "var(--hud-danger)";
  const secLabel = sec >= 0.7 ? t("station.highSec") : sec >= 0.4 ? t("station.midSec") : t("station.lowSec");
  (el.querySelector("#st-sec-badge") as HTMLElement).innerHTML = `<span style="color:${secColor}">●</span> ${secLabel} ${sec.toFixed(1)}`;

  el.querySelectorAll(".st-tab").forEach((btn) => {
    const tab = (btn as HTMLElement).dataset.tab;
    const avail = tab === "hangar" || tab === "contracts" || st.services.includes(tab!);
    (btn as HTMLButtonElement).disabled = !avail;
    btn.classList.remove("active");
  });

  const step = getCurrentTutorialStep(getState().player)?.id;
  const preferredTab = step === "industry" && st.services.includes("industry")
    ? "industry"
    : (step === "hangar-high" || step === "hangar-turrets")
      ? "hangar"
      : null;
  const first = preferredTab
    ? el.querySelector(`.st-tab[data-tab="${preferredTab}"]:not([disabled])`)
    : el.querySelector(".st-tab:not([disabled])");
  if (first) {
    first.classList.add("active");
    el.querySelectorAll(".panel").forEach((panel) => panel.classList.remove("active"));
    el.querySelector(`#panel-${(first as HTMLElement).dataset.tab}`)!.classList.add("active");
  }

  stationState.selectedRecipeId = null;
  stationState.craftQueue = getState().player.craftQueue;
  stationState._stationContracts = getState().player.stationOfferStationId === st.id
    ? getState().player.stationOffers
    : [];
  resetInventoryUI();
  renderStationView();
}

export function renderStationView(): void {
  const el = document.getElementById("station-overlay");
  if (!el || !Client.stationOpen) return;
  el.querySelector("#st-cr")!.textContent = `${getState().player.credits}¢`;
  const undockKey = document.getElementById("st-undock-key");
  if (undockKey) undockKey.textContent = fmtKey(Client.settings.keybinds.dock);

  renderHangar();
  mountInventoryInPane("hangar-pane-cargo");
  renderMarket();
  renderContracts();
  const industryPanel = document.getElementById("panel-industry");
  if (industryPanel?.classList.contains("active")) {
    renderIndustry(industryPanel);
  }
  syncHangarTutorialGuideFromActiveStep();
}
