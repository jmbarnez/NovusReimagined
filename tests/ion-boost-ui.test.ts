import { beforeEach, describe, expect, it } from "vitest";
import { _G as G } from "../src/state.js";
import { makePlayer } from "../src/player/player-data.js";
import { renderStatsTabHTML } from "../src/ui/hud/ship-panel/stats.js";
import { STRINGS } from "../src/data/strings.js";

describe("ion boost UI", () => {
  beforeEach(() => {
    G.P = makePlayer();
  });

  it("renders ion boost module status in the ship panel", () => {
    G.P.fitting.med[0] = "start-me-ab1";
    G.P.slotActive.med[0] = true;

    const host = document.createElement("div");
    host.innerHTML = renderStatsTabHTML();

    expect(host.querySelector("#sp-cur-boost-module")?.textContent).toBe("ONLINE");
    expect(host.querySelector("#sp-cur-boost-stats")?.textContent).toBe("1.43x / 1.20x");
    expect(host.querySelector("#sp-cur-boost-cap")?.textContent).toBe("12.6 GJ/s");
    expect(host.textContent).toContain("Ion Boost Module");
  });

  it("uses cap-only boost labels without thermal reserve wording", () => {
    expect(STRINGS.en["hud.boostReady"]).toBe("READY");
    expect(STRINGS.en["hud.boostActive"]).toBe("BOOST");
    expect(STRINGS.en["hud.boostLowCap"]).toBe("LOW CAP");
    expect(STRINGS.en["hud.boostOffline"]).toBeUndefined();
    expect(Object.values(STRINGS.en)).not.toContain("Thermal Reserve");
  });
});
