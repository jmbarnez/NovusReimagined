import { describe, it, expect } from "vitest";
import { resolveLockBracketStyle } from "../src/render/pixi-lock-brackets.js";
import type { LockSlot } from "../src/types/world.js";

const slot = (resolving: boolean): LockSlot => ({ id: "t1", resolving, acc: 0 });

describe("resolveLockBracketStyle", () => {
  it("uses hostile orange when an enemy lock resolves", () => {
    const s = resolveLockBracketStyle(slot(false), true, 0, "enemy");
    expect(s.color).toBe(0xff5522);
    expect(s.lineWidth).toBe(1.7);
  });

  it("uses neutral blue for asteroids and wrecks", () => {
    const s = resolveLockBracketStyle(slot(false), false, 0, "neutral");
    expect(s.color).toBe(0x0077ff);
    expect(s.lineWidth).toBe(1.3);
  });

  it("uses cyan blink while resolving neutral targets", () => {
    const s = resolveLockBracketStyle(slot(true), true, 0, "neutral");
    expect(s.color).toBe(0x00d2ff);
    expect(s.lineWidth).toBe(1.4);
  });

  it("uses red when the enemy has locked the player", () => {
    const s = resolveLockBracketStyle(slot(false), true, 0, "enemy", { hasLockOnPlayer: true });
    expect(s.color).toBe(0xff3b30);
  });
});
