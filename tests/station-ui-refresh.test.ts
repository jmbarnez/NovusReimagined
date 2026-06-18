import { beforeEach, describe, expect, it } from "vitest";
import { makePlayer } from "../src/player/player-data.js";
import { Client, _G } from "../src/state.js";
import { emit } from "../src/events.js";
import { ensureStationUI } from "../src/ui/station/shell.js";
import { buildStationView } from "../src/ui/station/view.js";
import { stationState } from "../src/ui/station/shared.js";
import type { MissionContract } from "../src/data/missions.js";
import type { Station } from "../src/types/station.js";

const TEST_STATION: Station = {
  id: "station-test",
  name: "Test Station",
  x: 0,
  y: 0,
  radius: 240,
  spin: 0,
  isHome: true,
  safeRadius: 420,
  turrets: [],
  services: ["market", "industry", "repair"],
};

function resetStationState(): void {
  stationState.previewFitting = null;
  stationState._stationMissions = [];
  stationState.activeTab = "hangar";
  stationState.mktTab = "modules";
  stationState.mktRack = "all";
  stationState.mktSearch = "";
  stationState.mktSort = "name";
  stationState.indStage = "process";
  stationState.indRailTab = "hold";
  stationState.indRailPulseTab = null;
  stationState.indRailPulseUntil = 0;
  stationState.indTab = "workbench";
  stationState.indSearch = "";
  stationState.indSort = "name";
  stationState.indHeatOverrides = {};
  stationState.indProcessSource = null;
  stationState.indProcessQty = {};
  stationState.indProcessTarget = {};
  stationState.indSeparateSource = null;
  stationState.indAlloyTargetStorage = {};
  stationState.indAlloySelections = {};
  stationState.indAlloyShowMore = {};
  stationState.selectedRecipeId = null;
  stationState.craftQueue = [];
  stationState.craftQty = 1;
}

function openTestStation(): void {
  ensureStationUI();
  Client.stationOpen = true;
  Client.activeStation = TEST_STATION;
  buildStationView(TEST_STATION);
}

function clickStationTab(tab: string): void {
  const button = document.querySelector(`.st-tab[data-tab="${tab}"]`) as HTMLButtonElement | null;
  expect(button).not.toBeNull();
  button?.click();
}

function makeContract(id: string, status: MissionContract["status"] = "available"): MissionContract {
  return {
    id,
    type: "mining",
    title: "Test Mining",
    description: "Collect test ore.",
    reward: 500,
    stationId: TEST_STATION.id,
    sysIdx: 0,
    objective: { type: "mining", target: "iron", required: 10, current: status === "complete" ? 10 : 0 },
    status,
  };
}

describe("station UI snapshot refresh", () => {
  beforeEach(() => {
    _G.P = makePlayer() as typeof _G.P;
    _G.GALAXY = [{
      id: "sys-test",
      idx: 0,
      name: "Test System",
      security: 0.8,
      mapX: 0,
      mapY: 0,
      ring: 0,
      links: [],
      _ready: true,
      asteroids: [],
      enemies: [],
      gates: [],
      stations: [TEST_STATION],
      planets: [],
      nebulaHues: [],
      starHue: 0,
    }];
    document.body.innerHTML = "";
    Client.stationOpen = false;
    Client.activeStation = null;
    resetStationState();
  });

  it("refreshes market rows and wallet after authoritative inventory changes", () => {
    openTestStation();

    expect(document.querySelector('[data-action="sellMod"][data-mod-id="tu-civilian-cannon"]')).not.toBeNull();

    _G.P.credits = 1234;
    _G.P.moduleCargo = _G.P.moduleCargo.filter((module) => module.baseId !== "tu-civilian-cannon");
    emit("inventory:changed");

    expect(document.getElementById("st-cr")?.textContent).toBe("1234¢");
    expect(document.querySelector('[data-action="sellMod"][data-mod-id="tu-civilian-cannon"]')).toBeNull();
  });

  it("refreshes contracts when station offers move into active contracts", () => {
    const offer = makeContract("contract-refresh");
    _G.P.stationOfferStationId = TEST_STATION.id;
    _G.P.stationOffers = [offer];
    openTestStation();

    expect(document.querySelector('[data-action="acceptContract"][data-contract-id="contract-refresh"]')).not.toBeNull();

    _G.P.stationOffers = [];
    _G.P.contracts = [{ ...offer, status: "active" }];
    emit("inventory:changed");

    expect(document.querySelector('[data-action="acceptContract"][data-contract-id="contract-refresh"]')).toBeNull();
    expect(document.querySelector('[data-action="abandonContract"][data-contract-id="contract-refresh"]')).not.toBeNull();
    expect(document.getElementById("panel-missions")?.textContent).toContain("Test Mining");
  });

  it("refreshes hangar fitting controls after authoritative fit changes", () => {
    openTestStation();

    expect(document.querySelector('[data-action="unfit"][data-rack="high"][data-idx="0"]')).not.toBeNull();

    _G.P.fitting.high[0] = null;
    emit("inventory:changed");

    expect(document.querySelector('[data-action="unfit"][data-rack="high"][data-idx="0"]')).toBeNull();
    expect(document.getElementById("sel-high-0")).not.toBeNull();
  });

  it("refreshes active refining and fabrication panels after authoritative material changes", () => {
    openTestStation();
    clickStationTab("industry");

    expect(document.getElementById("panel-industry")?.textContent).not.toContain("Refresh ore");

    _G.P.mixedOreCargo = [{
      name: "Refresh ore",
      qty: 2,
      richness: 1.5,
      composition: { iron: 0.7, nickel: 0.2, carbon: 0.1 },
    }];
    emit("inventory:changed");

    expect(document.getElementById("panel-industry")?.textContent).toContain("Refresh ore");

    clickStationTab("fabrication");
    expect(document.getElementById("panel-fabrication")?.textContent).not.toContain("Ferro-nickel stock");

    _G.P.bulkMaterialsCargo = [{
      id: "bulk-refresh",
      materialId: "ferro_nickel_stock",
      alloyFamilyId: "ferro_nickel_stock",
      kind: "alloy",
      label: "Ferro-nickel stock",
      volumeM3: 1.2,
      massKg: 9780,
      composition: { iron: 0.66, nickel: 0.24, carbon: 0.1 },
    }];
    emit("inventory:changed");

    expect(document.getElementById("panel-fabrication")?.textContent).toContain("Ferro-nickel stock");
  });

  it("switches live station panels when clicking Refining and Fabrication", () => {
    openTestStation();

    expect(document.getElementById("panel-industry")?.classList.contains("active")).toBe(true);
    expect(document.getElementById("panel-hangar")?.classList.contains("active")).toBe(false);
    expect(document.getElementById("panel-industry")?.textContent).toContain("Station Refining");
    expect(document.getElementById("panel-industry")?.textContent).toContain("Ore In");

    clickStationTab("hangar");

    expect(document.querySelector('.st-tab[data-tab="hangar"]')?.classList.contains("active")).toBe(true);
    expect(document.getElementById("panel-hangar")?.classList.contains("active")).toBe(true);
    expect(document.getElementById("panel-industry")?.classList.contains("active")).toBe(false);

    clickStationTab("fabrication");

    expect(document.querySelector('.st-tab[data-tab="fabrication"]')?.classList.contains("active")).toBe(true);
    expect(document.getElementById("panel-fabrication")?.classList.contains("active")).toBe(true);
    expect(document.getElementById("panel-hangar")?.classList.contains("active")).toBe(false);
    expect(document.getElementById("panel-fabrication")?.textContent).toContain("Station Fabrication");
  });
});
