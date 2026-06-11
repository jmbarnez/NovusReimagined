import { describe, it, expect, beforeEach } from "vitest";
import { Client } from "../src/state.js";
import { makePlayer } from "../src/player/player-data.js";
import { installTestPlayer } from "../src/player-registry.js";
import { getTourPanel, getTutorialStepObjective } from "../src/data/tutorial.js";
import { tutorialKeyStyled, tutorialBarKeyStyled } from "../src/data/tutorial-controls.js";
import { stepById } from "./tutorial-helpers.js";

describe("styled keybind helpers", () => {
  it("tutorialKeyStyled wraps keybind in a span", () => {
    const result = tutorialKeyStyled("brake");
    expect(result).toMatch(/<span class="tutorial-keybind">/);
    expect(result).toMatch(/<\/span>/);
  });

  it("tutorialBarKeyStyled wraps bar slot in a span", () => {
    const result = tutorialBarKeyStyled(0);
    expect(result).toMatch(/<span class="tutorial-keybind">1<\/span>/);
  });

  it("renders keybinds as styled markup in step objectives", () => {
    installTestPlayer(makePlayer());
    const industry = stepById("industry");
    const obj = getTutorialStepObjective(industry, {});
    expect(obj).toContain('<span class="tutorial-keybind">');
  });

  it("returns a refinery tour panel for the industry step", () => {
    Client.stationOpen = true;
    const tour = getTourPanel(stepById("industry"), { refineryGuidePhase: 0 });
    expect(tour?.label).toContain("Refining");
    expect(tour?.index).toBe(1);
    Client.stationOpen = false;
  });
});
