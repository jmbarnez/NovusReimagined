import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { _G as G, Client } from "../src/state.js";
import { makePlayer } from "../src/player/player-data.js";
import { installTestPlayer } from "../src/player-registry.js";
import { TUTORIAL_STEPS } from "../src/data/tutorial.js";
import { initTutorial } from "../src/tutorial/index.js";
import { initTutorialOverlay } from "../src/tutorial/ui/init.js";
import { tutorialState } from "../src/tutorial/ui/state.js";
import { renderStep } from "../src/tutorial/ui/render.js";
import { emit } from "../src/events.js";
import { openHudWindow, closeHudWindow } from "../src/ui/hud/windows.js";

describe("hangar tutorial with HUD window", () => {
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
  });

  afterEach(() => {
    Client.stationOpen = false;
    tutorialState.layerEl = null;
    tutorialState.root = null;
    tutorialState.cardEl = null;
    Client.bridgeWindowZ = 220;
  });

  function makeStationOverlay(): HTMLElement {
    const el = document.createElement("div");
    el.id = "station-overlay";
    el.innerHTML = `
      <div class="st-win-head">
        <span class="st-win-meta" id="st-meta"></span>
        <span class="st-win-wallet"><span id="st-cr"></span></span>
        <button id="st-undock">Undock</button>
      </div>
      <nav id="st-tabs">
        <button class="st-tab active" data-tab="hangar">Hangar</button>
      </nav>
      <main id="st-body">
        <div class="panel active" id="panel-hangar">
          <div id="hangar-pane-cargo"></div>
          <div id="hangar-fitting-panel"></div>
          <div id="hangar-slot-high-0"></div>
          <div id="hangar-stats-panel"></div>
          <div id="hangar-missions-panel"></div>
        </div>
      </main>
      <div id="st-dimmer"></div>
    `;
    document.body.appendChild(el);
    return el;
  }

  it("shows tutorial card after opening station in a HUD window", () => {
    initTutorial();
    initTutorialOverlay(true);

    const contentEl = makeStationOverlay();
    Client.stationOpen = true;
    openHudWindow("station", "Test Station", contentEl);

    emit("station:open", { station: { id: "test", name: "Test", x: 0, y: 0, radius: 100, spin: 0, isHome: false, services: ["market", "repair"], safeRadius: 200, turrets: [] } });
    renderStep();

    expect(tutorialState.root).not.toBeNull();
    expect(tutorialState.root!.style.display).toBe("block");
    expect(tutorialState.cardEl).not.toBeNull();
    expect(tutorialState.cardEl!.hidden).toBe(false);
  });

  it("survives closing and reopening the station window", () => {
    initTutorial();
    initTutorialOverlay(true);

    // First open
    const contentEl = makeStationOverlay();
    Client.stationOpen = true;
    openHudWindow("station", "Test Station", contentEl);
    emit("station:open", { station: { id: "test", name: "Test", x: 0, y: 0, radius: 100, spin: 0, isHome: false, services: ["market", "repair"], safeRadius: 200, turrets: [] } });
    renderStep();

    expect(tutorialState.cardEl!.hidden).toBe(false);

    // Close window
    closeHudWindow("station");
    Client.stationOpen = false;
    emit("station:close");
    renderStep();

    // Reopen window
    Client.stationOpen = true;
    openHudWindow("station", "Test Station", contentEl);
    emit("station:open", { station: { id: "test", name: "Test", x: 0, y: 0, radius: 100, spin: 0, isHome: false, services: ["market", "repair"], safeRadius: 200, turrets: [] } });
    renderStep();

    expect(tutorialState.cardEl!.hidden).toBe(false);
    expect(tutorialState.root!.style.display).toBe("block");
  });
});
