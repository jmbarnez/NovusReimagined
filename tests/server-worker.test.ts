import { describe, it, expect } from "vitest";
import { GameServer } from "../src/server/server.js";

describe("GameServer", () => {
  it("starts headless without throwing", () => {
    const server = new GameServer(() => {});
    expect(() => server.start()).not.toThrow();
    expect(server.ready).toBe(true);
    server.stop();
  });
});
