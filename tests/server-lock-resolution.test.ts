import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GameServer } from "../src/server/server.js";
import { _G as G } from "../src/state.js";;
import { makePlayer } from "../src/player/player-data.js";
import type { InputFrame } from "../src/sim/input.js";

function lockFrame(tick: number, enemyId: string): InputFrame {
  return {
    tick,
    keys: { space: false, w: false, a: false, s: false, d: false },
    mouseWorld: { x: 0, y: 0 },
    waypoint: null,
    navCommand: null,
    actions: [{ type: "requestSensorLock", payload: { id: enemyId } }],
  };
}

describe("GameServer sensor lock resolution", () => {
  let server: GameServer;

  beforeEach(() => {
    server = new GameServer(() => {});
    server.start();
    const internals = server as unknown as { tickInterval: ReturnType<typeof setInterval> | null };
    if (internals.tickInterval) {
      clearInterval(internals.tickInterval);
      internals.tickInterval = null;
    }
  });

  afterEach(() => {
    server.stop();
  });

  it("resolves an in-range enemy lock after simulation time elapses", () => {
    const clientId = "lock-test-client";
    server.handleClientConnect(clientId, "Pilot", makePlayer());

    const sessions = (server as unknown as { sessions: Map<string, { playerState: import("../src/state.js").Player }> }).sessions;
    const session = sessions.get(clientId);
    expect(session).toBeTruthy();
    if (!session) return;

    const p = session.playerState;
    const sys = G.GALAXY[p.sysIdx];
    const enemy = sys?.enemies?.[0];
    expect(enemy?.id).toBeTruthy();
    if (!enemy) return;

    p.x = enemy.x;
    p.y = enemy.y;

    // Tick 1 is behind server time on purpose — lock action must still apply via staleActions drain.
    server.handleClientInput(clientId, lockFrame(1, enemy.id));

    const tick = (server as unknown as { tick: (dt: number) => void }).tick.bind(server);
    for (let i = 0; i < 900; i++) {
      tick(1 / 60);
    }

    const slot = p.lockQueue.find((s) => s.id === enemy.id);
    expect(slot, JSON.stringify(p.lockQueue)).toBeTruthy();
    expect(slot?.resolving).toBe(false);
  }, 20000);
});
