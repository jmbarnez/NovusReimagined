import { beforeEach, describe, expect, it } from "vitest";
import { _G } from "../src/state.js";
import { makePlayer } from "../src/player/player-data.js";
import { renderIndustry, handleIndustryAction } from "../src/ui/station/industry.js";
import { stationState } from "../src/ui/station/shared.js";
import { ensureStationUI } from "../src/ui/station/shell.js";

describe("station fabrication panel", () => {
  beforeEach(() => {
    _G.P = makePlayer() as typeof _G.P;
    stationState.indTab = "smelter";
    stationState.indSearch = "";
    stationState.indSort = "name";
    stationState.selectedRecipeId = null;
    stationState.craftQty = 1;
    document.body.innerHTML = "";
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
});
