import { beforeEach, describe, expect, it } from "vitest";
import { Client, _G as G } from "../src/state.js";
import { makePlayer } from "../src/player/player-data.js";
import { installTestPlayer } from "../src/player-registry.js";
import { initMissionsPanel, updateMissionsPanel } from "../src/ui/hud-missions.js";

describe("HUD missions panel", () => {
  beforeEach(() => {
    installTestPlayer(makePlayer());
    Client.stationOpen = false;
  });

  it("renders missions into the mounted HUD element", () => {
    const mount = document.createElement("div");
    mount.id = "hud-missions";
    document.body.appendChild(mount);

    initMissionsPanel(mount);
    updateMissionsPanel();

    expect(mount.querySelector(".hm-contract")).not.toBeNull();
    expect(mount.textContent).toContain("Academy Training");
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
});
