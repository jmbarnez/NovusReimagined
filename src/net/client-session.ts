import { Client, type Player, type GameEffect } from "../state.js";
import { PlayerAccess, getState } from "../state-access.js";
import type { WorldSnapshot, DeltaSnapshot } from "../sim/snapshot.js";
import type { InputFrame } from "../sim/input.js";
import { predictionManager } from "./prediction.js";
import { interpolationManager } from "./interpolation.js";
import { netLog } from "../ui/net-console.js";
import { emit } from "../events.js";
import { applySnapshotToG } from "./snapshot-apply.js";
import {
  RemotePlayerBrief,
  upsertRemotePlayerPeer,
  removeRemotePlayerPeer,
} from "./remote-peers.js";
import {
  resolveSocketUrl,
  sendConnectToWorker,
  sendConnectToSocket,
  sendDisconnectToWorker,
  sendInputToWorker,
  sendInputToSocket,
  sendAckToWorker,
  sendAckToSocket,
} from "./client-transport.js";
import { handleGameEffect } from "./game-fx-handler.js";
import {
  type ConnectAckPayload,
  applyConnectAckSpawn,
  processReceivedSnapshot,
} from "./snapshot-handler.js";
import { handlePlayerJoined, handlePlayerLeft } from "./remote-players.js";
import { syncCharacterFromServer } from "./character-sync.js";
import { createChatHandler, type ChatHandler } from "./chat-handler.js";

export type ClientConnectionState = "disconnected" | "connecting" | "connected" | "disconnecting";
export type { RemotePlayerBrief } from "./remote-peers.js";
export { upsertRemotePlayerPeer, removeRemotePlayerPeer } from "./remote-peers.js";
export { applySnapshotToG } from "./snapshot-apply.js";

interface WorkerNetEnvelope {
  clientId?: string;
  msg?: {
    type: string;
    payload?: unknown;
  };
}

export function parseWorkerNetEnvelope(data: Record<string, unknown>): WorkerNetEnvelope {
  const nested = data.payload as WorkerNetEnvelope | undefined;
  if (nested && typeof nested === "object" && ("clientId" in nested || "msg" in nested)) {
    return nested;
  }
  return {
    clientId: data.clientId as string | undefined,
    msg: data.msg as WorkerNetEnvelope["msg"],
  };
}

export class GameClient {
  public connectionState: ClientConnectionState = "disconnected";
  public clientId = "";
  private localWorker: Worker | null = null;
  private socket: WebSocket | null = null;
  private cachedSnapshot: WorldSnapshot | null = null;
  private connectPromise: Promise<boolean> | null = null;
  private pendingConnect: { resolve: (ok: boolean) => void; reject: (err: Error) => void } | null = null;
  private chatHandler: ChatHandler;

  constructor() {
    this.clientId = `client_${Math.random().toString(36).substring(2, 9)}`;
    this.chatHandler = createChatHandler();
  }

  public connect(url: string, passcode: string, characterData: Player, localWorker?: Worker): Promise<boolean> {
    if (this.connectionState === "connected") return Promise.resolve(true);
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = this.doConnect(url, passcode, characterData, localWorker).finally(() => {
      this.connectPromise = null;
    });
    return this.connectPromise;
  }

  private doConnect(url: string, passcode: string, characterData: Player, localWorker?: Worker): Promise<boolean> {
    void passcode;
    if (this.connectionState === "connecting" || this.connectionState === "disconnecting") {
      this.disconnect();
    }

    this.connectionState = "connecting";
    netLog(`connecting id=${this.clientId} ${localWorker ? "local worker" : url || "no target"}`);
    console.log(`[GameClient] Connecting (ID: ${this.clientId})...`);

    if (localWorker) {
      this.localWorker = localWorker;
      this.localWorker.addEventListener("message", this.handleWorkerMessage);

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (!this.pendingConnect) return;
          this.pendingConnect = null;
          this.connectionState = "disconnected";
          netLog("[ERR] Local server connect timed out");
          reject(new Error("[GameClient] Local server connect timed out"));
        }, 15000);

