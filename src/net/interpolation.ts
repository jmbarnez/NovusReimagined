import { getState } from "../state-access.js";
import type { WorldSnapshot, EntitySnapshot } from "../sim/snapshot.js";
import { lerp } from "../utils/math.js";

interface Interpolatable {
  x: number;
  y: number;
  px?: number;
  py?: number;
  angle?: number;
  prevAngle?: number;
  miningLaser?: { active: boolean; x1: number; y1: number; x2: number; y2: number; phase: number; hitR: number; hitNx: number; hitNy: number } | null;
  salvager?: { active: boolean; x1: number; y1: number; x2: number; y2: number; phase: number; targetPieceId: string | null } | null;
  tractor?: { active: boolean; x1: number; y1: number; x2: number; y2: number; phase: number; targetId: string | null; tooHeavy: boolean } | null;
}

interface BufferedSnapshot {
  timestamp: number;
  snapshot: WorldSnapshot;
}

export class InterpolationManager {
  private buffer: BufferedSnapshot[] = [];
  private readonly bufferDelay = 80; // 80ms render delay (tighter window)

  public addSnapshot(snapshot: WorldSnapshot) {
    const realTime = performance.now();
    let smoothedTime = realTime;

    if (this.buffer.length > 0) {
      const prev = this.buffer[this.buffer.length - 1];
      const expectedGap = (snapshot.tick - prev.snapshot.tick) * (1000 / 60);
      
      // Blend expected time with actual arrival to filter out network packet jitter
      smoothedTime = prev.timestamp + expectedGap;
      
      if (Math.abs(smoothedTime - realTime) > 100) {
        smoothedTime = realTime;
      } else {
        // Gently pull towards real arrival time to maintain synchronization
        smoothedTime = lerp(smoothedTime, realTime, 0.1);
      }
    }

    this.buffer.push({
      timestamp: smoothedTime,
      snapshot,
    });

    // Prune buffer to keep only the last 15 snapshots (approx 750ms of history)
    if (this.buffer.length > 15) {
      this.buffer.shift();
    }
  }

  public clear() {
    this.buffer = [];
  }

  public update(now: number) {
    if (this.buffer.length === 0) return;

    const renderTime = now - this.bufferDelay;

    // 1. If renderTime is before the first snapshot, clamp to it
    if (renderTime < this.buffer[0].timestamp) {
      this.applySnapshotState(this.buffer[0].snapshot);
      return;
    }

    // 2. If renderTime is after the newest snapshot, extrapolate
    const latest = this.buffer[this.buffer.length - 1];
    if (renderTime >= latest.timestamp) {
      const dtMs = Math.min(50, renderTime - latest.timestamp);
      const dt = dtMs / 1000;
      this.extrapolateState(latest.snapshot, dt);
      return;
    }

    // 3. Find the two snapshots that bracket renderTime
    let i = 0;
    for (; i < this.buffer.length - 1; i++) {
      if (this.buffer[i].timestamp <= renderTime && renderTime < this.buffer[i + 1].timestamp) {
        break;
      }
    }

    const snapA = this.buffer[i];
    const snapB = this.buffer[i + 1];

    const t = (renderTime - snapA.timestamp) / (snapB.timestamp - snapA.timestamp);
    this.interpolateState(snapA.snapshot, snapB.snapshot, t);
  }

