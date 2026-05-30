import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GameServer } from "../src/server/server.js";
import { makePlayer } from "../src/player/player-data.js";
import type { Player } from "../src/state.js";
import type { InputFrame } from "../src/sim/input.js";

function movementFrame(tick: number, x: number, y: number): InputFrame {
  return {
    tick,
    keys: { space: false },
    mouseWorld: { x, y },
    waypoint: { x, y },
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
});
