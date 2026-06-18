import { describe, it, expect, beforeEach } from "vitest";
import { validatePilotName, loadPlayer, makePlayer } from "../src/player/player-data.js";
import { getPlayerInputKeys } from "../src/player/input-state.js";
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
    base.netInputFrame = {
      tick: 42,
      keys: { space: true, w: false, a: true, s: false, d: true, boost: true, warp: false },
      mouseWorld: { x: 7, y: 8 },
      actions: [],
    };

    localStorage.setItem(SAVE_KEY, JSON.stringify(base));
    const p = loadPlayer();

    expect(p.pilotName).toBe("Waypoint Test");
    expect(getPlayerInputKeys(p.netId ?? p.shipId)).toEqual({ space: false, w: false, a: false, s: false, d: false, boost: false, warp: false, lmb: false });
    expect(p.netInputFrame).toBeNull();
  });
});
