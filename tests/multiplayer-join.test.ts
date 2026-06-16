import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Client, _G as G, type Player } from "../src/state.js";
import { makePlayer } from "../src/player/player-data.js";
import { SAVE_KEY } from "../src/constants.js";
import { connectToRemote, ensureGameplayConnected, gameClient, stopMultiplayer } from "../src/game-loop/multiplayer-host.js";
import { WorldAccess } from "../src/state-access.js";
import { buildGalaxy } from "../src/world-gen.js";
import { restoreGameFromSave } from "../src/utils/restore-save.js";

const tauriMocks = vi.hoisted(() => ({
  isTauriApp: vi.fn(() => false),
  invoke: vi.fn<(command: string, args?: Record<string, unknown>) => Promise<unknown>>(() => Promise.resolve()),
  netLog: vi.fn(),
}));

vi.mock("../src/utils/app-exit.js", () => ({
  isTauriApp: tauriMocks.isTauriApp,
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: tauriMocks.invoke,
}));

vi.mock("../src/ui/net-console.js", () => ({
  netLog: tauriMocks.netLog,
  flushNetLogPending: vi.fn(),
}));

class FakeWorker {
  public onerror: ((event: ErrorEvent) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;
  private readonly listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();

  public addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const bucket = this.listeners.get(type) ?? new Set<EventListenerOrEventListenerObject>();
    bucket.add(listener);
    this.listeners.set(type, bucket);
  }

  public removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    this.listeners.get(type)?.delete(listener);
  }

  public postMessage(message: unknown): void {
    if (!message || typeof message !== "object" || !("type" in message)) return;
    if (message.type === "start") {
      queueMicrotask(() => this.emitMessage({ type: "started" }));
    }
  }

  public terminate(): void {
    this.listeners.clear();
  }

  private emitMessage(data: unknown): void {
    const event = new MessageEvent("message", { data });
    this.onmessage?.(event);
    for (const listener of this.listeners.get("message") ?? []) {
      if (typeof listener === "function") listener(event);
      else listener.handleEvent(event);
    }
  }
}

describe("connectToRemote", () => {
  beforeEach(() => {
    G.P = makePlayer();
    Client.multiplayerRole = "none";
    localStorage.clear();
    tauriMocks.isTauriApp.mockReturnValue(false);
    tauriMocks.invoke.mockReset();
    tauriMocks.invoke.mockResolvedValue(undefined);
    tauriMocks.netLog.mockClear();
  });

  afterEach(() => {
    stopMultiplayer();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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

  it("reconnects local gameplay with the restored save player", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    WorldAccess.setGalaxy(buildGalaxy());

    const previous = makePlayer();
    previous.pilotName = "Old Pilot";
    WorldAccess.initPlayer(previous);
    gameClient.connectionState = "connected";

    const restored = makePlayer();
    restored.pilotName = "Restored Pilot";
    restored.x = 321;
    restored.y = 654;
    restored.tutorial.active = false;
    localStorage.setItem(SAVE_KEY, JSON.stringify(restored));

    expect(restoreGameFromSave()).toBe(true);

    const disconnectSpy = vi.spyOn(gameClient, "disconnect");
    const connectedPlayers: Player[] = [];
    const connectSpy = vi.spyOn(gameClient, "connect").mockImplementation((...args: Parameters<typeof gameClient.connect>) => {
      connectedPlayers.push(args[2]);
      gameClient.connectionState = "connected";
      return Promise.resolve(true);
    });

    const ok = await ensureGameplayConnected({ reconnectLocal: true });

    expect(ok).toBe(true);
    expect(disconnectSpy.mock.invocationCallOrder[0]).toBeLessThan(connectSpy.mock.invocationCallOrder[0]);
    const playerSentToServer = connectedPlayers[0];
    expect(playerSentToServer).toBe(G.P);
    expect(playerSentToServer.pilotName).toBe("Restored Pilot");
    expect(playerSentToServer.x).toBe(321);
    expect(Client.multiplayerRole).toBe("host");
  });

  it("retries a failed local reconnect with the restored save player", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    WorldAccess.setGalaxy(buildGalaxy());

    const restored = makePlayer();
    restored.pilotName = "Retry Pilot";
    restored.x = 777;
    restored.y = 888;
    restored.tutorial.active = false;
    localStorage.setItem(SAVE_KEY, JSON.stringify(restored));

    expect(restoreGameFromSave()).toBe(true);

    const connectedPlayers: Player[] = [];
    const connectSpy = vi.spyOn(gameClient, "connect").mockImplementation((...args: Parameters<typeof gameClient.connect>) => {
      connectedPlayers.push(args[2]);
      if (connectSpy.mock.calls.length === 1) {
        gameClient.connectionState = "disconnected";
        return Promise.resolve(false);
      }
      gameClient.connectionState = "connected";
      return Promise.resolve(true);
    });

    const ok = await ensureGameplayConnected({ reconnectLocal: true });

    expect(ok).toBe(true);
    expect(connectSpy).toHaveBeenCalledTimes(2);
    expect(connectedPlayers).toHaveLength(2);
    expect(connectedPlayers[0]).toBe(G.P);
    expect(connectedPlayers[1]).toBe(G.P);
    expect(connectedPlayers[1].pilotName).toBe("Retry Pilot");
  });

  it("retries transient Tauri port bind failures without logging a failed startup", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    WorldAccess.setGalaxy(buildGalaxy());
    WorldAccess.initPlayer(makePlayer());
    tauriMocks.isTauriApp.mockReturnValue(true);

    let startAttempts = 0;
    tauriMocks.invoke.mockImplementation((command: string) => {
      if (command !== "start_server") return Promise.resolve(undefined);
      startAttempts++;
      if (startAttempts === 1) {
        return Promise.reject(new Error("Failed to bind port 4173: os error 10048"));
      }
      return Promise.resolve(undefined);
    });

    vi.spyOn(gameClient, "connect").mockImplementation(() => {
      gameClient.connectionState = "connected";
      return Promise.resolve(true);
    });

    const ok = await ensureGameplayConnected({ reconnectLocal: true });

    expect(ok).toBe(true);
    expect(startAttempts).toBe(2);
    expect(tauriMocks.netLog).toHaveBeenCalledWith("[OK] Tauri WS server listening on port 4173");
    expect(tauriMocks.netLog).not.toHaveBeenCalledWith(
      expect.stringContaining("Failed to start Tauri WS server"),
    );
    expect(tauriMocks.netLog).not.toHaveBeenCalledWith(
      expect.stringContaining("Host relay startup aborted"),
    );
  });
});
