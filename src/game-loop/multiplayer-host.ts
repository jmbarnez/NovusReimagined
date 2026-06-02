import { Client } from "../state.js";
import { getState } from "../state-access.js";
import { GameClient, parseWorkerNetEnvelope } from "../net/client.js";
import { isTauriApp } from "../utils/app-exit.js";
import { netLog } from "../ui/net-console.js";

export const gameClient = new GameClient();

let serverWorker: Worker | null = null;
let serverWorkerReady: Promise<Worker> | null = null;
let workerGeneration = 0;
let hostRelayAttached = false;
let tauriWsStarted = false;
/** Only the in-space host processes Tauri WS relay and runs the server worker for remotes. */
let multiplayerRole: "none" | "host" | "client" = "none";
let unlistenMessage: (() => void) | null = null;
let unlistenDisconnect: (() => void) | null = null;
let lastHostHeartbeat = 0;

/** Vite dev server (`npm run dev`). */
export const VITE_DEV_PORT = 5173;
/** Production build preview (`npm run preview`). */
export const VITE_PREVIEW_PORT = 4174;
/** Novus multiplayer / host WebSocket server (always). */
export const GAME_SERVER_PORT = 4173;

export interface EnsureGameplayConnectedOptions {
  reconnectLocal?: boolean;
}

export function getMultiplayerPort(): number {
  return GAME_SERVER_PORT;
}

function resetLocalHostStateForReconnect(): void {
  gameClient.disconnect();
  resetServerWorker();
  tauriWsStarted = false;
  multiplayerRole = "none";
  Client.multiplayerRole = "none";
  lastHostHeartbeat = 0;
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem("ss2-host-active");
    } catch {
      // ignore localStorage errors
    }
  }
}

export function updateHostHeartbeat() {
  if (gameClient.connectionState !== "connected" || Client.multiplayerRole !== "host") return;
  const now = Date.now();
  if (now - lastHostHeartbeat < 1000) return;
  lastHostHeartbeat = now;
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem("ss2-host-active", now.toString());
    } catch {
      // ignore localStorage errors
    }
  }
}

function resetServerWorker() {
  workerGeneration++;
  if (serverWorker) {
    serverWorker.onerror = null;
    serverWorker.onmessage = null;
    serverWorker.postMessage({ type: "stop" });
    serverWorker.terminate();
    serverWorker = null;
  }
  hostRelayAttached = false;
  serverWorkerReady = null;
}

function attachHostWorkerRelay(worker: Worker) {
  if (hostRelayAttached || !isTauriApp() || multiplayerRole !== "host") return;
  hostRelayAttached = true;

  worker.addEventListener("message", (e: MessageEvent) => {
    if (e.data?.type !== "net_message") return;
    const { clientId, msg } = parseWorkerNetEnvelope(e.data || {});
    if (!clientId || !msg || clientId === gameClient.clientId) return;

    import("@tauri-apps/api/core").then(({ invoke }) => {
      const body = JSON.stringify(msg);
      invoke("send_to_client", {
        clientId,
        payload: body,
      }).catch((err) => {
        netLog(`[ERR] send_to_client ${clientId}: ${err}`);
        console.error("[Host] Failed to send to remote client", err);
      });
      if (msg.type === "connect_ack" || msg.type === "snapshot" || msg.type === "player_joined") {
        netLog(`[Host] relay → ${clientId} ${msg.type} (${body.length}B)`);
      }
    });
  });
}

async function ensureTauriWsServer(): Promise<boolean> {
  if (!isTauriApp() || tauriWsStarted || multiplayerRole !== "host") return true;
  const port = getMultiplayerPort();
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    try {
      await invoke("stop_server");
    } catch {
      /* no prior server in this process */
    }
    await invoke("start_server", { port });
    tauriWsStarted = true;
    netLog(`[OK] Tauri WS server listening on port ${port}`);
    return true;
  } catch (err) {
    const msg = String(err);
    if (msg.includes("already running")) {
      netLog(`[WARN] Tauri WS port ${port} already running — retrying relay restart`);
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("stop_server").catch(() => undefined);
        await new Promise((resolve) => window.setTimeout(resolve, 150));
        await invoke("start_server", { port });
        tauriWsStarted = true;
        netLog(`[OK] Tauri WS server listening on port ${port} after retry`);
        return true;
      } catch (retryErr) {
        netLog(`[ERR] Tauri WS port ${port} is still unavailable — close other Novus instances/processes and retry`);
        console.error("[GameLoop] Failed to restart Tauri WS server:", retryErr);
      }
    } else {
      netLog(`[ERR] Failed to start Tauri WS server: ${err}`);
      console.error("[GameLoop] Failed to start Tauri WS server:", err);
    }
    return false;
  }
}

