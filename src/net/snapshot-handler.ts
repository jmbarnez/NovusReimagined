import { Client } from "../state.js";
import { PlayerAccess, getState } from "../state-access.js";
import { applyDelta, type WorldSnapshot, type DeltaSnapshot } from "../sim/snapshot.js";
import { predictionManager } from "./prediction.js";
import { interpolationManager } from "./interpolation.js";
import { populateSystem } from "../world-gen.js";
import { netLog, netLogSnapshot } from "../ui/net-console.js";
import { emit } from "../events.js";
import { applySnapshotToG } from "./snapshot-apply.js";
import type { RemotePlayerBrief } from "./remote-peers.js";

export interface ConnectAckPayload {
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

export function applyConnectAckSpawn(spawn: ConnectAckPayload["spawn"]): void {
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

export function shouldReconcileLocalPlayer(snap: WorldSnapshot): boolean {
  const p = getState().player;
  if (!p) return false;
  if (snap.player.netId && p.netId && snap.player.netId !== p.netId) return false;
  return true;
}

export function processReceivedSnapshot(
  delta: DeltaSnapshot | { fromTick?: number; tick?: number; player?: WorldSnapshot["player"]; entities?: { spawned?: WorldSnapshot["entities"] } },
  isFullSnapshot: boolean,
  cachedSnapshot: WorldSnapshot | null,
): { snap: WorldSnapshot; ackTick: number } | null {
  let snap: WorldSnapshot;
  if (!cachedSnapshot || delta.fromTick === -1) {
    const fullPlayer = (delta as { player?: WorldSnapshot["player"] }).player;
    if (!fullPlayer) return null;
    snap = {
      tick: delta.tick ?? 0,
      player: fullPlayer,
      entities: delta.entities?.spawned || [],
    };
  } else {
    snap = applyDelta(cachedSnapshot, delta as DeltaSnapshot);
  }

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
  return { snap, ackTick };
}
