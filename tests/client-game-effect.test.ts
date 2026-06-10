import { describe, it, expect, beforeEach } from "vitest";
import { _G as G } from "../src/state.js";
import { GameClient } from "../src/net/client-session.js";
import type { GameEffect } from "../src/state/types/combat.js";

describe("GameClient.handleGameEffect gateBoostParticles", () => {
  beforeEach(() => {
    G.particles = [];
  });

  it("spawns 32 particles from a gateBoostParticles effect", () => {
    const client = new GameClient();
    const effect: GameEffect = {
      type: "gateBoostParticles",
      payload: {
        x: 100,
        y: 200,
        angle: 0,
        halfWidth: 108,
        isForward: true,
      },
    };

    // Access private method via unknown cast (avoiding `any` per project rules)
    (client as unknown as { handleGameEffect(eff: GameEffect): void }).handleGameEffect(effect);

    expect(G.particles.length).toBe(32);
    for (const p of G.particles) {
      expect(p.color).toBe("#aaddff");
      expect(p.life).toBeGreaterThan(0);
      expect(p.vx).not.toBe(0);
      expect(p.vy).not.toBe(0);
    }
  });

  it("uses defaults when payload fields are missing", () => {
    const client = new GameClient();
    const effect: GameEffect = {
      type: "gateBoostParticles",
      payload: {},
    };

    (client as unknown as { handleGameEffect(eff: GameEffect): void }).handleGameEffect(effect);

    expect(G.particles.length).toBe(32);
    expect(G.particles[0]!.x).toBeDefined();
    expect(G.particles[0]!.y).toBeDefined();
  });
});
