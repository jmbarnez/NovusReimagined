import { describe, it, expect, beforeEach } from "vitest";
import { _G as G } from "../src/state.js";
import { showDamageNumber } from "../src/combat/damage-display.js";

describe("showDamageNumber", () => {
  beforeEach(() => {
    G.pendingEffects = [];
  });

  it("pushes a floatText GameEffect into pendingEffects", () => {
    showDamageNumber(100, 200, 42, "hull");
    expect(G.pendingEffects).toHaveLength(1);
    const eff = G.pendingEffects[0];
    expect(eff.type).toBe("floatText");
    expect(eff.payload?.text).toBe("-42");
    expect(eff.payload?.color).toBe("#ffffff");
    expect(eff.payload?.bgColor).toBe("#ee9944");
    expect(typeof eff.payload?.x).toBe("number");
    expect(typeof eff.payload?.y).toBe("number");
  });

  it("uses crit styling for crit hits", () => {
    showDamageNumber(0, 0, 99, "crit");
    const eff = G.pendingEffects[0];
    expect(eff.payload?.text).toBe("-99!");
    expect(eff.payload?.bgColor).toBe("#ff2200");
    expect(eff.payload?.color).toBe("#ffffff");
  });

  it("uses miss styling for misses", () => {
    showDamageNumber(0, 0, "MISS", "miss");
    const eff = G.pendingEffects[0];
    expect(eff.payload?.text).toBe("0");
    expect(eff.payload?.color).toBe("#000000");
    expect(eff.payload?.bgColor).toBe("#4488ff");
  });

  it("uses heal styling for heals", () => {
    showDamageNumber(0, 0, 25, "heal");
    const eff = G.pendingEffects[0];
    expect(eff.payload?.text).toBe("+25");
    expect(eff.payload?.bgColor).toBe("#66ff88");
  });
});
