import { describe, expect, it } from "vitest";
import { GameServer } from "../src/server/server.js";
import { makePlayer } from "../src/player/player-data.js";
import { initGameSession } from "../src/utils/restore-save.js";
import { WorldAccess, getState } from "../src/state-access.js";
import { buildGalaxy, populateSystem } from "../src/world-gen.js";
import { SpatialGrid } from "../src/utils/spatial.js";
import { C } from "../src/config/index.js";
import type { Player } from "../src/state.js";

describe("new game movement", () => {
  it("player can move via waypoint on a fresh new game", () => {
    WorldAccess.setGalaxy(buildGalaxy());
    for (const sys of getState().GALAXY) {
      populateSystem(sys);
    }
    WorldAccess.setSpatialGrid(new SpatialGrid(C.PHYSICS.SPAWN_GRID.cellSize));

    const server = new GameServer(() => {});
    server.start();

    const freshPlayer = makePlayer();
    initGameSession(freshPlayer, { setupSpawn: true });

    server.handleClientConnect("new-game-client", "Pilot", freshPlayer);

    const sessions = (server as unknown as { sessions: Map<string, { playerState: Player }> }).sessions;
    const session = sessions.get("new-game-client");
    expect(session).toBeTruthy();
    if (!session) { server.stop(); return; }

    const p = session.playerState;
    const startX = p.x;
    const startY = p.y;

    // Send a direct movement input frame
    server.handleClientInput("new-game-client", {
      tick: 1,
      keys: { space: false, w: true, a: false, s: false, d: false, boost: false, warp: false, lmb: false },
      mouseWorld: { x: startX + 800, y: startY },
      actions: [],
    });

    const tick = (server as unknown as { tick: (dt: number) => void }).tick.bind(server);
    for (let i = 0; i < 90; i++) {
      tick(1 / 60);
    }

    server.stop();
    expect(Math.hypot(p.x - startX, p.y - startY)).toBeGreaterThan(1);
  });
});
