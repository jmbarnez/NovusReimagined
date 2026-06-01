import { beforeEach, describe, expect, it } from "vitest";
import { _G } from "../src/state.js";
import { makePlayer } from "../src/player/player-data.js";
import { renderHangar } from "../src/ui/station/hangar.js";
import { stationState } from "../src/ui/station/shared.js";
import { invalidate } from "../src/player/player-stats.js";

describe("hangar hardpoint rendering", () => {
  beforeEach(() => {
    _G.P = makePlayer() as typeof _G.P;
    stationState.previewFitting = null;
    document.body.innerHTML = `<div id="panel-hangar"></div>`;
    invalidate(_G.P);
  });

  it("offers turret modules in unified high slots and hides empty turret sections", () => {
    _G.P.fitting.high[0] = null;

    renderHangar();

    const panel = document.getElementById("panel-hangar");
    expect(panel).not.toBeNull();
    expect(panel?.textContent).not.toContain("Turret Slots");
    const select = panel?.querySelector("#sel-high-0") as HTMLSelectElement | null;
    expect(select).not.toBeNull();
    const optionValues = Array.from(select!.options).map((option) => option.value);
    expect(optionValues).toContain("start-tu-civ-cannon");
  });
});