  private applySnapshotState(snap: WorldSnapshot) {
    const sys = getState().GALAXY?.[snap.player.sysIdx] || getState().GALAXY[0];
    if (!sys) return;

    const entMap = new Map<string | number, EntitySnapshot>();
    for (const ent of snap.entities) {
      entMap.set(ent.id, ent);
    }

    // Update other players
    if (getState().players) {
      for (const p of getState().players.values()) {
        if (!p.netId || p.netId === getState().player?.netId) continue;
        const state = entMap.get(p.netId);
        if (state) {
          p.x = p.px = state.x;
          p.y = p.py = state.y;
          p.angle = p.prevAngle = state.angle || 0;
          p.miningLaser = state.miningLaser ? { ...state.miningLaser } : null;
          p.salvager = state.salvager ? { ...state.salvager } : null;
          p.tractor = state.tractor ? { ...state.tractor } : null;
        }
      }
    }

    // Update NPCs/enemies
    if (sys.enemies) {
      for (const e of sys.enemies) {
        const state = entMap.get(e.id);
        if (state) {
          e.x = e.px = state.x;
          e.y = e.py = state.y;
          e.angle = e.prevAngle = state.angle || 0;
        }
      }
    }

    // Update Asteroids
    if (sys.asteroids) {
      for (const a of sys.asteroids) {
        const state = entMap.get(a.id);
        if (state) {
          a.x = state.x;
          a.y = state.y;
          a.prevSpin = a.spinAngle = state.spinAngle ?? 0;
          a.spinVel = state.spinVel ?? 0;
        }
      }
    }

    // Update Bullets
    for (const b of getState().bullets) {
      const state = entMap.get(b.id);
      if (state) {
        b.x = b.px = state.x;
        b.y = b.py = state.y;
      }
    }

    // Update Enemy Bullets
    for (const eb of getState().enemyBullets) {
      const state = entMap.get(eb.id);
      if (state) {
        eb.x = eb.px = state.x;
        eb.y = eb.py = state.y;
      }
    }

    // Update Wreck Pieces
    for (const wp of getState().wreckPieces) {
      const state = entMap.get(wp.id);
      if (state) {
        wp.x = state.x;
        wp.y = state.y;
        wp.angle = state.angle || 0;
      }
    }

    // Update Salvage Pickups
    for (const sp of getState().salvagePickups) {
      const state = entMap.get(sp.id);
      if (state) {
        sp.x = state.x;
        sp.y = state.y;
      }
    }
  }

  private interpolateState(snapA: WorldSnapshot, snapB: WorldSnapshot, t: number) {
    const sys = getState().GALAXY?.[snapA.player.sysIdx] || getState().GALAXY[0];
    if (!sys) return;

    const mapA = new Map<string | number, EntitySnapshot>();
    for (const ent of snapA.entities) mapA.set(ent.id, ent);

    const mapB = new Map<string | number, EntitySnapshot>();
    for (const ent of snapB.entities) mapB.set(ent.id, ent);

    // Helper to interpolate position and angle for an entity
    const updateEntity = (e: Interpolatable, id: string | number, hasPrevAngle = true) => {
      const entA = mapA.get(id);
      const entB = mapB.get(id);

      if (entA && entB) {
        if (e.px !== undefined) e.px = e.x;
        if (e.py !== undefined) e.py = e.y;
        e.x = lerp(entA.x, entB.x, t);
        e.y = lerp(entA.y, entB.y, t);

        if (hasPrevAngle) {
          e.prevAngle = e.angle;
          e.angle = lerpAngle(entA.angle || 0, entB.angle || 0, t);
        }

        if (entB.type === "player") {
          e.miningLaser = entB.miningLaser ? { ...entB.miningLaser } : null;
          e.salvager = entB.salvager ? { ...entB.salvager } : null;
          e.tractor = entB.tractor ? { ...entB.tractor } : null;
        }
      } else if (entB) {
        // Just spawned
        if (e.px !== undefined) e.px = entB.x;
        if (e.py !== undefined) e.py = entB.y;
        e.x = entB.x;
        e.y = entB.y;
        if (hasPrevAngle) {
          e.prevAngle = e.angle = entB.angle || 0;
        }
        if (entB.type === "player") {
          e.miningLaser = entB.miningLaser ? { ...entB.miningLaser } : null;
          e.salvager = entB.salvager ? { ...entB.salvager } : null;
          e.tractor = entB.tractor ? { ...entB.tractor } : null;
        }
      } else if (entA) {
        // Despawning
        if (e.px !== undefined) e.px = entA.x;
        if (e.py !== undefined) e.py = entA.y;
        e.x = entA.x;
        e.y = entA.y;
        if (hasPrevAngle) {
          e.prevAngle = e.angle = entA.angle || 0;
        }
        if (entA.type === "player") {
          e.miningLaser = entA.miningLaser ? { ...entA.miningLaser } : null;
          e.salvager = entA.salvager ? { ...entA.salvager } : null;
          e.tractor = entA.tractor ? { ...entA.tractor } : null;
        }
      }
    };

    // Update other players
    if (getState().players) {
      for (const p of getState().players.values()) {
        if (!p.netId || p.netId === getState().player?.netId) continue;
        updateEntity(p as Interpolatable, p.netId, true);
      }
    }

    // Update NPCs/enemies
    if (sys.enemies) {
      for (const e of sys.enemies) {
        updateEntity(e as Interpolatable, e.id, true);
      }
    }

    // Update Asteroids
    if (sys.asteroids) {
      for (const a of sys.asteroids) {
        const entA = mapA.get(a.id);
        const entB = mapB.get(a.id);
        if (entA && entB) {
          a.prevSpin = a.spinAngle;
          a.spinAngle = lerpAngle(entA.spinAngle ?? 0, entB.spinAngle ?? 0, t);
          a.spinVel = entB.spinVel ?? 0;
        } else if (entB) {
          a.prevSpin = a.spinAngle = entB.spinAngle ?? 0;
          a.spinVel = entB.spinVel ?? 0;
        }
        updateEntity(a as Interpolatable, a.id, false);
      }
    }

    // Update Bullets
    for (const b of getState().bullets) {
      updateEntity(b as Interpolatable, b.id, false);
    }

    // Update Enemy Bullets
    for (const eb of getState().enemyBullets) {
      updateEntity(eb as Interpolatable, eb.id, false);
    }

    // Update Wreck Pieces
    for (const wp of getState().wreckPieces) {
      updateEntity(wp as Interpolatable, wp.id, true);
    }

    // Update Salvage Pickups
    for (const sp of getState().salvagePickups) {
      updateEntity(sp as Interpolatable, sp.id, false);
    }
  }

