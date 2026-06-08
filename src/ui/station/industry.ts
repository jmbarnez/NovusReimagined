import "../styles/station-industry.css";
import { getState } from "../../state-access.js";
import { getCargoMixedOreInputs } from "../../hub.js";
import { RECIPES } from "../../data/industryRecipes.js";
import { sfxBlip, sfxConfirm, sfxError } from "../../audio/procedural.js";
import { queueFrameAction } from "../../sim/input.js";
import { t } from "../../utils/i18n.js";
import { stationState } from "./shared.js";
import {
  canAffordRecipe,
  currentStage,
  formatTime,
  selectedHeatMode,
  selectedProcessQty,
  type RefiningStage,
} from "./industry-model.js";
import {
  renderAlloyStage,
  renderAssemblyStage,
  renderBottomBar,
  renderFabricationOverview,
  renderFabricationRail,
  renderManifestBand,
  renderOverview,
  renderProcessStage,
  renderSeparateStage,
  renderStageTabs,
} from "./industry-renderers/index.js";

let lastIndustryContainer: HTMLElement | null = null;
let lastFabricationContainer: HTMLElement | null = null;

function pulseRefineryRail(tab: typeof stationState.indRailTab): void {
  stationState.indRailTab = tab;
  stationState.indRailPulseTab = tab;
  stationState.indRailPulseUntil = Date.now() + 1200;
  renderIndustry();
  setTimeout(() => {
    if (Date.now() < stationState.indRailPulseUntil) return;
    stationState.indRailPulseTab = null;
    stationState.indRailPulseUntil = 0;
    renderIndustry();
  }, 1250);
}

function resolvePanelContainer(panelId: string, lastContainer: HTMLElement | null, container?: HTMLElement): HTMLElement | null {
  if (container) return container;
  const stationPanel = document.getElementById(panelId);
  if (stationPanel?.classList.contains("active")) return stationPanel;
  if (lastContainer?.isConnected) return lastContainer;
  return stationPanel;
}

function rerenderStationProduction(panelHint?: HTMLElement | null): void {
  const panel = panelHint?.closest(".panel") as HTMLElement | null;
  if (panel?.id === "panel-fabrication") {
    renderFabrication(panel);
    return;
  }
  if (panel?.id === "panel-industry") {
    renderIndustry(panel);
    return;
  }
  const activeFab = document.getElementById("panel-fabrication");
  if (activeFab?.classList.contains("active")) {
    renderFabrication(activeFab);
    return;
  }
  renderIndustry();
}

export function updateIndustryProgress() {
  if (!lastFabricationContainer?.isConnected) return;
  if (!lastFabricationContainer.classList.contains("active")) return;
  const queue = getState().player.craftQueue;
  const now = Date.now();
  lastFabricationContainer.querySelectorAll<HTMLElement>(".ind-queue-job[data-job-id]").forEach((jobEl) => {
    const jobId = jobEl.dataset.jobId;
    if (!jobId) return;
    const job = queue.find((entry) => entry.id === jobId);
    if (!job) return;
    const elapsed = now - job.startTime;
    const pct = Math.min(100, Math.floor((elapsed / job.duration) * 100));
    const remainingMs = Math.max(0, job.duration - elapsed);
    const fill = jobEl.querySelector<HTMLElement>(".ind-queue-progress-fill");
    const pctEl = jobEl.querySelector<HTMLElement>(".ind-queue-pct");
    const timeEl = jobEl.querySelector<HTMLElement>(".ind-queue-time");
    if (fill) fill.style.width = `${pct}%`;
    if (pctEl) pctEl.textContent = `${pct}%`;
    if (timeEl) timeEl.textContent = `${formatTime(remainingMs / 1000)} ${t("industry.remaining")}`;
  });
}

