import { Client, type Player } from "../../state.js";
import { PlayerAccess, getState } from "../../state-access.js";
import type { WorldSnapshot } from "../../sim/snapshot.js";
import { netLog } from "../../ui/net-console.js";
import { makeRemotePlayerStub, type RemotePlayerBrief } from "../remote-peers.js";
import type { SnapshotEntityMaps } from "./entity-maps.js";

export function applyRemotePlayerSnapshots(maps: SnapshotEntityMaps, snap: WorldSnapshot, p: Player | null, isFullSnapshot: boolean): void {
  const peers = getState().players;

  for (const [id, peer] of [...peers.entries()]) {
    if (peer === p) continue;
    const snapEnt = maps.players.get(id);
    if (snapEnt) {
      if (Client.multiplayerRole === "none") {
        peer.x = snapEnt.x;
        peer.y = snapEnt.y;
        peer.vx = snapEnt.vx;
        peer.vy = snapEnt.vy;
        peer.angle = snapEnt.angle || 0;
      }
      peer.hp = snapEnt.hp || 100;
      peer.maxHp = snapEnt.maxHp || 100;
      peer.sysIdx = snap.player.sysIdx;
      if (snapEnt.miningLaser) {
        if (!peer.miningLaser) peer.miningLaser = { active: false, x1: 0, y1: 0, x2: 0, y2: 0, phase: 0, hitR: 0, hitNx: 0, hitNy: 0 };
        Object.assign(peer.miningLaser, snapEnt.miningLaser);
      } else {
        peer.miningLaser = null;
      }
      if (snapEnt.salvager) {
        if (!peer.salvager) peer.salvager = { active: false, targetPieceId: null, x1: 0, y1: 0, x2: 0, y2: 0, phase: 0 };
        Object.assign(peer.salvager, snapEnt.salvager);
      } else {
        peer.salvager = null;
      }
      if (snapEnt.tractor) {
        if (!peer.tractor) peer.tractor = { active: false, targetId: null, tooHeavy: false, x1: 0, y1: 0, x2: 0, y2: 0, phase: 0 };
        Object.assign(peer.tractor, snapEnt.tractor);
      } else {
        peer.tractor = null;
      }
      maps.players.delete(id);
    } else {
      PlayerAccess.removeServerPlayer(id);
    }
  }

  for (const ent of maps.players.values()) {
    const netId = String(ent.id);
    if (netId === p?.netId) continue;
    const newPeer = makeRemotePlayerStub({
      netId,
      shipId: ent.shipType ?? "scout",
      pilotName: ent.pilotName?.trim() || "Remote Player",
      x: ent.x,
      y: ent.y,
      sysIdx: snap.player.sysIdx,
    } satisfies RemotePlayerBrief);
    PlayerAccess.updatePhysics({ vx: ent.vx, vy: ent.vy, angle: ent.angle || 0, prevAngle: ent.angle || 0 }, newPeer);
    PlayerAccess.setHp(ent.hp || 100, newPeer);
    PlayerAccess.setMaxHp(ent.maxHp || 100, newPeer);
    PlayerAccess.addServerPlayer(newPeer);
  }

  const peerCount = Math.max(0, getState().players.size - 1);
  if (peerCount > 0 && isFullSnapshot) {
    netLog(`snapshot applied remote peers=${peerCount}`);
  }
}
