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

  it("clears transient input state from loaded saves", () => {
    const base = makePlayer();
    base.pilotName = "Waypoint Test";
    base.inputKeys = { space: true };
    base.inputMouseWorld = { x: 123, y: 456 };
    base.waypoint = { x: 1000, y: 2000 };
    base.navCommand = { mode: "orbit", targetId: "station-1", rangePx: 500, dir: 1 };
    base.netInputFrame = {
      tick: 42,
      keys: { space: true },
      mouseWorld: { x: 7, y: 8 },
      waypoint: { x: 9, y: 10 },
      navCommand: null,
      actions: [],
    };

    localStorage.setItem(SAVE_KEY, JSON.stringify(base));
    const p = loadPlayer();

    expect(p.pilotName).toBe("Waypoint Test");
    expect(p.inputKeys).toBeNull();
    expect(p.inputMouseWorld).toBeNull();
    expect(p.waypoint).toBeNull();
    expect(p.navCommand).toBeNull();
    expect(p.netInputFrame).toBeNull();
  });
});
