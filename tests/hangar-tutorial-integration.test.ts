import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { _G as G, Client } from "../src/state.js";
import { makePlayer } from "../src/player/player-data.js";
import { installTestPlayer } from "../src/player-registry.js";
import { TUTORIAL_STEPS } from "../src/data/tutorial.js";
import { initTutorial } from "../src/tutorial/index.js";
import { initTutorialOverlay } from "../src/tutorial/ui/setup.js";
import { tutorialState } from "../src/tutorial/ui/state.js";
import { renderStep } from "../src/tutorial/ui/render.js";
import { emit } from "../src/events.js";
import { ensureStationUI, buildStationView, renderStationView } from "../src/ui/station/index.js";
import type { Station } from "../src/types/station.js";

const TEST_STATION: Station = {
  id: "test-station",
  name: "Test Station",
  x: 0,
  y: 0,
  radius: 120,
  spin: 0,
  isHome: false,
  services: ["market", "repair"],
  safeRadius: 300,
  turrets: [],
};

describe("hangar tutorial full integration", () => {
  beforeEach(() => {
    installTestPlayer(makePlayer());
    G.P.tutorial.active = true;
    G.P.tutorial.step = TUTORIAL_STEPS.findIndex((s) => s.id === "hangar-high");

    document.body.innerHTML = `
      <div id="world-tutorial-layer"></div>
      <div id="hud-overlay" style="display:none"></div>
      <div id="bridge-overlay" style="display:block">
        <div class="bridge-workspace" id="bridge-workspace"></div>
      </div>
    `;

    // Reset window system state
    Client.bridgeWindowZ = 220;
  });

  afterEach(() => {
    Client.stationOpen = false;
    Client.activeStation = null;
    tutorialState.layerEl = null;
    tutorialState.root = null;
    tutorialState.cardEl = null;
    Client.bridgeWindowZ = 220;

    // Clean up any created windows
    document.querySelectorAll("[id^='hud-win-']").forEach((el) => el.remove());
    document.getElementById("station-overlay")?.remove();
  });

  it("shows tutorial card when station is opened via ensureStationInterface + openHudWindow", async () => {
    initTutorial();
    initTutorialOverlay(true);

    // Simulate the exact docking flow
    Client.stationOpen = true;
    Client.activeStation = TEST_STATION;

    ensureStationUI();
    const contentEl = document.getElementById("station-overlay")!;
    buildStationView(TEST_STATION);
    renderStationView();

    // Now open as window (exact flow from docking/core.ts)
    const { openHudWindow } = await import("../src/ui/hud/windows.js");
    openHudWindow("station", TEST_STATION.name, contentEl);

    emit("station:open", { station: TEST_STATION });
    renderStep();

    // Card should be visible
    expect(tutorialState.root).not.toBeNull();
    expect(tutorialState.root!.style.display).toBe("block");
    expect(tutorialState.cardEl).not.toBeNull();
    expect(tutorialState.cardEl!.hidden).toBe(false);

    // Tour content should be visible
    expect(tutorialState.tourLabelEl!.style.display).toBe("block");
    expect(tutorialState.tourBodyEl!.style.display).toBe("block");

    // Dimmer should be active
    const dimmer = document.getElementById("st-dimmer");
    expect(dimmer).not.toBeNull();
    expect(dimmer!.classList.contains("active")).toBe(true);
  });

  it("shows card after expandHudWindow is called", async () => {
    initTutorial();
    initTutorialOverlay(true);

    Client.stationOpen = true;
    Client.activeStation = TEST_STATION;

    ensureStationUI();
    const contentEl = document.getElementById("station-overlay")!;
    buildStationView(TEST_STATION);
    renderStationView();

    const { openHudWindow, expandHudWindow } = await import("../src/ui/hud/windows.js");
    openHudWindow("station", TEST_STATION.name, contentEl);
    expandHudWindow("station");

    emit("station:open", { station: TEST_STATION });
    renderStep();

    expect(tutorialState.cardEl!.hidden).toBe(false);
    expect(tutorialState.root!.style.display).toBe("block");
  });

  it("positions card within viewport when window is expanded", async () => {
    initTutorial();
    initTutorialOverlay(true);

    Client.stationOpen = true;
    Client.activeStation = TEST_STATION;

    ensureStationUI();
    const contentEl = document.getElementById("station-overlay")!;
    buildStationView(TEST_STATION);
    renderStationView();

    const { openHudWindow, expandHudWindow } = await import("../src/ui/hud/windows.js");
    openHudWindow("station", TEST_STATION.name, contentEl);
    expandHudWindow("station");

    emit("station:open", { station: TEST_STATION });
    renderStep();

    // After expand, the window fills the viewport
    const win = document.getElementById("hud-win-station")!;
    expect(win.classList.contains("is-expanded")).toBe(true);

    // Card should still be positioned within the tutorial layer bounds
    const layer = document.getElementById("world-tutorial-layer")!;
    const card = tutorialState.root!;
    const layerRect = layer.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();

    expect(cardRect.left).toBeGreaterThanOrEqual(0);
    expect(cardRect.top).toBeGreaterThanOrEqual(0);
    expect(cardRect.right).toBeLessThanOrEqual(layerRect.right + 1);
    expect(cardRect.bottom).toBeLessThanOrEqual(layerRect.bottom + 1);
  });
});
