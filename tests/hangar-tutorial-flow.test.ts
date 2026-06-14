import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { _G as G, Client } from "../src/state.js";
import { makePlayer } from "../src/player/player-data.js";
import { installTestPlayer } from "../src/player-registry.js";
import { TUTORIAL_STEPS } from "../src/data/tutorial.js";
import { initTutorial, getTutorialSnapshot } from "../src/tutorial/index.js";
import { initTutorialOverlay } from "../src/tutorial/ui/setup.js";
import { tutorialState } from "../src/tutorial/ui/state.js";
import { renderStep } from "../src/tutorial/ui/render.js";
import { emit } from "../src/events.js";
import { advanceStep } from "../src/tutorial/logic/lifecycle.js";
import { syncTutorialVisuals } from "../src/tutorial/ui/visuals.js";

describe("hangar tutorial docked flow", () => {
  beforeEach(() => {
    installTestPlayer(makePlayer());
    G.P.tutorial.active = true;
    // Start at fly-academy
    G.P.tutorial.step = TUTORIAL_STEPS.findIndex((s) => s.id === "fly-academy");

    document.body.innerHTML = `
      <div id="world-tutorial-layer"></div>
      <div id="bridge-overlay" style="display:block">
        <div id="bridge-workspace">
          <div class="window window-station">
            <div id="station-overlay">
              <button class="st-tab active" data-tab="hangar"></button>
              <div id="panel-hangar" class="panel active">
                <div id="hangar-pane-cargo"></div>
                <div id="hangar-fitting-panel"></div>
                <div id="hangar-slot-high-0"></div>
                <div id="hangar-stats-panel"></div>
                <div id="hangar-missions-panel"></div>
              </div>
              <div id="st-dimmer"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  });

  afterEach(() => {
    Client.stationOpen = false;
    tutorialState.layerEl = null;
    tutorialState.root = null;
    tutorialState.cardEl = null;
  });

  it("shows the hangar tutorial card after docking and advancing from fly-academy", () => {
    initTutorial();
    initTutorialOverlay(true);

    // Dock during fly-academy
    Client.stationOpen = true;
    emit("station:open", { station: { id: "test", name: "Test", x: 0, y: 0, radius: 100, spin: 0, isHome: false, services: ["market", "repair"], safeRadius: 200, turrets: [] } });
    renderStep();

    // fly-academy now shows the card when docked because the step is complete
    expect(tutorialState.root!.style.display).toBe("block");

    // Now advance to hangar-high (as if user pressed Next while undocked, then redocked)
    G.P.tutorial.step = TUTORIAL_STEPS.findIndex((s) => s.id === "hangar-high");
    initTutorial();

    // Card should now show because hangar-high is station-relevant
    renderStep();
    expect(tutorialState.root!.style.display).toBe("block");
    expect(tutorialState.cardEl!.hidden).toBe(false);

    // The tour label and body should be visible
    expect(tutorialState.tourLabelEl!.style.display).toBe("block");
    expect(tutorialState.tourBodyEl!.style.display).toBe("block");

    // Tour next button should be visible
    expect(tutorialState.tourNextBtn!.hidden).toBe(false);
  });

  it("renders station dimmer and highlight even when tutorial card is hidden", () => {
    initTutorial();
    initTutorialOverlay(true);

    // Set to hangar-high but simulate a state where shouldShowTutorialLayer is false
    G.P.tutorial.step = TUTORIAL_STEPS.findIndex((s) => s.id === "hangar-high");
    initTutorial();

    Client.stationOpen = true;
    renderStep();

    // Trigger visuals directly as renderStationView does
    syncTutorialVisuals();

    const dimmer = document.getElementById("st-dimmer")!;
    expect(dimmer.classList.contains("active")).toBe(true);

    const target = document.getElementById("hangar-pane-cargo")!;
    expect(target.classList.contains("tutorial-hangar-highlight")).toBe(true);
  });
});
