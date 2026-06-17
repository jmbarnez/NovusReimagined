import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { _G as G, Client } from "../src/state.js";
import { makePlayer } from "../src/player/player-data.js";
import { updateGateActivation } from "../src/docking/warp.js";
import type { Gate } from "../src/types/station.js";
import type { System } from "../src/types/system.js";

function isPreWarpVisualActive(warpTargetIdx: number | undefined, warpCooldown: number | undefined): boolean {
  return (warpTargetIdx ?? -1) >= 0 || ((warpCooldown ?? 0) > 2.0 && (warpCooldown ?? 0) <= 4.8);
}

function makeSys(gates: Gate[]): System {
  return {
    idx: 0,
    id: "sys-0",
    name: "Test System",
    security: 1.0,
    mapX: 0,
    mapY: 0,
    ring: 0,
    links: [],
    _ready: true,
    asteroids: [],
    enemies: [],
    gates,
    stations: [],
    planets: [],
    nebulaHues: [200, 220, 240],
    starHue: 200,
  };
}

describe("warp gate hold-to-charge", () => {
  const originalGalaxy = G.GALAXY;
  const originalPlayer = G.P;
  const originalKeys = { ...Client.keys };

  beforeEach(() => {
    G.GALAXY = [];
    G.P = makePlayer();
    Client.keys = {};
  });

  afterEach(() => {
    G.GALAXY = originalGalaxy;
    G.P = originalPlayer;
    Client.keys = originalKeys;
  });

  it("starts charging when holding G in range without a sensor lock", () => {
    const gate: Gate = {
      id: "gate-test",
      x: 100,
      y: 0,
      px: 100,
      py: 0,
      target: { kind: "local", x: 0, y: 0, label: "Academy" },
      radius: 30,
      activationRadius: 60,
      spin: 0,
    };
    G.GALAXY = [makeSys([gate])];

    const p = G.P;
    p.sysIdx = 0;
    p.x = 100;
    p.y = 0;
    p.targetLock = null;
    p.warpCooldown = 0;
    p.inputKeys = { space: false, w: false, a: false, s: false, d: false, boost: false, warp: true };
    Client.keys["warp"] = false;

    updateGateActivation(0.5, p);

    expect(gate.gateState).toBe("charging");
    expect(gate.chargeProgress).toBeGreaterThan(0);
  });

  it("does not charge when out of range even if holding G", () => {
    const gate: Gate = {
      id: "gate-test",
      x: 1000,
      y: 0,
      px: 1000,
      py: 0,
      target: { kind: "local", x: 0, y: 0, label: "Academy" },
      radius: 30,
      activationRadius: 60,
      spin: 0,
    };
    G.GALAXY = [makeSys([gate])];

    const p = G.P;
    p.sysIdx = 0;
    p.x = 0;
    p.y = 0;
    p.targetLock = null;
    p.warpCooldown = 0;
    p.inputKeys = { space: false, w: false, a: false, s: false, d: false, boost: false, warp: true };

    updateGateActivation(0.5, p);

    expect(gate.gateState).toBe("dormant");
    expect(gate.chargeProgress).toBe(0);
  });

  it("charges at the outer visible ring radius (2.0x gate radius)", () => {
    const gate: Gate = {
      id: "gate-test",
      x: 100,
      y: 0,
      px: 100,
      py: 0,
      target: { kind: "local", x: 0, y: 0, label: "Academy" },
      radius: 30,
      activationRadius: 60,
      spin: 0,
    };
    G.GALAXY = [makeSys([gate])];

    const p = G.P;
    p.sysIdx = 0;
    p.x = 158;
    p.y = 0;
    p.targetLock = null;
    p.warpCooldown = 0;
    p.inputKeys = { space: false, w: false, a: false, s: false, d: false, boost: false, warp: true };

    updateGateActivation(0.5, p);

    expect(gate.gateState).toBe("charging");
    expect(gate.chargeProgress).toBeGreaterThan(0);
  });

  it("activates warp when charge reaches 1.0", () => {
    const gate: Gate = {
      id: "gate-test",
      x: 100,
      y: 0,
      px: 100,
      py: 0,
      target: { kind: "local", x: 0, y: 0, label: "Academy" },
      radius: 30,
      activationRadius: 60,
      spin: 0,
    };
    G.GALAXY = [makeSys([gate])];

    const p = G.P;
    p.sysIdx = 0;
    p.x = 100;
    p.y = 0;
    p.targetLock = null;
    p.warpCooldown = 0;
    p.inputKeys = { space: false, w: false, a: false, s: false, d: false, boost: false, warp: true };
    Client.keys["warp"] = false;

    // Charge time is 2.0 seconds; tick with dt=2.0 to complete in one call
    updateGateActivation(2.0, p);

    expect(gate.gateState).toBe("cooldown");
    expect(gate.chargeProgress).toBe(1);
  });

  it("marks local-gate warp cooldown as pre-warp visual active", () => {
    expect(isPreWarpVisualActive(-1, 4.8)).toBe(true);
    expect(isPreWarpVisualActive(-1, 3.5)).toBe(true);
    expect(isPreWarpVisualActive(-1, 2.0)).toBe(false);
  });
});
