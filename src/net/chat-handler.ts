import {
  sendChatToWorker,
  sendChatToSocket,
  sendTypingToWorker,
  sendTypingToSocket,
} from "./client-transport.js";

export type ChatCallback = (senderName: string, message: string, senderId?: string) => void;
export type ConnectionState = "disconnected" | "connecting" | "connected" | "disconnecting";

export interface ChatHandler {
  onMessage(cb: ChatCallback): () => void;
  trigger(senderName: string, message: string, senderId?: string): void;
  send(message: string, clientId: string, worker: Worker | null, socket: WebSocket | null, state: ConnectionState): void;
  sendTyping(typing: boolean, clientId: string, worker: Worker | null, socket: WebSocket | null, state: ConnectionState): void;
}

export function createChatHandler(): ChatHandler {
  const callbacks = new Set<ChatCallback>();

  return {
    onMessage(cb: ChatCallback) {
      callbacks.add(cb);
      return () => callbacks.delete(cb);
    },

    trigger(senderName: string, message: string, senderId?: string) {
      for (const cb of callbacks) {
        try {
          cb(senderName, message, senderId);
        } catch (e) {
          console.error("[GameClient] Error in chat callback:", e);
        }
      }
    },

    send(message: string, clientId: string, worker: Worker | null, socket: WebSocket | null, state: ConnectionState) {
      if (state !== "connected") return;
      if (worker) {
        sendChatToWorker(worker, clientId, message);
      } else if (socket) {
        sendChatToSocket(socket, clientId, message);
      }
    },

    sendTyping(typing: boolean, clientId: string, worker: Worker | null, socket: WebSocket | null, state: ConnectionState) {
      if (state !== "connected") return;
      if (worker) {
        sendTypingToWorker(worker, clientId, typing);
      } else if (socket) {
        sendTypingToSocket(socket, clientId, typing);
      }
    },
  };
}
