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
import { advanceTour, canAdvanceTour } from "../src/tutorial/logic/index.js";

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
              <button id="st-undock">Undock</button>
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
    expect(objective!.style.display).toBe("none");

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

  it("sets tutorial layer z-index above high bridgeWindowZ when docked", () => {
    initTutorial();
    initTutorialOverlay(true);

    Client.stationOpen = true;
    Client.bridgeWindowZ = 500;
    emit("station:open", { station: { id: "test", name: "Test", x: 0, y: 0, radius: 100, spin: 0, isHome: false, services: ["market", "repair"], safeRadius: 200, turrets: [] } });
    renderStep();

    const layer = tutorialState.layerEl;
    expect(layer).not.toBeNull();
    const zIndex = parseInt(layer!.style.zIndex, 10);
    expect(zIndex).toBeGreaterThan(Client.bridgeWindowZ);
    expect(zIndex).toBeGreaterThanOrEqual(290);
  });

  it("renders the undock tour panel after advancing through all phases", () => {
    initTutorial();
    initTutorialOverlay(true);

    Client.stationOpen = true;
    emit("station:open", { station: { id: "test", name: "Test", x: 0, y: 0, radius: 100, spin: 0, isHome: false, services: ["market", "repair"], safeRadius: 200, turrets: [] } });
    renderStep();

    const snapshot = getTutorialSnapshot();
    expect(snapshot.hangarReviewPhase).toBe(0);

    // Advance through phases 0 → 1 → 2 → 3 → 4 → 5 (undock)
    for (let i = 0; i < 5; i++) {
      expect(canAdvanceTour()).toBe(true);
      advanceTour();
      renderStep();
      expect(snapshot.hangarReviewPhase).toBe(i + 1);
    }

    // We should now be on phase 5 (undock)
    expect(snapshot.hangarReviewPhase).toBe(5);
    expect(snapshot.hangarReviewComplete).toBe(true);
    expect(canAdvanceTour()).toBe(false);

    // Card should still be visible
    expect(tutorialState.cardEl!.hidden).toBe(false);

    // Tour label should show the undock panel content
    expect(tutorialState.tourLabelEl!.style.display).toBe("block");
    expect(tutorialState.tourLabelEl!.textContent).toMatch(/Undock/);

    // Tour body should show the undock panel content
    expect(tutorialState.tourBodyEl!.style.display).toBe("block");
    expect(tutorialState.tourBodyEl!.textContent).toMatch(/undock/i);

    // On the final phase, the tour next button hides and the main next button shows
    expect(tutorialState.tourNextBtn!.hidden).toBe(true);
    expect(tutorialState.nextBtn!.hidden).toBe(false);
  });
});