export function renderIndustry(container?: HTMLElement) {
  const div = resolvePanelContainer("panel-industry", lastIndustryContainer, container);
  if (!div) return;
  lastIndustryContainer = div;

  let stageHtml = "";
  if (currentStage() === "process") stageHtml = renderProcessStage();
  else if (currentStage() === "separate") stageHtml = renderSeparateStage();
  else stageHtml = renderAlloyStage();

  div.innerHTML = `
    <div class="ind-shell ind-shell--refinery">
      ${renderOverview()}
      ${renderStageTabs()}
      <div class="ind-workspace">
        <main class="ind-stage-column">${stageHtml}</main>
      </div>
      ${renderBottomBar()}
    </div>
  `;
}

export function renderFabrication(container?: HTMLElement) {
  const div = resolvePanelContainer("panel-fabrication", lastFabricationContainer, container);
  if (!div) return;
  lastFabricationContainer = div;
  div.innerHTML = `
    <div class="ind-shell ind-shell--fabrication">
      ${renderFabricationOverview()}
      ${renderManifestBand()}
      <div class="ind-workspace">
        <main class="ind-stage-column">${renderAssemblyStage()}</main>
        ${renderFabricationRail()}
      </div>
    </div>
  `;
}

export function handleIndustryAction(action: string, btn: HTMLElement): boolean {
  if (action === "indStage") {
    const stage = btn.dataset.stage as RefiningStage | undefined;
    if (!stage) return false;
    stationState.indStage = stage;
    sfxBlip(640, 0.04);
    renderIndustry();
    return true;
  }
  if (action === "indRailTab") {
    const railTab = btn.dataset.railTab as typeof stationState.indRailTab | undefined;
    if (!railTab) return false;
    stationState.indRailTab = railTab;
    sfxBlip(640, 0.04);
    renderIndustry();
    return true;
  }
  if (action === "selectProcessSource") {
    const cargoIndex = btn.dataset.cargoIndex ?? "";
    if (!cargoIndex) return false;
    stationState.indProcessSource = cargoIndex;
    sfxBlip(640, 0.04);
    renderIndustry();
    return true;
  }
  if (action === "selectSeparateSource") {
    const materialId = btn.dataset.materialId ?? "";
    if (!materialId) return false;
    stationState.indSeparateSource = materialId;
    sfxBlip(640, 0.04);
    renderIndustry();
    return true;
  }
  if (action === "indTab") {
    stationState.indTab = btn.dataset.tab || "workbench";
    stationState.selectedRecipeId = null;
    sfxBlip(640, 0.04);
    renderFabrication();
    return true;
  }
  if (action === "selectRecipe") {
    stationState.selectedRecipeId = btn.dataset.recipe || "";
    sfxBlip(640, 0.04);
    renderFabrication();
    return true;
  }
  if (action === "buyBP") {
    const recipeId = btn.dataset.recipe || "";
    const recipe = RECIPES.find((entry) => entry.id === recipeId);
    const cost = recipe?.blueprintCost ?? 0;
    if (!recipe || getState().player.credits < cost) {
      sfxError();
      return true;
    }
    queueFrameAction({ type: "buyBlueprint", payload: { recipeId } });
    sfxConfirm();
    return true;
  }
  if (action === "queueJob") {
    const recipeId = btn.dataset.recipe || "";
    if (!canAffordRecipe(recipeId, stationState.craftQty)) {
      sfxError();
      return true;
    }
    queueFrameAction({ type: "queueIndustryJob", payload: { recipeId, qty: stationState.craftQty } });
    sfxConfirm();
    return true;
  }
  if (action === "cancelJob") {
    const jobId = btn.dataset.jobId || "";
    queueFrameAction({ type: "cancelIndustryJob", payload: { jobId } });
    sfxBlip();
    return true;
  }
  if (action === "processMixedCargo") {
    const cargoIndex = parseInt(btn.dataset.cargoIndex ?? "", 10);
    const slot = getCargoMixedOreInputs(getState().player).find((entry) => entry.index === cargoIndex);
    const qty = selectedProcessQty(cargoIndex, slot?.qty ?? 1);
    queueFrameAction({
      type: "processHubMixedOre",
      payload: {
        cargoIndex,
        qty,
        heatMode: selectedHeatMode(`cargo-${cargoIndex}`),
        targetStorageId: stationState.indProcessTarget[String(cargoIndex)] ?? null,
      },
    });
    stationState.indProcessSource = String(cargoIndex);
    sfxConfirm();
    pulseRefineryRail("queue");
    return true;
  }
  if (action === "separateStock") {
    const materialId = btn.dataset.materialId || "";
    if (!materialId) return true;
    stationState.indSeparateSource = materialId;
    queueFrameAction({
      type: "separateHubMaterial",
      payload: { materialId, heatMode: selectedHeatMode(materialId) },
    });
    sfxConfirm();
    pulseRefineryRail("queue");
    return true;
  }
  if (action === "alloyStock") {
    const materialId = btn.dataset.materialId || "";
    if (!materialId) return true;
    queueFrameAction({
      type: "alloyHubMaterial",
      payload: {
        materialId,
        sourceMaterialIds: stationState.indAlloySelections[materialId] ?? [],
        targetAlloyFamilyId: btn.dataset.alloyFamilyId || null,
        heatMode: selectedHeatMode(materialId),
        targetStorageId: stationState.indAlloyTargetStorage[materialId] ?? null,
      },
    });
    sfxConfirm();
    pulseRefineryRail("queue");
    return true;
  }
  if (action === "toggleAlloyMore") {
    const materialId = btn.dataset.materialId || "";
    if (!materialId) return true;
    stationState.indAlloyShowMore[materialId] = !stationState.indAlloyShowMore[materialId];
    sfxBlip(640, 0.04);
    renderIndustry();
    return true;
  }
  if (action === "collectRefinedOutput") {
    queueFrameAction({ type: "collectHubOutput" });
    sfxConfirm();
    pulseRefineryRail("output");
    return true;
  }
  return false;
}