  private extrapolateState(snap: WorldSnapshot, dt: number) {
    const sys = getState().GALAXY?.[snap.player.sysIdx] || getState().GALAXY[0];
    if (!sys) return;

    const entMap = new Map<string | number, EntitySnapshot>();
    for (const ent of snap.entities) {
      entMap.set(ent.id, ent);
    }

    // Helper to extrapolate position and angle for an entity
    const extrapolateEntity = (e: Interpolatable, id: string | number, hasPrevAngle = true) => {
      const state = entMap.get(id);
      if (state) {
        if (e.px !== undefined) e.px = e.x;
        if (e.py !== undefined) e.py = e.y;
        e.x = state.x + state.vx * dt;
        e.y = state.y + state.vy * dt;

        if (hasPrevAngle) {
          e.prevAngle = e.angle;
          e.angle = (state.angle || 0); // No va on entities snapshot, keep last known angle
        }

        if (state.type === "player") {
          e.miningLaser = state.miningLaser ? { ...state.miningLaser } : null;
          e.salvager = state.salvager ? { ...state.salvager } : null;
          e.tractor = state.tractor ? { ...state.tractor } : null;
        }
      }
    };

    // Update other players
    if (getState().players) {
      for (const p of getState().players.values()) {
        if (!p.netId || p.netId === getState().player?.netId) continue;
        extrapolateEntity(p as Interpolatable, p.netId, true);
      }
    }

    // Update NPCs/enemies
    if (sys.enemies) {
      for (const e of sys.enemies) {
        extrapolateEntity(e as Interpolatable, e.id, true);
      }
    }

    // Update Asteroids
    if (sys.asteroids) {
      for (const a of sys.asteroids) {
        const state = entMap.get(a.id);
        if (state) {
          a.prevSpin = a.spinAngle;
          a.spinAngle += (state.spinVel ?? 0) * dt;
          a.spinVel = state.spinVel ?? 0;
        }
        extrapolateEntity(a as Interpolatable, a.id, false);
      }
    }

    // Update Bullets
    for (const b of getState().bullets) {
      extrapolateEntity(b as Interpolatable, b.id, false);
    }

    // Update Enemy Bullets
    for (const eb of getState().enemyBullets) {
      extrapolateEntity(eb as Interpolatable, eb.id, false);
    }

    // Update Wreck Pieces
    for (const wp of getState().wreckPieces) {
      extrapolateEntity(wp as Interpolatable, wp.id, true);
    }

    // Update Salvage Pickups
    for (const sp of getState().salvagePickups) {
      extrapolateEntity(sp as Interpolatable, sp.id, false);
    }
  }
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  // Wrap diff to -PI..PI to interpolate along the shortest arc
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  return a + diff * t;
}

export const interpolationManager = new InterpolationManager();
