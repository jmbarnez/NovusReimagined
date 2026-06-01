import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Client, _G as G } from "../src/state.js";
import { makePlayer } from "../src/player/player-data.js";
import { connectToRemote, gameClient } from "../src/game-loop/multiplayer-host.js";

describe("connectToRemote", () => {
  beforeEach(() => {
    G.P = makePlayer();
    Client.multiplayerRole = "none";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reverts client role when connect returns false", async () => {
    vi.spyOn(gameClient, "disconnect").mockImplementation(() => {});
    vi.spyOn(gameClient, "connect").mockResolvedValue(false);

    const ok = await connectToRemote("127.0.0.1:4173");

    expect(ok).toBe(false);
    expect(Client.multiplayerRole).toBe("none");
  });

  it("reverts client role when connect throws", async () => {
    vi.spyOn(gameClient, "disconnect").mockImplementation(() => {});
    vi.spyOn(gameClient, "connect").mockRejectedValue(new Error("boom"));

    const ok = await connectToRemote("127.0.0.1:4173");

    expect(ok).toBe(false);
    expect(Client.multiplayerRole).toBe("none");
  });
});

