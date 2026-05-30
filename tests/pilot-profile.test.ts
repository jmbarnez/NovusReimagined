import { describe, it, expect, beforeEach } from "vitest";
import { validatePilotName, loadPlayer, makePlayer } from "../src/player/player-data.js";
import { SAVE_KEY } from "../src/constants.js";
import { WorldAccess } from "../src/state-access.js";

describe("validatePilotName", () => {
  it("accepts a valid callsign", () => {
    const r = validatePilotName("  Nova_7  ");
    expect(r.ok).toBe(true);
    expect(r.name).toBe("Nova_7");
  });

  it("rejects too short names", () => {
    const r = validatePilotName("ab");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/at least/i);
  });

  it("rejects invalid characters", () => {
    const r = validatePilotName("bad@name");
    expect(r.ok).toBe(false);
  });
});

describe("loadPlayer pilotName migration", () => {
  beforeEach(() => {
    localStorage.clear();
    WorldAccess.initPlayer(makePlayer());
  });

  it("defaults missing pilotName to empty string", () => {
    const base = makePlayer();
    delete (base as { pilotName?: string }).pilotName;
    localStorage.setItem(SAVE_KEY, JSON.stringify(base));
    const p = loadPlayer();
    expect(p.pilotName).toBe("");
  });

  it("preserves saved pilotName", () => {
    const raw = JSON.stringify({
      shipId: "scout",
      pilotName: "Stellar Fox",
      skillXp: { gunnery: 900 },
      skills: { ballistics: 0, beam_weapons: 0, missile_guidance: 0 },
      fitting: { turret: [], high: [null, null], med: [null], low: [null] },
    });
    localStorage.setItem(SAVE_KEY, raw);
    const p = loadPlayer();
    expect(p.pilotName).toBe("Stellar Fox");
  });
});