const WORKER_START_TIMEOUT_MS = 25000;
const LOCAL_CONNECT_RETRY_DELAY_MS = 250;
const LOCAL_CONNECT_ATTEMPTS = 2;

function startServerWorker(): Promise<Worker> {
  if (serverWorkerReady) return serverWorkerReady;
  const generation = workerGeneration;
  serverWorkerReady = new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("../server/server-worker.js", import.meta.url),
      { type: "module" },
    );
    serverWorker = worker;
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled || generation !== workerGeneration) return;
      settled = true;
      clearTimeout(timeoutId);
      cleanup();
      fn();
    };

    const timeoutId = window.setTimeout(() => {
      finish(() => {
        serverWorkerReady = null;
        try {
          worker.terminate();
        } catch {
          // ignore terminate errors
        }
        if (serverWorker === worker) serverWorker = null;
        reject(new Error("Server worker start timed out (25s)"));
      });
    }, WORKER_START_TIMEOUT_MS);

    const cleanup = () => {
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
    };

    const onMessage = (e: MessageEvent) => {
      if (generation !== workerGeneration) return;
      if (e.data?.type === "started") {
        finish(() => {
          attachHostWorkerRelay(worker);
          resolve(worker);
        });
      } else if (e.data?.type === "start_error") {
        finish(() => {
          serverWorkerReady = null;
          reject(new Error(String(e.data.error ?? "[GameLoop] Server worker failed to start")));
        });
      }
    };
    const onError = (err: ErrorEvent) => {
      if (generation !== workerGeneration) return;
      const detail =
        err.message ||
        (err.error instanceof Error ? err.error.message : err.error ? String(err.error) : "unknown load error");
      const loc = err.filename ? ` (${err.filename}:${err.lineno ?? "?"})` : "";
      finish(() => {
        serverWorkerReady = null;
        reject(err.error ?? new Error(`Server worker failed: ${detail}${loc}`));
      });
    };

    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);
    worker.postMessage({ type: "start" });
  });
  return serverWorkerReady;
}

