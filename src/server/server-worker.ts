import { GameServer } from "./server.js";

let server: GameServer | null = null;

// Listen for lifecycle commands and network packets from the main thread
self.onmessage = (e: MessageEvent) => {
  const { type, payload } = e.data || {};

  switch (type) {
    case "start":
      if (!server) {
        try {
          server = new GameServer((clientId, msg) => {
            // Forward server messages back to main thread to be dispatched to clients
            self.postMessage({
              type: "net_message",
              clientId,
              msg,
            });
          });
          server.start();
          self.postMessage({ type: "started" });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[ServerWorker] Failed to start:", err);
          self.postMessage({ type: "start_error", error: message });
        }
      } else {
        self.postMessage({ type: "started" });
      }
      break;

    case "stop":
      if (server) {
        server.stop();
        server = null;
        self.postMessage({ type: "stopped" });
      }
      break;

    case "connect":
      if (server?.ready && payload) {
        const { id, name, characterData } = payload;
        server.handleClientConnect(id, name, characterData);
      } else if (!server?.ready) {
        console.warn("[ServerWorker] Connect rejected: server not started yet");
      }
      break;

    case "disconnect":
      if (server && payload) {
        const { id } = payload;
        server.handleClientDisconnect(id);
      }
      break;

    case "input":
      if (server && payload) {
        const { id, frame } = payload;
        server.handleClientInput(id, frame);
      }
      break;

    case "chat":
      if (server && payload) {
        const { id, message } = payload;
        server.handleClientChat(id, message);
      }
      break;

    case "ack":
      if (server && payload) {
        const { id, tick } = payload;
        server.handleClientAck(id, tick);
      }
      break;

    default:
      console.warn("[ServerWorker] Received unknown message type:", type);
      break;
  }
};
