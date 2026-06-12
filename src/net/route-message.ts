import { Client, type Player, type GameEffect } from "../state.js";
import { netLog } from "../ui/net-console.js";
import { handleGameEffect } from "./game-fx-handler.js";
import { type ConnectAckPayload } from "./snapshot-handler.js";
import { handlePlayerJoined, handlePlayerLeft } from "./remote-players.js";
import { type RemotePlayerBrief } from "./remote-peers.js";
import { syncCharacterFromServer } from "./character-sync.js";
import { type ChatHandler } from "./chat-handler.js";
import type { WorldSnapshot, DeltaSnapshot } from "../sim/snapshot.js";

export interface RouteMessageDeps {
  chatHandler: ChatHandler;
  onConnectAck: (payload: ConnectAckPayload) => void;
  onReceiveSnapshot: (
    delta: DeltaSnapshot | {
      fromTick?: number;
      tick?: number;
      player?: WorldSnapshot["player"];
      entities?: { spawned?: WorldSnapshot["entities"] };
    },
    isFullSnapshot: boolean,
  ) => void;
}

export type RouteMessageResult =
  | { kind: "connect_ack"; source: "worker" | "socket" }
  | { kind: "handled" };

export function routeMessage(
  msg: { type: string; payload?: unknown },
  source: "worker" | "socket",
  deps: RouteMessageDeps,
): RouteMessageResult {
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
      const snapPayload = msg.payload as {
        fromTick?: number;
        tick?: number;
        player?: WorldSnapshot["player"];
        entities?: { spawned?: WorldSnapshot["entities"] };
      };
      deps.onReceiveSnapshot(snapPayload, snapPayload.fromTick === -1);
      break;
    }
    case "connect_ack": {
      deps.onConnectAck(msg.payload as ConnectAckPayload);
      return { kind: "connect_ack", source };
    }
    case "sync_character":
      syncCharacterFromServer((msg.payload as { character: Player }).character);
      break;
    case "chat": {
      const cp = msg.payload as { senderName: string; message: string; senderId?: string } | undefined;
      deps.chatHandler.trigger(cp?.senderName ?? "Unknown", cp?.message ?? "", cp?.senderId);
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
  return { kind: "handled" };
}
