import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { _G as G, Client } from "../src/state.js";
import { makePlayer } from "../src/player/player-data.js";
import { installTestPlayer } from "../src/player-registry.js";
import { TUTORIAL_STEPS, getCurrentTutorialStep } from "../src/data/tutorial.js";
import { getCardAnchorHighlight } from "../src/tutorial/ui/spotlight.js";
import { clearTutorialVisuals } from "../src/tutorial/ui/visuals.js";
import { tutorialState } from "../src/tutorial/ui/state.js";

describe("hud tutorial dimmer cleanup", () => {
  beforeEach(() => {
    installTestPlayer(makePlayer());
    G.P.tutorial.active = true;
    tutorialState.visible = true;
    Client.stationOpen = false;
    clearTutorialVisuals();
    document.body.innerHTML = "";
    const overlay = document.createElement("div");
    overlay.id = "hud-overlay";
    for (const id of [
      "hud-status-bars",
      "hud-slots",
      "hud-lock-rail",
      "hud-scanner-dock",
      "hud-log-panel",
      "hud-missions",
      "hud-dock-prompt",
    ]) {
      const el = document.createElement("div");
      el.id = id;
      overlay.appendChild(el);
    }
    const hudDimmer = document.createElement("div");
    hudDimmer.id = "hud-tour-dimmer";
    hudDimmer.className = "hidden";
    overlay.appendChild(hudDimmer);
    document.body.appendChild(overlay);
  });

  afterEach(() => {
    clearTutorialVisuals();
    tutorialState.visible = false;
    document.body.innerHTML = "";
  });

  function setStep(id: string) {
    G.P.tutorial.step = TUTORIAL_STEPS.findIndex((s) => s.id === id);
  }

  it("anchors the card to any highlighted element", () => {
    setStep("boost-try");
    const statusBars = document.getElementById("hud-status-bars")!;
    statusBars.classList.add("hud-highlight");

    const step = getCurrentTutorialStep(G.P);
    expect(getCardAnchorHighlight()).toBe(statusBars);
  });
});
