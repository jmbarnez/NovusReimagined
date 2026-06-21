import { describe, expect, it } from "vitest";
import { makePlayer } from "../src/player/player-data.js";
import { executeGameCommand } from "../src/sim/commands.js";
import { createDurableCharacterSync, createServerPlayerState } from "../src/server/player-sanitize.js";
import { buildGalaxy } from "../src/world-gen.js";

describe("createServerPlayerState", () => {
  it("uses server identity and resets transient runtime state", () => {
    const incoming = makePlayer();
    incoming.netId = "spoofed";
    incoming.pilotName = "Ace Pilot";
    incoming.vx = 999;
    incoming.vy = -999;

    incoming.boostLockout = true;
    incoming.netInputFrame = {
      tick: 7,
      keys: { space: true },
      mouseWorld: { x: 1, y: 2 },
      waypoint: null,
      navCommand: null,
      actions: [],
    };

    const sanitized = createServerPlayerState("client_real", "Fallback", incoming, buildGalaxy());

    expect(sanitized.netId).toBe("client_real");
    expect(incoming.netId).toBe("spoofed");
    expect(sanitized.pilotName).toBe("Ace Pilot");
    expect(sanitized.vx).toBe(0);
    expect(sanitized.vy).toBe(0);

    expect(sanitized.netInputFrame).toBeNull();
    expect(sanitized.boostLockout).toBe(false);
  });

  it("clamps invalid vitals and falls back from invalid names", () => {
    const incoming = makePlayer();
    incoming.pilotName = "!";
    incoming.hp = 999_999;
    incoming.structure = -50;
    incoming.x = Number.POSITIVE_INFINITY;

    const sanitized = createServerPlayerState("client_real", "?", incoming, buildGalaxy());

    expect(sanitized.pilotName).toBe("Pilot");
    expect(sanitized.hp).toBe(sanitized.maxHp);
    expect(sanitized.structure).toBe(0);
    expect(Number.isFinite(sanitized.x)).toBe(true);
  });

  it("strips session and runtime state from disconnect sync", () => {
    const p = makePlayer();
    p.netId = "client_real";
    p.vx = 12;

    p.miningLaser = { active: true, x1: 0, y1: 0, x2: 1, y2: 1, phase: 1, hitR: 5, hitNx: 1, hitNy: 0 };

    const sync = createDurableCharacterSync(p);

    expect(sync.netId).toBeUndefined();
    expect(sync.vx).toBe(0);

    expect(sync.miningLaser).toBeNull();
  });

  it("preserves mixed ore cargo during sanitization", () => {
    const incoming = makePlayer();
    incoming.mixedOreCargo = [
      { name: "Ferro-nickel Chunk", qty: 6, richness: 2.4, composition: { iron: 0.7, nickel: 0.3 } },
    ];

    const sanitized = createServerPlayerState("client_real", "Pilot One", incoming, buildGalaxy());

    expect(sanitized.mixedOreCargo).toHaveLength(1);
    expect(sanitized.mixedOreCargo[0]!.name).toBe("Ferro-nickel Chunk");
    expect(sanitized.mixedOreCargo[0]!.qty).toBe(6);
    expect(sanitized.mixedOreCargo[0]!.richness).toBe(2.4);
    expect(sanitized.mixedOreCargo[0]!.composition).toEqual({ iron: 0.7, nickel: 0.3 });
  });

  it("selects hardpoint fire slot after connect sanitization", () => {
    const incoming = makePlayer();
    incoming.fitting.high[0] = "start-tu-civ-cannon";
    const sanitized = createServerPlayerState("client_real", "Pilot One", incoming, buildGalaxy());

    executeGameCommand({ type: "toggleSlotDefaultAction", payload: { rack: "high", idx: 0 } }, sanitized);

    expect(sanitized.fireControlSlot).toBe(0);
  });

  it("migrates legacy turret fits into unified high hardpoints during sanitization", () => {
    const incoming = makePlayer();
    incoming.shipId = "fighter";
    incoming.fitting = {
      turret: ["legacy-tu-1", "legacy-tu-2"],
      high: ["legacy-hi-1", "legacy-hi-2"],
      med: [null, null],
      low: [null, null, null],
    };
    incoming.moduleHp = {
      turret: [25, 40],
      high: [70, 85],
      med: [null, null],
      low: [null, null, null],
    };
    const sanitized = createServerPlayerState("client_real", "Pilot One", incoming, buildGalaxy());

    expect(sanitized.fitting.turret).toEqual([]);
    expect(sanitized.fitting.high).toEqual(["legacy-hi-1", "legacy-hi-2", "legacy-tu-1", "legacy-tu-2"]);
    expect(sanitized.moduleHp.high).toEqual([70, 85, 25, 40]);
  });
});
