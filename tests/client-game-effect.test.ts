import { describe, it, expect, beforeEach } from "vitest";
import { _G as G } from "../src/state.js";
import { handleGameEffect } from "../src/net/game-fx-handler.js";
import type { GameEffect } from "../src/state/types/combat.js";

describe("handleGameEffect gateBoostParticles", () => {
  beforeEach(() => {
    G.particles = [];
  });

  it("spawns 32 particles from a gateBoostParticles effect", () => {
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

    handleGameEffect(effect);

    expect(G.particles.length).toBe(32);
    for (const p of G.particles) {
      expect(p.color).toBe("#aaddff");
      expect(p.life).toBeGreaterThan(0);
      expect(p.vx).not.toBe(0);
      expect(p.vy).not.toBe(0);
    }
  });

  it("uses defaults when payload fields are missing", () => {
    const effect: GameEffect = {
      type: "gateBoostParticles",
      payload: {},
    };

    handleGameEffect(effect);

    expect(G.particles.length).toBe(32);
    expect(G.particles[0]!.x).toBeDefined();
    expect(G.particles[0]!.y).toBeDefined();
  });
});
