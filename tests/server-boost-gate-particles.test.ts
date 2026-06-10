import { describe, expect, it } from "vitest";
import { GameServer } from "../src/server/server.js";
import { makePlayer } from "../src/player/player-data.js";
import { getBoostGatesForTrack } from "../src/data/tutorial-layout.js";
import type { InputFrame } from "../src/sim/input.js";

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

const IDLE_KEYS: InputFrame["keys"] = { space: false, w: false, a: false, s: false, d: false, boost: false, warp: false };

describe("GameServer boost gate particles", () => {
  it("broadcasts gateBoostParticles effect when player crosses a boost gate", () => {
    const messages: unknown[] = [];
    const server = new GameServer((clientId, msg) => {
      // Simulate postMessage structured clone
      messages.push(structuredClone(msg));
    });
    server.start();

    try {
      const gate = getBoostGatesForTrack("approach")[0]!;
      const player = makePlayer();
      player.sysIdx = 0;

      server.handleClientConnect("test-client", "Pilot", player);

      const sessions = (server as unknown as { sessions: Map<string, { playerState: { x: number; y: number; px: number; py: number; vx: number; vy: number; sysIdx: number; angle: number } }> }).sessions;
      const session = sessions.get("test-client")!;
      const p = session.playerState;
      const nx = Math.cos(gate.angle);
      const ny = Math.sin(gate.angle);
      p.x = gate.x - nx * 100;
      p.y = gate.y - ny * 100;
      p.px = p.x;
      p.py = p.y;
      p.vx = nx * 300;
      p.vy = ny * 300;
      p.angle = gate.angle;
      p.sysIdx = 0;

      const tick = (server as unknown as { tick: (dt: number) => void }).tick.bind(server);

      for (let i = 0; i < 60; i++) {
        server.handleClientInput("test-client", directFrame(i + 1, IDLE_KEYS));
        tick(1 / 60);
      }

      const effectsMessages = messages.filter(
        (m) => typeof m === "object" && m !== null && (m as { type?: string }).type === "effects"
      );

      const gbpEffects = effectsMessages.flatMap((m) => {
        const payload = (m as { payload?: { effects?: Array<{ type: string }> } }).payload;
        return payload?.effects?.filter((e) => e.type === "gateBoostParticles") ?? [];
      });

      expect(gbpEffects.length).toBeGreaterThan(0);
    } finally {
      server.stop();
    }
  });
});