        this.pendingConnect = {
          resolve: (ok) => {
            clearTimeout(timeout);
            resolve(ok);
          },
          reject: (err) => {
            clearTimeout(timeout);
            reject(err);
          },
        };

        const worker = this.localWorker;
        if (!worker) {
          this.pendingConnect?.reject(new Error("[GameClient] Local worker unavailable during connect"));
          this.pendingConnect = null;
          this.connectionState = "disconnected";
          return;
        }
        sendConnectToWorker(worker, this.clientId, characterData);
      });
    }

    if (url) {
      const socketUrl = resolveSocketUrl(url);
      this.socket = new WebSocket(socketUrl);

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (!this.pendingConnect) return;
          this.pendingConnect = null;
          this.connectionState = "disconnected";
          netLog("[ERR] Remote server connect timed out");
          reject(new Error("[GameClient] Remote server connect timed out"));
        }, 15000);

        this.pendingConnect = {
          resolve: (ok) => {
            clearTimeout(timeout);
            resolve(ok);
          },
          reject: (err) => {
            clearTimeout(timeout);
            reject(err);
          },
        };

        this.socket!.onopen = () => {
          netLog(`WebSocket open → ${socketUrl}`);
          console.log(`[GameClient] WebSocket connection opened to ${socketUrl}`);
          if (this.socket) sendConnectToSocket(this.socket, this.clientId, characterData);
        };

        this.socket!.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data) as { type?: string; payload?: unknown };
            this.handleSocketMessage(msg);
          } catch (err) {
            console.warn("[GameClient] Failed to parse WebSocket message:", err);
          }
        };

        this.socket!.onerror = (e) => {
          netLog("[ERR] WebSocket error");
          console.error("[GameClient] WebSocket error:", e);
          this.pendingConnect?.reject(new Error("[GameClient] WebSocket error"));
          this.pendingConnect = null;
        };

        this.socket!.onclose = () => {
          netLog("WebSocket closed");
          console.log("[GameClient] WebSocket connection closed");
          if (this.connectionState !== "connected" && this.pendingConnect) {
            this.pendingConnect.reject(new Error("[GameClient] WebSocket closed before connect"));
            this.pendingConnect = null;
            this.connectionState = "disconnected";
            this.socket = null;
            return;
          }
          this.disconnect();
        };
      });
    }

    return Promise.resolve(false);
  }

  private onConnectAck(payload: ConnectAckPayload) {
    if (payload.clientId && payload.clientId !== this.clientId) {
      netLog(`connect_ack clientId ${this.clientId} → ${payload.clientId}`);
      this.clientId = payload.clientId;
    }
    if (getState().player && getState().player.netId !== this.clientId) {
      PlayerAccess.setNetId(this.clientId);
    }
    applyConnectAckSpawn(payload.spawn);
    if (payload.others?.length) {
      for (const peer of payload.others) {
        upsertRemotePlayerPeer(peer);
      }
      netLog(`connect_ack peers=${payload.others.length}`);
    }
    const ackTick = Number.isFinite(payload.tick) ? payload.tick : 0;
    emit("net:tick-sync", { tick: ackTick + 1, resetPrediction: true });
    if (!Number.isFinite(payload.tick)) {
      netLog(`[WARN] connect_ack missing/invalid tick (${String(payload.tick)}) — fallback to ${ackTick + 1}`);
    } else {
      netLog(`tick sync on connect_ack → ${ackTick + 1}`);
    }
  }

  public disconnect() {
    if (this.connectionState === "disconnected") return;
    this.connectionState = "disconnecting";

    this.pendingConnect?.reject(new Error("[GameClient] Disconnected during connect"));
    this.pendingConnect = null;

    if (this.localWorker) {
      sendDisconnectToWorker(this.localWorker, this.clientId);
      this.localWorker.removeEventListener("message", this.handleWorkerMessage);
      this.localWorker = null;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    this.connectionState = "disconnected";
    this.cachedSnapshot = null;
    predictionManager.clear();
    interpolationManager.clear();
    PlayerAccess.clearServerPlayers();
    netLog("disconnected");
    console.log("[GameClient] Disconnected");
  }

  public sendInput(frame: InputFrame) {
    if (this.connectionState !== "connected") return;
    if (this.localWorker) {
      sendInputToWorker(this.localWorker, this.clientId, frame);
    } else if (this.socket) {
      sendInputToSocket(this.socket, this.clientId, frame);
    }
  }

  private handleWorkerMessage = (e: MessageEvent) => {
    const { type } = e.data || {};
    if (type !== "net_message") return;

    const { clientId, msg } = parseWorkerNetEnvelope(e.data || {});
    if (clientId !== this.clientId) return;
    if (!msg) return;

    this.routeMessage(msg, "worker");
  };

  private handleSocketMessage(msg: { type?: string; payload?: unknown }) {
    const type = msg?.type;
    if (!type) return;
    this.routeMessage({ type, payload: msg?.payload }, "socket");
  }

  private routeMessage(
    msg: { type: string; payload?: unknown },
    source: "worker" | "socket",
  ) {
    switch (msg.type) {
      case "effects": {
        const effectsPayload = msg.payload as { effects?: GameEffect[] };
        if (effectsPayload?.effects) {
          for (const eff of effectsPayload.effects) {
            handleGameEffect(eff);
          }
        }
        break;
      }
      case "snapshot": {
        const snapPayload = msg.payload as { fromTick?: number; tick?: number; player?: WorldSnapshot["player"]; entities?: { spawned?: WorldSnapshot["entities"] } };
        this.onReceiveSnapshot(snapPayload, snapPayload.fromTick === -1);
        break;
      }
      case "connect_ack":
        this.onConnectAck(msg.payload as ConnectAckPayload);
        if (this.connectionState !== "connected") {
          this.connectionState = "connected";
          const label = source === "worker" ? "local server worker" : "remote server";
          netLog(`[OK] Connected to ${label}`);
          console.log(`[GameClient] Connected to ${label}`);
        }
        this.pendingConnect?.resolve(true);
        this.pendingConnect = null;
        break;
      case "sync_character":
        syncCharacterFromServer((msg.payload as { character: Player }).character);
        break;
      case "chat": {
        const cp = msg.payload as { senderName: string; message: string; senderId?: string } | undefined;
        this.chatHandler.trigger(cp?.senderName ?? "Unknown", cp?.message ?? "", cp?.senderId);
        break;
      }
      case "typing": {
        const tp = msg.payload as { id: string; typing: boolean } | undefined;
        if (tp?.id) {
          if (tp.typing) Client.typingPlayers.add(tp.id);
          else Client.typingPlayers.delete(tp.id);
        }
        break;
      }
      case "player_joined":
        handlePlayerJoined(msg.payload as RemotePlayerBrief & { id?: string; name?: string });
        break;
      case "player_left":
        handlePlayerLeft(msg.payload as { id?: string; netId?: string });
        break;
      default:
        if (source === "socket") {
          netLog(`[WARN] unknown WS msg type: ${msg.type ?? "?"}`);
        }
        break;
    }
  }

  private onReceiveSnapshot(
    delta: DeltaSnapshot | { fromTick?: number; tick?: number; player?: WorldSnapshot["player"]; entities?: { spawned?: WorldSnapshot["entities"] } },
    isFullSnapshot: boolean,
  ) {
    const result = processReceivedSnapshot(delta, isFullSnapshot, this.cachedSnapshot);
    if (!result) return;
    this.cachedSnapshot = result.snap;

    const ackTick = result.ackTick;
    if (this.localWorker) {
      sendAckToWorker(this.localWorker, this.clientId, ackTick);
    } else if (this.socket) {
      sendAckToSocket(this.socket, this.clientId, ackTick);
    }
  }

  public onChatMessage(cb: (senderName: string, message: string, senderId?: string) => void) {
    return this.chatHandler.onMessage(cb);
  }

  public sendChatMessage(message: string) {
    this.chatHandler.send(message, this.clientId, this.localWorker, this.socket, this.connectionState);
  }

  public sendTyping(typing: boolean) {
    this.chatHandler.sendTyping(typing, this.clientId, this.localWorker, this.socket, this.connectionState);
  }
}
