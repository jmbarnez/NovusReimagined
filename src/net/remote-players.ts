import { Client } from "../state.js";
import { getState } from "../state-access.js";
import {
  RemotePlayerBrief,
  upsertRemotePlayerPeer,
  removeRemotePlayerPeer,
} from "./remote-peers.js";

export function handlePlayerJoined(payload: RemotePlayerBrief & { id?: string; name?: string }): void {
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

export function handlePlayerLeft(payload: { id?: string; netId?: string }): void {
  const netId = payload.netId ?? payload.id;
  if (!netId) return;
  removeRemotePlayerPeer(netId);
  Client.typingPlayers.delete(netId);
  Client.chatBubbles.delete(netId);
}
