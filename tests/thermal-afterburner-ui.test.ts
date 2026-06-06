import { describe, expect, it, beforeEach } from "vitest";
import { _G as G } from "../src/state.js";
import { makePlayer } from "../src/player/player-data.js";
import { renderStatsTabHTML } from "../src/ui/hud/ship-panel/stats.js";
import { STRINGS } from "../src/data/strings.js";

describe("thermal afterburner UI", () => {
  beforeEach(() => {
    G.P = makePlayer();
  });

  it("renders thermal reserve and afterburner coupling controls in the ship panel", () => {
    G.P.shipHeat = 0.64;
    G.P.fitting.med[0] = "start-me-ab1";
    G.P.slotActive.med[0] = true;

    const host = document.createElement("div");
    host.innerHTML = renderStatsTabHTML();

    expect(host.querySelector("#sp-bar-heat")).toBeTruthy();
    expect(host.querySelector("#sp-cur-heat")?.textContent).toBe("64");
    expect(host.querySelector("#sp-cur-ab-coupling")?.textContent).toBe("ONLINE");
    expect(host.querySelector("#sp-cur-thermal-bonus")?.textContent).toBe("+18%");
  });

  it("uses positive boost labels instead of lockout language", () => {
    const labels = [
      STRINGS.en["hud.boostReady"],
      STRINGS.en["hud.boostCold"],
      STRINGS.en["hud.boostThermal"],
      STRINGS.en["hud.boostDumping"],
    ];

    expect(labels).toEqual(["READY", "COLD", "THERMAL", "DUMPING"]);
    expect(Object.values(STRINGS.en)).not.toContain("LOCKOUT");
  });
});
