import { afterEach, describe, expect, it } from "vitest";
import { ensureSettingsUI, settingsContentHTML } from "../src/ui/settings/shell.js";
import { ensureStationUI } from "../src/ui/station/shell.js";

describe("Preact UI shells", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders the settings shell with stable imperative mount points", () => {
    ensureSettingsUI();

    const overlay = document.getElementById("settings-overlay");
    expect(overlay).toBeInstanceOf(HTMLElement);
    expect(overlay?.querySelector("#settings-panel")).toBeInstanceOf(HTMLElement);
    expect(overlay?.querySelector("#sfx-volume")).toBeInstanceOf(HTMLInputElement);
    expect(overlay?.querySelector("#settings-save")).toBeInstanceOf(HTMLButtonElement);
    expect(overlay?.querySelectorAll(".settings-tab")).toHaveLength(4);
    expect(document.getElementById("settings-tooltip-bubble")).toBeInstanceOf(HTMLElement);
  });

  it("keeps settingsContentHTML available during the shell migration", () => {
    const html = settingsContentHTML();

    expect(html).toContain("settings-tabs");
    expect(html).toContain("settings-body");
    expect(html).toContain("settings-footer");
  });

  it("renders the station shell with stable panel targets", () => {
    ensureStationUI();

    const overlay = document.getElementById("station-overlay");
    expect(overlay).toBeInstanceOf(HTMLElement);
    expect(overlay?.querySelector("#st-undock")).toBeInstanceOf(HTMLButtonElement);
    expect(overlay?.querySelectorAll(".st-tab")).toHaveLength(5);
    expect(overlay?.querySelector("#panel-hangar")).toBeInstanceOf(HTMLElement);
    expect(overlay?.querySelector("#panel-market")).toBeInstanceOf(HTMLElement);
    expect(overlay?.querySelector("#panel-industry")).toBeInstanceOf(HTMLElement);
    expect(overlay?.querySelector("#panel-fabrication")).toBeInstanceOf(HTMLElement);
    expect(overlay?.querySelector("#panel-contracts")).toBeInstanceOf(HTMLElement);
  });
});
