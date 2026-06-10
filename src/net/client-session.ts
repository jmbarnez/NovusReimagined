import { Client, type Player, type GameEffect } from "../state.js";
import { PlayerAccess, getState } from "../state-access.js";
import { applyDelta, type WorldSnapshot, type DeltaSnapshot } from "../sim/snapshot.js";
import type { InputFrame } from "../sim/input.js";
import { predictionManager } from "./prediction.js";
import { interpolationManager } from "./interpolation.js";
import { populateSystem } from "../world-gen.js";
import { netLog, netLogSnapshot } from "../ui/net-console.js";
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
  sendChatToWorker,
  sendChatToSocket,
  sendTypingToWorker,
  sendTypingToSocket,
} from "./client-transport.js";
import { floatText, spawnExplosion, spawnShockwave, spawnImpactFlash, spawnBeam } from "../utils/fx.js";
import { addParticle } from "../utils/entities.js";
import { random } from "../utils/math.js";
import { sfxWeaponFire, sfxProjectileImpact, sfxShipExplosion, sfxShieldImpact, sfxHullImpact, sfxHostileLocking, sfxHostileLock, sfxUnderAttackPulse, sfxIndustrialBeam, sfxBlip, sfxBeamImpact } from "../audio/procedural.js";

export type ClientConnectionState = "disconnected" | "connecting" | "connected" | "disconnecting";
export type { RemotePlayerBrief } from "./remote-peers.js";
export { upsertRemotePlayerPeer, removeRemotePlayerPeer } from "./remote-peers.js";
export { applySnapshotToG } from "./snapshot-apply.js";

interface ConnectAckPayload {
  success: boolean;
  clientId: string;
  tick: number;
  spawn?: {
    x: number;
    y: number;
    px: number;
    py: number;
    sysIdx: number;
  };
  others?: RemotePlayerBrief[];
}

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

function applyConnectAckSpawn(spawn: ConnectAckPayload["spawn"]) {
  if (!spawn || !getState().player) return;
  const prevSysIdx = getState().player.sysIdx;
  PlayerAccess.updatePhysics({
    x: spawn.x,
    y: spawn.y,
    px: spawn.px,
    py: spawn.py,
  });
  if (spawn.sysIdx !== getState().player.sysIdx) PlayerAccess.setSysIdx(spawn.sysIdx);

  const sys = getState().GALAXY[spawn.sysIdx];
  if (sys && !sys._ready) {
    populateSystem(sys);
    netLog(`populateSystem sys=${spawn.sysIdx} (${sys.name}) from connect_ack`);
  } else if (sys) {
    netLog(`connect_ack sys=${spawn.sysIdx} (${sys.name}) already populated`);
  } else {
    netLog(`[WARN] connect_ack sys=${spawn.sysIdx} not found in galaxy`);
  }

  Client.camx = spawn.x;
  Client.camy = spawn.y;
  netLog(
    `connect_ack spawn (${spawn.x.toFixed(0)},${spawn.y.toFixed(0)}) sys ${prevSysIdx}→${spawn.sysIdx}`,
  );
}

function shouldReconcileLocalPlayer(snap: WorldSnapshot): boolean {
  const p = getState().player;
  if (!p) return false;
  if (snap.player.netId && p.netId && snap.player.netId !== p.netId) return false;
  return true;
}

// GameClient class: Handles client-side networking, local worker message routing,
// WebSocket connections, and applying authoritative snapshots received from the server.
export class GameClient {
  public connectionState: ClientConnectionState = "disconnected";
  public clientId = "";
  private localWorker: Worker | null = null;
  private socket: WebSocket | null = null;
  private cachedSnapshot: WorldSnapshot | null = null;
  private connectPromise: Promise<boolean> | null = null;
  private pendingConnect: { resolve: (ok: boolean) => void; reject: (err: Error) => void } | null = null;

