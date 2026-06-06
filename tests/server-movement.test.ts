import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GameServer } from "../src/server/server.js";
import { makePlayer } from "../src/player/player-data.js";
import type { Player } from "../src/state.js";
import type { InputFrame } from "../src/sim/input.js";

function movementFrame(tick: number, x: number, y: number): InputFrame {
  return {
    tick,
    keys: { space: false, w: false, a: false, s: false, d: false, boost: false },
    mouseWorld: { x, y },
    waypoint: { x, y },
    navCommand: null,
    movementControlMode: "waypoint",
    actions: [],
  };
}

function directFrame(tick: number, keys: InputFrame["keys"]): InputFrame {
  return {
    tick,
    keys,
    mouseWorld: { x: 0, y: 0 },
    waypoint: null,
    navCommand: null,
    movementControlMode: "direct",
    actions: [],
  };
}

const DIRECT_IDLE_KEYS: InputFrame["keys"] = { space: false, w: false, a: false, s: false, d: false, boost: false };
const DIRECT_FORWARD_KEYS: InputFrame["keys"] = { space: false, w: true, a: false, s: false, d: false, boost: false };
const DIRECT_BOOST_KEYS: InputFrame["keys"] = { space: false, w: true, a: false, s: false, d: false, boost: true };

describe("GameServer movement input", () => {
  let server: GameServer;

  beforeEach(() => {
    server = new GameServer(() => {});
    server.start();
  });

  afterEach(() => {
    server.stop();
  });

  it("moves the primary player after reconnecting a local session", () => {
    server.handleClientConnect("first-client", "Pilot", makePlayer());
    server.handleClientDisconnect("first-client");
    server.handleClientConnect("second-client", "Pilot", makePlayer());

    const sessions = (server as unknown as { sessions: Map<string, { playerState: Player }> }).sessions;
    const session = sessions.get("second-client");
    expect(session).toBeTruthy();
    if (!session) return;

    const p = session.playerState;
    const startX = p.x;
    const startY = p.y;
    server.handleClientInput("second-client", movementFrame(1, startX + 800, startY));

    const tick = (server as unknown as { tick: (dt: number) => void }).tick.bind(server);
    for (let i = 0; i < 90; i++) {
      tick(1 / 60);
    }

    expect(Math.hypot(p.x - startX, p.y - startY)).toBeGreaterThan(1);
  });

  it("applies direct forward and reverse thrust from authoritative input", () => {
    server.handleClientConnect("direct-client", "Pilot", makePlayer());
    const sessions = (server as unknown as { sessions: Map<string, { playerState: Player }> }).sessions;
    const session = sessions.get("direct-client");
    expect(session).toBeTruthy();
    if (!session) return;

    const p = session.playerState;
    p.angle = 0;
    p.vx = 0;
    p.vy = 0;
    const tick = (server as unknown as { tick: (dt: number) => void }).tick.bind(server);

    server.handleClientInput("direct-client", directFrame(1, DIRECT_FORWARD_KEYS));
    tick(1 / 60);
    expect(p.vx).toBeGreaterThan(0);

    p.vx = 0;
    server.handleClientInput("direct-client", directFrame(2, { space: false, w: false, a: false, s: true, d: false, boost: false }));
    tick(1 / 60);
    expect(p.vx).toBeLessThan(0);
  });

  it("applies direct yaw from authoritative input", () => {
    server.handleClientConnect("yaw-client", "Pilot", makePlayer());
    const sessions = (server as unknown as { sessions: Map<string, { playerState: Player }> }).sessions;
    const session = sessions.get("yaw-client");
    expect(session).toBeTruthy();
    if (!session) return;

    const p = session.playerState;
    p.va = 0;
    const tick = (server as unknown as { tick: (dt: number) => void }).tick.bind(server);

    server.handleClientInput("yaw-client", directFrame(1, { space: false, w: false, a: true, s: false, d: false, boost: false }));
    tick(1 / 60);
    expect(p.va).toBeLessThan(0);

    p.va = 0;
    server.handleClientInput("yaw-client", directFrame(2, { space: false, w: false, a: false, s: false, d: true, boost: false }));
    tick(1 / 60);
    expect(p.va).toBeGreaterThan(0);
  });

  it("does not rotate hull toward mouse in direct mode", () => {
    server.handleClientConnect("direct-mouse-client", "Pilot", makePlayer());
    const sessions = (server as unknown as { sessions: Map<string, { playerState: Player }> }).sessions;
    const session = sessions.get("direct-mouse-client");
    expect(session).toBeTruthy();
    if (!session) return;

    const p = session.playerState;
    p.angle = 0;
    p.va = 0;
    const tick = (server as unknown as { tick: (dt: number) => void }).tick.bind(server);

    server.handleClientInput("direct-mouse-client", {
      tick: 1,
      keys: { space: false, w: false, a: false, s: false, d: false, boost: false },
      mouseWorld: { x: p.x, y: p.y - 1000 },
      waypoint: null,
      navCommand: null,
      movementControlMode: "direct",
      actions: [],
    });
    tick(1 / 60);

    expect(p.angle).toBe(0);
    expect(p.va).toBe(0);
  });

  it("boost increases direct thrust, drains capacitor, and generates heat", () => {
    server.handleClientConnect("boost-client", "Pilot", makePlayer());
    const sessions = (server as unknown as { sessions: Map<string, { playerState: Player }> }).sessions;
    const session = sessions.get("boost-client");
    expect(session).toBeTruthy();
    if (!session) return;

    const tick = (server as unknown as { tick: (dt: number) => void }).tick.bind(server);
    const p = session.playerState;
    p.angle = 0;
    p.energy = 100;

    server.handleClientInput("boost-client", directFrame(1, DIRECT_FORWARD_KEYS));
    tick(1 / 60);
    const normalVx = p.vx;

    p.vx = 0;
    p.vy = 0;
    p.energy = 100;
    p.shipHeat = 0.5;
    server.handleClientInput("boost-client", directFrame(2, DIRECT_BOOST_KEYS));
    tick(1 / 60);

    expect(p.vx).toBeGreaterThan(normalVx);
    expect(p.energy).toBeLessThan(100);
    expect(p.shipHeat).toBeGreaterThan(0.5);
    expect(p.boostFx).toBe(true);
  });

  it("afterburner-coupled boost spends heat for stronger output", () => {
    server.handleClientConnect("assist-client", "Pilot", makePlayer());
    const sessions = (server as unknown as { sessions: Map<string, { playerState: Player }> }).sessions;
    const session = sessions.get("assist-client");
    expect(session).toBeTruthy();
    if (!session) return;

    const tick = (server as unknown as { tick: (dt: number) => void }).tick.bind(server);
    const p = session.playerState;
    p.angle = 0;
    p.energy = 100;
    p.fitting.med[0] = "start-me-ab1";
    p.slotActive.med[0] = true;
    p.shipHeat = 0;
    server.handleClientInput("assist-client", directFrame(1, DIRECT_BOOST_KEYS));
    tick(1 / 60);
    const coldVx = p.vx;

    p.vx = 0;
    p.vy = 0;
    p.energy = 100;
    p.shipHeat = 0.9;
    server.handleClientInput("assist-client", directFrame(2, DIRECT_BOOST_KEYS));
    tick(1 / 60);

    expect(p.vx).toBeGreaterThan(coldVx);
    expect(p.shipHeat).toBeLessThan(0.9);
  });

  it("full heat does not lock out basic boost and caps at full reserve", () => {
    server.handleClientConnect("full-heat-client", "Pilot", makePlayer());
    const sessions = (server as unknown as { sessions: Map<string, { playerState: Player }> }).sessions;
    const session = sessions.get("full-heat-client");
    expect(session).toBeTruthy();
    if (!session) return;

    const tick = (server as unknown as { tick: (dt: number) => void }).tick.bind(server);
    const p = session.playerState;
    p.angle = 0;
    p.energy = 100;
    p.shipHeat = 1;
    p.boostLockout = true;
    server.handleClientInput("full-heat-client", directFrame(1, DIRECT_BOOST_KEYS));
    tick(1 / 60);

    expect(p.boostFx).toBe(true);
    expect(p.boostLockout).toBe(false);
    expect(p.shipHeat).toBeLessThanOrEqual(1);
  });

  it("stored heat does not improve or spend on boost without an online afterburner", () => {
    server.handleClientConnect("uncoupled-client", "Pilot", makePlayer());
    const sessions = (server as unknown as { sessions: Map<string, { playerState: Player }> }).sessions;
    const session = sessions.get("uncoupled-client");
    expect(session).toBeTruthy();
    if (!session) return;

    const tick = (server as unknown as { tick: (dt: number) => void }).tick.bind(server);
    const p = session.playerState;
    p.angle = 0;
    p.energy = 100;
    p.shipHeat = 0;
    server.handleClientInput("uncoupled-client", directFrame(1, DIRECT_BOOST_KEYS));
    tick(1 / 60);
    const coldVx = p.vx;

    p.vx = 0;
    p.vy = 0;
    p.energy = 100;
    p.shipHeat = 0.9;
    server.handleClientInput("uncoupled-client", directFrame(2, DIRECT_BOOST_KEYS));
    tick(1 / 60);

    expect(p.vx).toBeCloseTo(coldVx, 5);
    expect(p.shipHeat).toBeGreaterThan(0.9);
  });
});
