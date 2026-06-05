import { beforeEach, describe, expect, it } from "vitest";
import { _G } from "../src/state.js";
import { makePlayer } from "../src/player/player-data.js";
import { renderFabrication, renderIndustry, handleIndustryAction } from "../src/ui/station/industry.js";
import { stationState } from "../src/ui/station/shared.js";
import { ensureStationUI } from "../src/ui/station/shell.js";
import { buildStationView } from "../src/ui/station/view.js";
import { Client, _G as G } from "../src/state.js";
import { TUTORIAL_STEPS } from "../src/data/tutorial.js";
import { emit } from "../src/events.js";
import type { Station } from "../src/types/world.js";
import { PlayerAccess } from "../src/state-access.js";

describe("station refining panel", () => {
  beforeEach(() => {
    _G.P = makePlayer() as typeof _G.P;
    stationState.indStage = "process";
    stationState.indRailTab = "hold";
    stationState.indTab = "workbench";
    stationState.indSearch = "";
    stationState.indSort = "name";
    stationState.indHeatOverrides = {};
    stationState.indProcessQty = {};
    stationState.indProcessTarget = {};
    stationState.indAlloyTargetStorage = {};
    stationState.indAlloySelections = {};
    stationState.selectedRecipeId = null;
    stationState.craftQty = 1;
    document.body.innerHTML = "";
    Client.stationOpen = false;
    Client.activeStation = null;
  });

  it("renders into the active station panel instead of a stale previous host", () => {
    const staleHost = document.createElement("div");
    renderFabrication(staleHost);
    staleHost.remove();

    document.body.innerHTML = `<div class="panel active" id="panel-fabrication"></div>`;
    const panel = document.getElementById("panel-fabrication");
    expect(panel).not.toBeNull();

    const action = document.createElement("button");
    action.dataset.action = "selectRecipe";
    action.dataset.recipe = "gear";
    expect(handleIndustryAction("selectRecipe", action)).toBe(true);

    expect(panel?.textContent).toContain("Mechanical gear");
    expect(panel?.textContent).toContain("Required feed");
    expect(staleHost.textContent).not.toContain("Required feed");
  });

  it("uses the themed Refining tab label in the station shell", () => {
    ensureStationUI();

    const refiningTab = document.querySelector('.st-tab[data-tab="industry"]');

    expect(refiningTab?.textContent).toBe("Refining");
  });

  it("uses the Fabrication tab label in the station shell", () => {
    ensureStationUI();

    const fabricationTab = document.querySelector('.st-tab[data-tab="fabrication"]');

    expect(fabricationTab?.textContent).toBe("Fabrication");
  });

  it("activates Refining when the tutorial advances while docked", () => {
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

    const refiningTab = document.querySelector('.st-tab[data-tab="industry"]');
    const refiningPanel = document.getElementById("panel-industry");
    expect(refiningTab?.classList.contains("active")).toBe(true);
    expect(refiningPanel?.classList.contains("active")).toBe(true);
    expect(refiningPanel?.textContent).toContain("Mixed Ore Intake");
    expect(refiningPanel?.textContent).toContain("Process");
  });

  it("shows ranked alloy fit guidance for processed stock", () => {
    stationState.indStage = "alloy";
    PlayerAccess.addRefineryStorageMaterial({
      id: "mat-test",
      materialId: "processed_stock",
      kind: "processed",
      label: "Fe-Ni stock",
      volumeM3: 2.4,
      massKg: 7800,
      composition: { iron: 0.66, nickel: 0.24, carbon: 0.1 },
    }, _G.P);
    PlayerAccess.addRefineryStorageMaterial({
      id: "mat-test-2",
      materialId: "processed_stock",
      kind: "processed",
      label: "Crystal stock",
      volumeM3: 1.3,
      massKg: 3300,
      composition: { crystal: 0.68, iron: 0.22, exotic: 0.1 },
    }, _G.P);
    stationState.indAlloySelections["mat-test"] = ["mat-test-2"];

    document.body.innerHTML = `<div class="panel active" id="panel-industry"></div>`;
    renderIndustry();

    const panel = document.getElementById("panel-industry");
    const bandGrid = panel?.querySelector(".ind-storage-zone-grid--bands");
    expect(panel?.textContent).toContain("Intake");
    expect(panel?.textContent).toContain("Processed");
    expect(panel?.textContent).toContain("Separated");
    expect(panel?.textContent).toContain("Alloy");
    expect(panel?.textContent).toContain("Processed Stock");
    expect(panel?.textContent).toContain("Separated Streams");
    expect(panel?.textContent).toContain("Alloy Reservoirs");
    expect(panel?.textContent).toContain("Blend preview");
    expect(panel?.textContent).toContain("Base stock");
    expect(panel?.textContent).toContain("Blend sources");
    expect(panel?.textContent).toContain("Blend mass");
    expect(panel?.textContent).toContain("Best fit window");
    expect(panel?.textContent).toContain("Ferro-nickel stock");
    expect(panel?.textContent).toContain("within family window");
    expect(panel?.textContent).toContain("Refinery Plant");
    expect(bandGrid).not.toBeNull();
  });

  it("shows process yield projections for mixed ore batches", () => {
    stationState.indStage = "process";
    _G.P.mixedOreCargo = [
      { name: "Test ore", qty: 4, richness: 2.1, composition: { iron: 0.7, nickel: 0.2, carbon: 0.1 } },
    ];

    document.body.innerHTML = `<div class="panel active" id="panel-industry"></div>`;
    renderIndustry();

    const panel = document.getElementById("panel-industry");
    expect(panel?.textContent).toContain("Projected output");
    expect(panel?.textContent).toContain("After queue");
    expect(panel?.textContent).toContain("Stock volume");
    expect(panel?.textContent).toContain("Waste");
  });

  it("uses the compact refinery header and rail instead of the old top manifest", () => {
    stationState.indStage = "process";
    _G.P.bulkMaterialsCargo = [{
      id: "bulk-1",
      materialId: "ferro_nickel_stock",
      alloyFamilyId: "ferro_nickel_stock",
      kind: "alloy",
      label: "Ferro-nickel stock",
      volumeM3: 1.2,
      massKg: 9780,
      composition: { iron: 0.66, nickel: 0.24, carbon: 0.1 },
    }];
    _G.P.hubDeposit.loot = { scrap: 2 };

    document.body.innerHTML = `<div class="panel active" id="panel-industry"></div>`;
    renderIndustry();

    const panel = document.getElementById("panel-industry");
    expect(panel?.textContent).toContain("Station Refining");
    expect(panel?.textContent).toContain("Processed");
    expect(panel?.textContent).toContain("Separated");
    expect(panel?.textContent).toContain("Material Hold");
    expect(panel?.textContent).toContain("Dossier");
    expect(panel?.textContent).toContain("Output");
    expect(panel?.textContent).not.toContain("Cargo Material Manifest");
  });

  it("shows separation stream previews for processed stock", () => {
    stationState.indStage = "separate";
    PlayerAccess.addRefineryStorageMaterial({
      id: "mat-separate",
      materialId: "processed_stock",
      kind: "processed",
      label: "Mixed stock",
      volumeM3: 3.1,
      massKg: 9100,
      composition: { iron: 0.62, nickel: 0.24, carbon: 0.14 },
    }, _G.P);

    document.body.innerHTML = `<div class="panel active" id="panel-industry"></div>`;
    renderIndustry();

    const panel = document.getElementById("panel-industry");
    expect(panel?.textContent).toContain("Projected split");
    expect(panel?.textContent).toContain("Source mix");
    expect(panel?.textContent).toContain("Recovered streams");
    expect(panel?.textContent).toContain("Recovered mass");
    expect(panel?.textContent).toContain("Waste");
    expect(panel?.textContent).toContain("Constituent split");
  });

  it("renders discovered alloy codex entries in the alloy stage", () => {
    stationState.indStage = "alloy";
    stationState.indRailTab = "dossier";
    _G.P.alloyCodex.discoveries.push({
      id: "disc-test",
      label: "Fe-X intermediate",
      signatureKey: "sig",
      composition: { iron: 0.52, exotic: 0.28, crystal: 0.2 },
      densityKgPerM3: 4900,
      purpose: "Experimental systems stock",
      tags: ["experimental"],
      compatibleFamilyIds: [],
      discoveredAt: Date.now() / 1000,
      seenCount: 2,
    });
    PlayerAccess.addRefineryStorageMaterial({
      id: "mat-discovery",
      materialId: "processed_stock",
      kind: "processed",
      label: "Discovery stock",
      volumeM3: 1.8,
      massKg: 5600,
      composition: { iron: 0.52, exotic: 0.28, crystal: 0.2 },
    }, _G.P);

    document.body.innerHTML = `<div class="panel active" id="panel-industry"></div>`;
    renderIndustry();

    const panel = document.getElementById("panel-industry");
    expect(panel?.textContent).toContain("Material Dossier");
    expect(panel?.textContent).toContain("Fe-X intermediate");
    expect(panel?.textContent).toContain("Fabrication");
    expect(panel?.textContent).toContain("Compatibility");
    expect(panel?.textContent).toContain("Density");
    expect(panel?.textContent).toContain("catalogued");
  });

  it("renders fabrication separately from refining", () => {
    _G.P.bulkMaterialsCargo = [{
      id: "bulk-1",
      materialId: "ferro_nickel_stock",
      alloyFamilyId: "ferro_nickel_stock",
      kind: "alloy",
      label: "Ferro-nickel stock",
      volumeM3: 1.2,
      massKg: 9780,
      composition: { iron: 0.66, nickel: 0.24, carbon: 0.1 },
    }];
    _G.P.loot.scrap = 2;
    stationState.selectedRecipeId = "gear";

    document.body.innerHTML = `<div class="panel active" id="panel-fabrication"></div>`;
    renderFabrication();

    const panel = document.getElementById("panel-fabrication");
    expect(panel?.textContent).toContain("Station Fabrication");
    expect(panel?.textContent).toContain("Cargo Material Manifest");
    expect(panel?.textContent).toContain("Fabrication Lanes");
    expect(panel?.textContent).toContain("Mechanical gear");
  });

  it("marks refining and fabrication panels as tool surfaces in the station shell", () => {
    ensureStationUI();

    expect(document.getElementById("panel-industry")?.classList.contains("panel--tool")).toBe(true);
    expect(document.getElementById("panel-fabrication")?.classList.contains("panel--tool")).toBe(true);
  });
});