  constructor() {
    this.clientId = `client_${Math.random().toString(36).substring(2, 9)}`;
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
    if (getState().player) PlayerAccess.setNetId(this.clientId);
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

  private onPlayerJoined(payload: RemotePlayerBrief & { id?: string; name?: string }) {
    const netId = payload.netId ?? payload.id;
    if (!netId) return;
    upsertRemotePlayerPeer({
      netId,
      shipId: payload.shipId ?? "scout",
      pilotName: payload.pilotName ?? payload.name,
      x: payload.x,
      y: payload.y,
      sysIdx: payload.sysIdx ?? getState().player?.sysIdx ?? 0,
    });
  }

  private onPlayerLeft(payload: { id?: string; netId?: string }) {
    const netId = payload.netId ?? payload.id;
    if (!netId) return;
    removeRemotePlayerPeer(netId);
    Client.typingPlayers.delete(netId);
    Client.chatBubbles.delete(netId);
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

    switch (msg?.type) {
      case "effects": {
        const effectsPayload = msg.payload as { effects?: GameEffect[] };
        if (effectsPayload?.effects) {
          for (const eff of effectsPayload.effects) {
            this.handleGameEffect(eff);
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
          netLog("[OK] Connected to local server worker");
          console.log("[GameClient] Connected to local server worker");
        }
        this.pendingConnect?.resolve(true);
        this.pendingConnect = null;
        break;
      case "sync_character":
        this.onSyncCharacter((msg.payload as { character: Player }).character);
        break;
      case "chat": {
        const cp = msg.payload as { senderName: string; message: string; senderId?: string } | undefined;
        this.triggerChatCallbacks(cp?.senderName ?? "Unknown", cp?.message ?? "", cp?.senderId);
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
        this.onPlayerJoined(msg.payload as RemotePlayerBrief & { id?: string; name?: string });
        break;
      case "player_left":
        this.onPlayerLeft(msg.payload as { id?: string; netId?: string });
        break;
      default:
        break;
    }
  };

  private handleSocketMessage(msg: { type?: string; payload?: unknown }) {
    switch (msg?.type) {
      case "effects": {
        const effectsPayload = msg.payload as { effects?: GameEffect[] };
        if (effectsPayload?.effects) {
          for (const eff of effectsPayload.effects) {
            this.handleGameEffect(eff);
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
          netLog("[OK] Connected to remote server");
          console.log("[GameClient] Connected to remote server");
        }
        this.pendingConnect?.resolve(true);
        this.pendingConnect = null;
        break;
      case "sync_character":
        this.onSyncCharacter((msg.payload as { character: Player }).character);
        break;
      case "chat": {
        const cp = msg.payload as { senderName: string; message: string; senderId?: string } | undefined;
        this.triggerChatCallbacks(cp?.senderName ?? "Unknown", cp?.message ?? "", cp?.senderId);
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
        this.onPlayerJoined(msg.payload as RemotePlayerBrief & { id?: string; name?: string });
        break;
      case "player_left":
        this.onPlayerLeft(msg.payload as { id?: string; netId?: string });
        break;
      default:
        netLog(`[WARN] unknown WS msg type: ${msg?.type ?? "?"}`);
        break;
    }
  }

  private handleGameEffect(eff: GameEffect) {
    const p = eff.payload;
    if (!p) return;
    switch (eff.type) {
      case "floatText":
        floatText(p.x ?? 0, p.y ?? 0, p.text ?? "", p.color, p.bgColor);
        break;
      case "explosion":
        spawnExplosion(p.x ?? 0, p.y ?? 0, p.color ?? "#ffffff", p.scale, typeof p.tier === "string" ? p.tier : undefined);
        sfxShipExplosion(p.x ?? 0, p.y ?? 0, typeof p.scale === "number" ? p.scale : 1);
        break;
      case "shockwave":
        spawnShockwave(p.x ?? 0, p.y ?? 0, p.color ?? "#ffffff", p.scale);
        break;
      case "impact":
        spawnImpactFlash(p.x ?? 0, p.y ?? 0, p.color ?? "#ffffff");
        if (p.delivery === "mining") {
          sfxBeamImpact("mining", p.x ?? 0, p.y ?? 0);
        } else {
          sfxProjectileImpact(p.x ?? 0, p.y ?? 0, p.delivery ?? "projectile");
        }
        break;
      case "beam":
        spawnBeam(p.x1 ?? 0, p.y1 ?? 0, p.x2 ?? 0, p.y2 ?? 0, p.color ?? "#ffffff", p.width);
        break;
      case "weaponFire":
        sfxWeaponFire(p.delivery ?? "projectile", p.typeId ?? "default", p.vol ?? 1, p.x ?? 0, p.y ?? 0);
        break;
      case "shieldImpact":
        sfxShieldImpact(p.vol ?? 1);
        break;
      case "hullImpact":
        sfxHullImpact(p.vol ?? 1);
        break;
      case "hostileLocking":
        sfxHostileLocking(p.x ?? 0, p.y ?? 0);
        break;
      case "hostileLock":
        sfxHostileLock(p.x ?? 0, p.y ?? 0);
        break;
      case "underAttackPulse":
        sfxUnderAttackPulse(p.count ?? 1, p.x ?? 0, p.y ?? 0);
        break;
      case "industrialBeam":
        sfxIndustrialBeam((p.delivery as "mining" | "salvage") ?? "mining", p.x ?? 0, p.y ?? 0);
        break;
      case "blip":
        sfxBlip(p.x ?? 880, p.y ?? 0.06);
        break;
      case "gateBoostParticles": {
        const gateX = p.x ?? 0;
        const gateY = p.y ?? 0;
        const gateAngle = p.angle ?? 0;
        const halfWidth = p.halfWidth ?? 108;
        const isForward = p.isForward ?? true;
        const perp = gateAngle + Math.PI / 2;
        const cos = Math.cos(perp);
        const sin = Math.sin(perp);
        const left = { x: gateX + cos * halfWidth, y: gateY + sin * halfWidth };
        const right = { x: gateX - cos * halfWidth, y: gateY - sin * halfWidth };
        const baseAngle = gateAngle + (isForward ? 0 : Math.PI);
        for (let i = 0; i < 32; i++) {
          const t = random();
          const bx = left.x + (right.x - left.x) * t;
          const by = left.y + (right.y - left.y) * t;
          const a = baseAngle + (random() - 0.5) * 0.5;
          const sp = 180 + random() * 100;
          addParticle({
            x: bx + (random() - 0.5) * 8,
            y: by + (random() - 0.5) * 8,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp,
            life: 0.6 + random() * 0.3,
            color: "#aaddff",
            r: 1 + random() * 1,
          });
        }
        break;
      }
      default:
        break;
    }
  }

  private onReceiveSnapshot(
    delta: DeltaSnapshot | { fromTick?: number; tick?: number; player?: WorldSnapshot["player"]; entities?: { spawned?: WorldSnapshot["entities"] } },
    isFullSnapshot: boolean,
  ) {
    if (!this.cachedSnapshot || delta.fromTick === -1) {
      const fullPlayer = (delta as { player?: WorldSnapshot["player"] }).player;
      if (!fullPlayer) return;
      this.cachedSnapshot = {
        tick: delta.tick ?? 0,
        player: fullPlayer,
        entities: delta.entities?.spawned || [],
      };
    } else {
      this.cachedSnapshot = applyDelta(this.cachedSnapshot, delta as DeltaSnapshot);
    }

    const snap = this.cachedSnapshot;
    if (!snap) return;

    applySnapshotToG(snap, isFullSnapshot || delta.fromTick === -1);
    const snapTick = Number.isFinite(snap.tick) ? snap.tick : 0;
    emit("net:tick-sync", { tick: snapTick + 1 });

    if (shouldReconcileLocalPlayer(snap)) {
      predictionManager.reconcile(snap);
    }
    interpolationManager.addSnapshot(snap);

    netLogSnapshot(
      snap.tick,
      snap.entities.length,
      snap.player.sysIdx,
      isFullSnapshot || delta.fromTick === -1,
      snap.entities.filter((e) => e.type === "player").length,
    );

    const ackTick = typeof delta.tick === "number" && Number.isFinite(delta.tick) ? delta.tick : snapTick;
    if (this.localWorker) {
      sendAckToWorker(this.localWorker, this.clientId, ackTick);
    } else if (this.socket) {
      sendAckToSocket(this.socket, this.clientId, ackTick);
    }
  }

  private onSyncCharacter(character: Player) {
    console.log("[GameClient] Received character sync from server, updating localStorage");

    let isLocalHostActive = false;
    if (typeof localStorage !== "undefined") {
      const hostActiveRaw = localStorage.getItem("ss2-host-active");
      if (hostActiveRaw) {
        const hostTime = parseInt(hostActiveRaw, 10);
        if (!Number.isNaN(hostTime) && Date.now() - hostTime < 10000) {
          isLocalHostActive = true;
        }
      }
    }

    if (isLocalHostActive) {
      console.log("[GameClient] Active local host detected. Skipping saving character to prevent overwriting host save.");
      return;
    }

    try {
      localStorage.setItem("ss2-sim-v1", JSON.stringify(character));
    } catch (e) {
      console.warn("[GameClient] Failed to save character sync to localStorage", e);
    }
  }

  private chatCallbacks = new Set<(senderName: string, message: string, senderId?: string) => void>();

  public onChatMessage(cb: (senderName: string, message: string, senderId?: string) => void) {
    this.chatCallbacks.add(cb);
    return () => this.chatCallbacks.delete(cb);
  }

  private triggerChatCallbacks(senderName: string, message: string, senderId?: string) {
    for (const cb of this.chatCallbacks) {
      try {
        cb(senderName, message, senderId);
      } catch (e) {
        console.error("[GameClient] Error in chat callback:", e);
      }
    }
  }

  public sendChatMessage(message: string) {
    if (this.connectionState !== "connected") return;
    if (this.localWorker) {
      sendChatToWorker(this.localWorker, this.clientId, message);
    } else if (this.socket) {
      sendChatToSocket(this.socket, this.clientId, message);
    }
  }

  public sendTyping(typing: boolean) {
    if (this.connectionState !== "connected") return;
    if (this.localWorker) {
      sendTypingToWorker(this.localWorker, this.clientId, typing);
    } else if (this.socket) {
      sendTypingToSocket(this.socket, this.clientId, typing);
    }
  }
}
