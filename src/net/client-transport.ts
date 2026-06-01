import type { Player } from "../state.js";
import type { InputFrame } from "../sim/input.js";
import { getPilotDisplayName } from "../player/player-data.js";

export function resolveSocketUrl(url: string): string {
  if (url.startsWith("ws://") || url.startsWith("wss://")) return url;
  return `ws://${url}`;
}

function sendWorkerMessage(worker: Worker, type: string, payload: Record<string, unknown>) {
  worker.postMessage({ type, payload });
}

function sendSocketMessage(socket: WebSocket, type: string, payload: Record<string, unknown>) {
  socket.send(JSON.stringify({ type, payload }));
}

export function sendConnectToWorker(worker: Worker, clientId: string, characterData: Player) {
  sendWorkerMessage(worker, "connect", {
    id: clientId,
    name: getPilotDisplayName(characterData),
    characterData,
  });
}

export function sendConnectToSocket(socket: WebSocket, clientId: string, characterData: Player) {
  sendSocketMessage(socket, "connect", {
    id: clientId,
    name: getPilotDisplayName(characterData),
    characterData,
  });
}

export function sendDisconnectToWorker(worker: Worker, clientId: string) {
  sendWorkerMessage(worker, "disconnect", { id: clientId });
}

export function sendInputToWorker(worker: Worker, clientId: string, frame: InputFrame) {
  sendWorkerMessage(worker, "input", { id: clientId, frame });
}

export function sendInputToSocket(socket: WebSocket, clientId: string, frame: InputFrame) {
  sendSocketMessage(socket, "input", { id: clientId, frame });
}

export function sendAckToWorker(worker: Worker, clientId: string, tick: number) {
  sendWorkerMessage(worker, "ack", { id: clientId, tick });
}

export function sendAckToSocket(socket: WebSocket, clientId: string, tick: number) {
  sendSocketMessage(socket, "ack", { id: clientId, tick });
}

export function sendChatToWorker(worker: Worker, clientId: string, message: string) {
  sendWorkerMessage(worker, "chat", { id: clientId, message });
}

export function sendChatToSocket(socket: WebSocket, clientId: string, message: string) {
  sendSocketMessage(socket, "chat", { id: clientId, message });
}

export function sendTypingToWorker(worker: Worker, clientId: string, typing: boolean) {
  sendWorkerMessage(worker, "typing", { id: clientId, typing });
}

export function sendTypingToSocket(socket: WebSocket, clientId: string, typing: boolean) {
  sendSocketMessage(socket, "typing", { id: clientId, typing });
}
