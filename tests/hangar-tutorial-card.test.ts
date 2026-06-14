import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { _G as G, Client } from "../src/state.js";
import { makePlayer } from "../src/player/player-data.js";
import { installTestPlayer } from "../src/player-registry.js";
import { TUTORIAL_STEPS } from "../src/data/tutorial.js";
import { initTutorial, getTutorialSnapshot } from "../src/tutorial/index.js";
import { initTutorialOverlay } from "../src/tutorial/ui/init.js";
import { tutorialState } from "../src/tutorial/ui/state.js";
import { renderStep } from "../src/tutorial/ui/render.js";
import { emit } from "../src/events.js";

describe("hangar tutorial card", () => {
  beforeEach(() => {
    installTestPlayer(makePlayer());
    G.P.tutorial.active = true;
    G.P.tutorial.step = TUTORIAL_STEPS.findIndex((s) => s.id === "hangar-high");

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

  it("shows the tutorial card with content after docking in hangar-high step", () => {
    initTutorial();
    initTutorialOverlay(true);

    Client.stationOpen = true;
    emit("station:open", { station: { id: "test", name: "Test", x: 0, y: 0, radius: 100, spin: 0, isHome: false, services: ["market", "repair"], safeRadius: 200, turrets: [] } });

    // Manually trigger renderStep as the event handler would
    renderStep();

    const card = tutorialState.cardEl;
    expect(card).not.toBeNull();
    expect(card!.hidden).toBe(false);

    const title = tutorialState.titleEl;
    expect(title).not.toBeNull();
    expect(title!.textContent).toBeTruthy();

    const objective = tutorialState.objectiveEl;
    expect(objective).not.toBeNull();
    expect(objective!.innerHTML).toBeTruthy();

    // Tour label and body should be visible for a station tour
    const tourLabel = tutorialState.tourLabelEl;
    const tourBody = tutorialState.tourBodyEl;
    expect(tourLabel).not.toBeNull();
    expect(tourBody).not.toBeNull();

    // snapshot should have the tour initialized
    const snapshot = getTutorialSnapshot();
    expect(snapshot.hangarReviewPhase).toBe(0);
  });

  it("shows the tour next button when the tour can advance", () => {
    initTutorial();
    initTutorialOverlay(true);

    Client.stationOpen = true;
    emit("station:open", { station: { id: "test", name: "Test", x: 0, y: 0, radius: 100, spin: 0, isHome: false, services: ["market", "repair"], safeRadius: 200, turrets: [] } });
    renderStep();

    expect(tutorialState.tourNextBtn).not.toBeNull();
    expect(tutorialState.tourNextBtn!.hidden).toBe(false);
  });
});