async function forwardToServerWorker(type: string, payload: Record<string, unknown>) {
  if (multiplayerRole !== "host") return;
  try {
    await startServerWorker();
    serverWorker?.postMessage({ type, payload });
  } catch (err) {
    netLog(`[ERR] Server worker unavailable for ${type}: ${err}`);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function connectLocalGameplayOnce(): Promise<boolean> {
  multiplayerRole = "host";
  Client.multiplayerRole = "host";
  netLog("ensureGameplayConnected: starting local server worker…");
  const worker = await startServerWorker();
  if (isTauriApp()) {
    const wsOk = await ensureTauriWsServer();
    if (!wsOk) {
      netLog("[ERR] Host relay startup aborted: multiplayer port bind failed");
      multiplayerRole = "none";
      Client.multiplayerRole = "none";
      resetServerWorker();
      return false;
    }
  }
  const ok = await gameClient.connect("", "", getState().player, worker);
  netLog(ok ? "[OK] Local server connected" : "[WARN] Local server connect returned false");
  return ok;
}

export async function ensureGameplayConnected(opts: EnsureGameplayConnectedOptions = {}): Promise<boolean> {
  if (opts.reconnectLocal) {
    netLog("ensureGameplayConnected: resetting local session for loaded save");
    resetLocalHostStateForReconnect();
  }
  if (gameClient.connectionState === "connected") {
    netLog("[OK] ensureGameplayConnected: already connected");
    return true;
  }

  for (let attempt = 1; attempt <= LOCAL_CONNECT_ATTEMPTS; attempt++) {
    try {
      const ok = await connectLocalGameplayOnce();
      if (ok) return true;
    } catch (err) {
      netLog(`[ERR] Local server connect attempt ${attempt} failed: ${err}`);
      console.error("[GameLoop] Local server connect failed:", err);
    }

    if (attempt < LOCAL_CONNECT_ATTEMPTS) {
      netLog(`[WARN] Retrying local authoritative connect (${attempt + 1}/${LOCAL_CONNECT_ATTEMPTS})`);
      resetLocalHostStateForReconnect();
      await delay(LOCAL_CONNECT_RETRY_DELAY_MS);
    }
  }

  return false;
}

function parseBridgePayload(input: unknown): { clientId?: string; payload?: string } {
  if (!input || typeof input !== "object") return {};
  const obj = input as { clientId?: unknown; payload?: unknown };
  return {
    clientId: typeof obj.clientId === "string" ? obj.clientId : undefined,
    payload: typeof obj.payload === "string" ? obj.payload : undefined,
  };
}

function parseDisconnectPayload(input: unknown): { clientId?: string } {
  if (!input || typeof input !== "object") return {};
  const obj = input as { clientId?: unknown };
  return { clientId: typeof obj.clientId === "string" ? obj.clientId : undefined };
}

export function initHostBridgeListeners() {
  if (!isTauriApp()) return;
  import("@tauri-apps/api/event").then(({ listen }) => {
    listen("client_message", (event: { payload?: unknown }) => {
      if (multiplayerRole !== "host") return;
      const { clientId, payload } = parseBridgePayload(event.payload);
      if (!clientId || !payload) return;
      try {
        const msg = JSON.parse(payload) as { type?: string; payload?: Record<string, unknown> };
        if (msg.type === "input") {
          void forwardToServerWorker("input", {
            id: clientId,
            frame: msg.payload?.frame,
          });
        } else if (msg.type === "ack") {
          void forwardToServerWorker("ack", {
            id: clientId,
            tick: msg.payload?.tick,
          });
        } else if (msg.type === "connect") {
          netLog(`[Host] remote connect from ${clientId}`);
          void forwardToServerWorker("connect", {
            id: clientId,
            name: msg.payload?.name,
            characterData: msg.payload?.characterData,
          });
        } else if (msg.type === "chat") {
          void forwardToServerWorker("chat", {
            id: clientId,
            message: msg.payload?.message,
          });
        }
      } catch (err) {
        netLog(`[WARN] Failed to parse client message: ${err}`);
        console.warn("[Host] Failed to parse client message", err);
      }
    }).then((unsub) => {
      unlistenMessage = unsub;
    });

    listen("client_disconnected", (event: { payload?: unknown }) => {
      if (multiplayerRole !== "host") return;
      const { clientId } = parseDisconnectPayload(event.payload);
      if (!clientId) return;
      netLog(`[Host] client disconnected: ${clientId}`);
      console.log(`[Host] Client disconnected: ${clientId}`);
      void forwardToServerWorker("disconnect", { id: clientId });
    }).then((unsub) => {
      unlistenDisconnect = unsub;
    });
  });
}

export async function connectToRemote(address: string): Promise<boolean> {
  netLog(`connectToRemote: ${address}`);
  multiplayerRole = "client";
  Client.multiplayerRole = "client";
  resetServerWorker();
  gameClient.disconnect();

  try {
    const ok = await gameClient.connect(address, "", getState().player);
    netLog(ok ? `[OK] Remote connect to ${address}` : `[ERR] Remote connect failed: ${address}`);
    if (!ok) {
      gameClient.disconnect();
      multiplayerRole = "none";
      Client.multiplayerRole = "none";
    }
    return ok;
  } catch (err) {
    netLog(`[ERR] Remote connect exception: ${err}`);
    gameClient.disconnect();
    multiplayerRole = "none";
    Client.multiplayerRole = "none";
    return false;
  }
}

export function stopMultiplayer() {
  gameClient.disconnect();
  resetServerWorker();
  tauriWsStarted = false;
  multiplayerRole = "none";
  Client.multiplayerRole = "none";
  lastHostHeartbeat = 0;

  if (typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem("ss2-host-active");
    } catch {
      // ignore localStorage errors
    }
  }
  if (unlistenMessage) {
    unlistenMessage();
    unlistenMessage = null;
  }
  if (unlistenDisconnect) {
    unlistenDisconnect();
    unlistenDisconnect = null;
  }

  if (isTauriApp()) {
    import("@tauri-apps/api/core").then(({ invoke }) => {
      invoke("stop_server").catch(() => {
        // ignore stop failures
      });
    });
  }
}