export function handleIndustryFieldEvent(target: EventTarget | null): boolean {
  if (!target) return false;
  const el = target as HTMLElement;
  if (el.id === "ind-search-input") {
    stationState.indSearch = (el as HTMLInputElement).value;
    rerenderStationProduction(el);
    return true;
  }
  if (el.id === "ind-sort-select") {
    stationState.indSort = (el as HTMLSelectElement).value;
    rerenderStationProduction(el);
    return true;
  }
  if (el.id === "ind-qty-sel") {
    stationState.craftQty = parseInt((el as HTMLSelectElement).value, 10) || 1;
    rerenderStationProduction(el);
    return true;
  }
  if (el.classList.contains("ind-qty-input")) {
    const input = el as HTMLInputElement;
    const cargoIndex = input.dataset.cargoIndex ?? "";
    const qty = parseInt(input.value, 10);
    stationState.indProcessQty[cargoIndex] = Number.isFinite(qty) ? qty : 1;
    rerenderStationProduction(el);
    return true;
  }
  if (el.classList.contains("ind-heat-select")) {
    const select = el as HTMLSelectElement;
    const seed = select.dataset.heatFor ?? "";
    const value = select.value;
    stationState.indHeatOverrides[seed] = value === "cool" || value === "hot" ? value : "stable";
    rerenderStationProduction(el);
    return true;
  }
  if (el.classList.contains("ind-storage-select")) {
    const select = el as HTMLSelectElement;
    const processTarget = select.dataset.processTarget;
    const alloyTarget = select.dataset.alloyTarget;
    if (processTarget != null) stationState.indProcessTarget[processTarget] = select.value;
    if (alloyTarget != null) stationState.indAlloyTargetStorage[alloyTarget] = select.value;
    rerenderStationProduction(el);
    return true;
  }
  if (el.matches('input[type="checkbox"][data-alloy-source-for]')) {
    const input = el as HTMLInputElement;
    const seed = input.dataset.alloySourceFor ?? "";
    const current = new Set(stationState.indAlloySelections[seed] ?? []);
    if (input.checked) current.add(input.value);
    else current.delete(input.value);
    stationState.indAlloySelections[seed] = [...current];
    rerenderStationProduction(el);
    return true;
  }
  return false;
}
