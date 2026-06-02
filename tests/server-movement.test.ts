import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GameServer } from "../src/server/server.js";
import { makePlayer } from "../src/player/player-data.js";
import type { Player } from "../src/state.js";
import type { InputFrame } from "../src/sim/input.js";

function movementFrame(tick: number, x: number, y: number): InputFrame {
  return {
    tick,
    keys: { space: false, w: false, a: false, s: false, d: false },
    mouseWorld: { x, y },
    waypoint: { x, y },
    navCommand: null,
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
    actions: [],
  };
}

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

    server.handleClientInput("direct-client", directFrame(1, { space: false, w: true, a: false, s: false, d: false }));
    tick(1 / 60);
    expect(p.vx).toBeGreaterThan(0);

    p.vx = 0;
    server.handleClientInput("direct-client", directFrame(2, { space: false, w: false, a: false, s: true, d: false }));
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

    server.handleClientInput("yaw-client", directFrame(1, { space: false, w: false, a: true, s: false, d: false }));
    tick(1 / 60);
    expect(p.va).toBeLessThan(0);

    p.va = 0;
    server.handleClientInput("yaw-client", directFrame(2, { space: false, w: false, a: false, s: false, d: true }));
    tick(1 / 60);
    expect(p.va).toBeGreaterThan(0);
  });
});
