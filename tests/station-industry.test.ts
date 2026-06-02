import { beforeEach, describe, expect, it } from "vitest";
import { _G } from "../src/state.js";
import { makePlayer } from "../src/player/player-data.js";
import { renderIndustry, handleIndustryAction } from "../src/ui/station/industry.js";
import { stationState } from "../src/ui/station/shared.js";
import { ensureStationUI } from "../src/ui/station/shell.js";
import { buildStationView } from "../src/ui/station/view.js";
import { Client, _G as G } from "../src/state.js";
import { TUTORIAL_STEPS } from "../src/data/tutorial.js";
import { emit } from "../src/events.js";
import type { Station } from "../src/types/world.js";

describe("station fabrication panel", () => {
  beforeEach(() => {
    _G.P = makePlayer() as typeof _G.P;
    stationState.indTab = "smelter";
    stationState.indSearch = "";
    stationState.indSort = "name";
    stationState.selectedRecipeId = null;
    stationState.craftQty = 1;
    document.body.innerHTML = "";
    Client.stationOpen = false;
    Client.activeStation = null;
  });

  it("renders into the active station panel instead of a stale previous host", () => {
    const staleHost = document.createElement("div");
    renderIndustry(staleHost);
    staleHost.remove();

    document.body.innerHTML = `<div class="panel active" id="panel-industry"></div>`;
    const panel = document.getElementById("panel-industry");
    expect(panel).not.toBeNull();

    const action = document.createElement("button");
    action.dataset.action = "selectRecipe";
    action.dataset.recipe = "bar";
    expect(handleIndustryAction("selectRecipe", action)).toBe(true);

    expect(panel?.textContent).toContain("Ferro bar");
    expect(panel?.textContent).toContain("Required Materials");
    expect(staleHost.textContent).not.toContain("Required Materials");
  });

  it("uses the themed Fabrication tab label in the station shell", () => {
    ensureStationUI();

    const fabricationTab = document.querySelector('.st-tab[data-tab="industry"]');

    expect(fabricationTab?.textContent).toBe("Fabrication");
  });

  it("activates Fabrication when the tutorial advances while docked", () => {
    ensureStationUI();
    const station: Station = {
      id: "academy",
      name: "S.T.A.R.T Academy",
      x: 0,
      y: 0,
      radius: 240,
      spin: 0,
      isHome: true,
      safeRadius: 420,
      turrets: [],
      services: ["market", "industry", "repair"],
    };
    const flyStationIdx = TUTORIAL_STEPS.findIndex((step) => step.id === "fly-station");
    const industryIdx = TUTORIAL_STEPS.findIndex((step) => step.id === "industry");
    expect(flyStationIdx).toBeGreaterThanOrEqual(0);
    expect(industryIdx).toBeGreaterThanOrEqual(0);

    G.P.tutorial.active = true;
    G.P.tutorial.step = flyStationIdx;
    Client.stationOpen = true;
    Client.activeStation = station;
    buildStationView(station);

    G.P.tutorial.step = industryIdx;
    emit("tutorial:step-change", { step: industryIdx });

    const fabricationTab = document.querySelector('.st-tab[data-tab="industry"]');
    const fabricationPanel = document.getElementById("panel-industry");
    expect(fabricationTab?.classList.contains("active")).toBe(true);
    expect(fabricationPanel?.classList.contains("active")).toBe(true);
    expect(fabricationPanel?.textContent).toContain("Ferro bar");
  });
});
