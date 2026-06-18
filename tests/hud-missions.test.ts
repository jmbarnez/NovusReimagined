import { beforeEach, describe, expect, it } from "vitest";
import { Client, _G as G } from "../src/state.js";
import { makePlayer } from "../src/player/player-data.js";
import { installTestPlayer } from "../src/player-registry.js";
import { PlayerAccess } from "../src/state-access.js";
import { initMissionsPanel, updateMissionsPanel } from "../src/ui/hud-missions.js";
import { initTutorial } from "../src/tutorial/index.js";

describe("HUD missions panel", () => {
  beforeEach(() => {
    installTestPlayer(makePlayer());
    initTutorial();
    Client.stationOpen = false;
  });

  it("renders missions into the mounted HUD element", () => {
    const mount = document.createElement("div");
    mount.id = "hud-missions";
    document.body.appendChild(mount);

    initMissionsPanel(mount);
    updateMissionsPanel();

    expect(mount.querySelector(".hm-contract")).not.toBeNull();
    expect(mount.textContent).toContain("Getting Started");
    mount.remove();
  });

  it("rebinds to a fresh HUD element after the old panel is removed", () => {
    const staleMount = document.createElement("div");
    staleMount.id = "hud-missions";
    document.body.appendChild(staleMount);
    initMissionsPanel(staleMount);
    staleMount.remove();

    const freshMount = document.createElement("div");
    freshMount.id = "hud-missions";
    document.body.appendChild(freshMount);
    initMissionsPanel(freshMount);
    updateMissionsPanel();

    expect(freshMount.querySelector(".hm-contract")).not.toBeNull();
    expect(G.P.contracts.length).toBeGreaterThan(0);
    freshMount.remove();
  });

  it("updates progress when the tutorial step advances", () => {
    const mount = document.createElement("div");
    mount.id = "hud-missions";
    document.body.appendChild(mount);
    initMissionsPanel(mount);
    updateMissionsPanel();

    expect(mount.textContent).toContain("0/3");

    PlayerAccess.setTutorialStep(1);
    updateMissionsPanel();

    expect(mount.textContent).toContain("1/3");
    mount.remove();
  });
});
