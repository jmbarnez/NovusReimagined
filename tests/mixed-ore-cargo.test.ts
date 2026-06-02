import { describe, it, expect, beforeEach } from "vitest";
import { _G as G } from "../src/state.js";
import { PlayerAccess } from "../src/state-access.js";
import { makePlayer } from "../src/player/player-data.js";
import { installTestPlayer } from "../src/player-registry.js";

describe("mixed ore cargo", () => {
  beforeEach(() => {
    installTestPlayer(makePlayer());
  });

  it("stacks slots with same composition and richness", () => {
    PlayerAccess.addMixedOreCargo({ composition: { iron: 0.7, nickel: 0.3 }, qty: 5, name: "Ferro-nickel Chunk", richness: 2.5 });
    PlayerAccess.addMixedOreCargo({ composition: { iron: 0.7, nickel: 0.3 }, qty: 3, name: "Ferro-nickel Chunk", richness: 2.5 });
    expect(G.P.mixedOreCargo).toHaveLength(1);
    expect(G.P.mixedOreCargo[0]!.qty).toBe(8);
    expect(G.P.mixedOreCargo[0]!.richness).toBe(2.5);
  });

  it("creates separate slots for same composition but different richness", () => {
    PlayerAccess.addMixedOreCargo({ composition: { iron: 0.7, nickel: 0.3 }, qty: 5, name: "Ferro-nickel Chunk", richness: 2.5 });
    PlayerAccess.addMixedOreCargo({ composition: { iron: 0.7, nickel: 0.3 }, qty: 3, name: "Ferro-nickel Chunk", richness: 5.0 });
    expect(G.P.mixedOreCargo).toHaveLength(2);
    expect(G.P.mixedOreCargo[0]!.qty).toBe(5);
    expect(G.P.mixedOreCargo[0]!.richness).toBe(2.5);
    expect(G.P.mixedOreCargo[1]!.qty).toBe(3);
    expect(G.P.mixedOreCargo[1]!.richness).toBe(5.0);
  });

  it("defaults richness to 1 when not specified", () => {
    PlayerAccess.addMixedOreCargo({ composition: { iron: 1 }, qty: 10, name: "Iron Chunk" });
    expect(G.P.mixedOreCargo[0]!.richness).toBe(1);
  });

  it("setMixedOreCargo preserves richness", () => {
    PlayerAccess.setMixedOreCargo([
      { composition: { iron: 0.5, nickel: 0.5 }, qty: 4, name: "Mixed", richness: 3.0 },
    ]);
    expect(G.P.mixedOreCargo[0]!.richness).toBe(3.0);
  });
});
